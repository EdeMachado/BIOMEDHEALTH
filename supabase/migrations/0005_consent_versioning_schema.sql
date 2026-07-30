-- SUP-B01.1: evolucao de schema para consentimento versionado.
-- Escopo: somente schema/constraints/indices/trigger de protecao de historico.
-- Fora de escopo: RLS, grants, RPC, runtime TypeScript e UI.
-- Decisao de coexistencia de versao:
-- - document_version (text) = versao juridica/funcional canonica do termo.
-- - version (int) = versao tecnica generica da entidade/linha (base do schema), sem papel juridico.

-- 1) consent_documents: identificacao funcional, hash verificavel e vigencia.
alter table public.consent_documents
  add column if not exists code text,
  add column if not exists content_hash text,
  add column if not exists effective_at timestamptz,
  add column if not exists expires_at timestamptz;

-- Backfill conservador para compatibilidade com bases ja migradas.
update public.consent_documents
set
  code = coalesce(code, 'consent-' || id::text),
  -- Identificador legado nao verificavel (nao e hash criptografico real).
  content_hash = coalesce(content_hash, 'legacy-id:non-verifiable:' || id::text),
  effective_at = coalesce(effective_at, created_at, now())
where code is null
   or content_hash is null
   or effective_at is null;

alter table public.consent_documents
  alter column code set not null,
  alter column content_hash set not null,
  alter column effective_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consent_documents_unique_code_version'
      and conrelid = 'public.consent_documents'::regclass
  ) then
    alter table public.consent_documents
      add constraint consent_documents_unique_code_version
      unique (organization_id, code, document_version);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consent_documents_id_organization_unique'
      and conrelid = 'public.consent_documents'::regclass
  ) then
    alter table public.consent_documents
      add constraint consent_documents_id_organization_unique
      unique (id, organization_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consent_documents_validity_window_chk'
      and conrelid = 'public.consent_documents'::regclass
  ) then
    alter table public.consent_documents
      add constraint consent_documents_validity_window_chk
      check (expires_at is null or expires_at >= effective_at);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consent_documents_document_version_not_blank_chk'
      and conrelid = 'public.consent_documents'::regclass
  ) then
    alter table public.consent_documents
      add constraint consent_documents_document_version_not_blank_chk
      check (btrim(document_version) <> '');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consent_documents_content_hash_not_blank_chk'
      and conrelid = 'public.consent_documents'::regclass
  ) then
    alter table public.consent_documents
      add constraint consent_documents_content_hash_not_blank_chk
      check (btrim(content_hash) <> '');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consent_documents_content_hash_kind_chk'
      and conrelid = 'public.consent_documents'::regclass
  ) then
    alter table public.consent_documents
      add constraint consent_documents_content_hash_kind_chk
      check (
        content_hash ~ '^sha256:[0-9A-Fa-f]{64}$'
        or content_hash ~ '^legacy-id:non-verifiable:[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$'
      );
  end if;
end $$;

create index if not exists consent_documents_org_effective_idx
  on public.consent_documents (organization_id, effective_at desc);

create index if not exists consent_documents_org_code_idx
  on public.consent_documents (organization_id, code);

-- 2) user_consents: metadados de revogacao e coerencia temporal.
alter table public.user_consents
  add column if not exists revoked_source text,
  add column if not exists revoked_reason text;

-- Compatibilidade com dados legados: revogacoes antigas herdam origem do aceite.
update public.user_consents
set revoked_source = coalesce(revoked_source, source, 'legacy')
where revoked_at is not null
  and revoked_source is null;

do $$
begin
  if exists (
    select 1
    from public.user_consents uc
    where uc.revoked_at is not null
      and uc.revoked_at < uc.accepted_at
  ) then
    raise exception
      'SUP-B01.1: existem revogacoes com revoked_at anterior a accepted_at em user_consents.';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.user_consents uc
    left join public.user_organizations uo
      on uo.organization_id = uc.organization_id
     and uo.user_id = uc.user_id
    where uo.id is null
  ) then
    raise exception
      'SUP-B01.1: existem consentimentos sem vinculo correspondente em user_organizations.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_consents_revocation_timeline_chk'
      and conrelid = 'public.user_consents'::regclass
  ) then
    alter table public.user_consents
      add constraint user_consents_revocation_timeline_chk
      check (revoked_at is null or revoked_at >= accepted_at);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_consents_revocation_fields_chk'
      and conrelid = 'public.user_consents'::regclass
  ) then
    alter table public.user_consents
      add constraint user_consents_revocation_fields_chk
      check (
        (revoked_at is null and revoked_source is null and revoked_reason is null)
        or
        (revoked_at is not null and revoked_source is not null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_consents_document_org_fk'
      and conrelid = 'public.user_consents'::regclass
  ) then
    alter table public.user_consents
      add constraint user_consents_document_org_fk
      foreign key (consent_document_id, organization_id)
      references public.consent_documents (id, organization_id)
      on update cascade
      on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_consents_user_org_fk'
      and conrelid = 'public.user_consents'::regclass
  ) then
    alter table public.user_consents
      add constraint user_consents_user_org_fk
      foreign key (organization_id, user_id)
      references public.user_organizations (organization_id, user_id)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists user_consents_org_user_accepted_idx
  on public.user_consents (organization_id, user_id, accepted_at desc);

create index if not exists user_consents_org_document_accepted_idx
  on public.user_consents (organization_id, consent_document_id, accepted_at desc);

create index if not exists user_consents_org_revoked_idx
  on public.user_consents (organization_id, revoked_at)
  where revoked_at is not null;

-- 3) Imutabilidade minima do documento apos aceite vinculado.
create or replace function public.guard_consent_documents_mutability()
returns trigger
language plpgsql
as $$
declare
  has_linked_acceptance boolean;
begin
  select exists (
    select 1
    from public.user_consents uc
    where uc.consent_document_id = old.id
      and uc.accepted_at is not null
  )
  into has_linked_acceptance;

  if has_linked_acceptance and (
    new.organization_id is distinct from old.organization_id
    or new.code is distinct from old.code
    or new.document_version is distinct from old.document_version
    or new.content_hash is distinct from old.content_hash
    or new.purpose is distinct from old.purpose
    or new.legal_basis is distinct from old.legal_basis
    or new.effective_at is distinct from old.effective_at
  ) then
    raise exception
      'SUP-B01.1: campos canonicos do consent_documents nao podem ser alterados apos haver aceite vinculado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_consent_documents_mutability on public.consent_documents;
create trigger trg_guard_consent_documents_mutability
before update on public.consent_documents
for each row execute function public.guard_consent_documents_mutability();

-- 4) user_consents: imutabilidade do aceite e revogacao irreversivel.
create or replace function public.guard_user_consents_mutability()
returns trigger
language plpgsql
as $$
begin
  -- Campos que identificam o aceite original sao absolutamente imutaveis.
  -- status permanece imutavel nesta etapa: o estado vigente do consentimento
  -- e representado por revoked_at (sem transicao formal de status definida).
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id
    or new.consent_document_id is distinct from old.consent_document_id
    or new.accepted_at is distinct from old.accepted_at
    or new.source is distinct from old.source
    or new.status is distinct from old.status
    or new.created_at is distinct from old.created_at
  then
    raise exception
      'SUP-B01.1: campos identificadores do aceite em user_consents sao imutaveis.';
  end if;

  -- Apos revogar, nenhum novo UPDATE e permitido.
  if old.revoked_at is not null then
    raise exception
      'SUP-B01.1: apos revogacao, user_consents nao permite novos updates.';
  end if;

  -- Sem revogacao, nenhum UPDATE e permitido.
  if old.revoked_at is null and new.revoked_at is null then
    raise exception
      'SUP-B01.1: user_consents so permite update na transicao de revogacao.';
  end if;

  -- Unica transicao valida: nao revogado -> revogado.
  if old.revoked_at is null and new.revoked_at is not null then
    if new.revoked_source is null then
      raise exception
        'SUP-B01.1: revoked_source e obrigatorio quando houver revogacao.';
    end if;

    -- version e tecnico: no ato da revogacao deve avancar exatamente +1.
    if new.version <> old.version + 1 then
      raise exception
        'SUP-B01.1: version deve avancar exatamente uma unidade no ato da revogacao.';
    end if;

    -- updated_at deve refletir evolucao temporal da linha e o momento da revogacao.
    if new.updated_at < old.updated_at then
      raise exception
        'SUP-B01.1: updated_at nao pode retroceder no ato da revogacao.';
    end if;

    if new.updated_at < new.revoked_at then
      raise exception
        'SUP-B01.1: updated_at deve ser igual ou posterior a revoked_at.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_user_consents_mutability on public.user_consents;
create trigger trg_guard_user_consents_mutability
before update on public.user_consents
for each row execute function public.guard_user_consents_mutability();

-- 5) Protecao de historico: revogacao nao deve usar DELETE.
create or replace function public.prevent_user_consents_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'DELETE em user_consents e proibido; use revogacao por campos dedicados.';
end;
$$;

drop trigger if exists trg_prevent_user_consents_delete on public.user_consents;
create trigger trg_prevent_user_consents_delete
before delete on public.user_consents
for each row execute function public.prevent_user_consents_delete();
