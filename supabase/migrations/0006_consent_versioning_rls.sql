-- SUP-B01.2: RLS, privilegios minimos e testes SQL para consentimento versionado.
-- Escopo: titular autenticado com vinculo organizacional ativo.
-- Fora de escopo: acesso clinico/gerencial individualizado, RPC, FORCE RLS, service_role customizado.

begin;

-- Baseline estatica observada no repositorio:
-- 1) user_consents com RLS habilitado e policy tenant-only:
--    org_isolation_user_consents USING (organization_id::text = auth.jwt() ->> 'app.organization_id')
-- 2) consent_documents sem RLS habilitado.
-- 3) grants explicitos versionados apenas para schema/funcoes app_auth (authenticated).
-- 4) sem grants explicitos versionados de tabela para consent_documents/user_consents.
-- 5) 0006 adota modo conservador: aborta se objetos novos ja existirem.

-- 0) Guardas estruturais esperadas desde 0005 (nao mascarar drift)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_consents_user_org_fk'
      and conrelid = 'public.user_consents'::regclass
  ) then
    raise exception
      'SUP-B01.2: pre-condicao ausente: constraint user_consents_user_org_fk nao encontrada.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_consents_document_org_fk'
      and conrelid = 'public.user_consents'::regclass
  ) then
    raise exception
      'SUP-B01.2: pre-condicao ausente: constraint user_consents_document_org_fk nao encontrada.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_organizations_unique_org_user'
      and conrelid = 'public.user_organizations'::regclass
  ) then
    raise exception
      'SUP-B01.2: pre-condicao ausente: user_organizations_unique_org_user nao encontrada.';
  end if;
end $$;

-- 1) Pre-checagem de duplicidade ativa para (organization_id, user_id, consent_document_id)
do $$
begin
  if exists (
    select 1
    from public.user_consents uc
    where uc.revoked_at is null
    group by uc.organization_id, uc.user_id, uc.consent_document_id
    having count(*) > 1
  ) then
    raise exception
      'SUP-B01.2: duplicidades ativas detectadas em user_consents para (organization_id, user_id, consent_document_id). Aborte e regularize antes de criar o indice unico parcial.';
  end if;
end $$;

-- 2) Policy legada deve corresponder ao baseline antes da substituicao.
do $$
declare
  v_old_qual text;
begin
  select pg_get_expr(p.polqual, p.polrelid)
    into v_old_qual
    from pg_policy p
   where p.polrelid = 'public.user_consents'::regclass
     and p.polname = 'org_isolation_user_consents';

  if v_old_qual is null then
    raise exception
      'SUP-B01.2: policy legada org_isolation_user_consents nao encontrada; abortando para evitar drift silencioso.';
  end if;

  if position('organization_id' in lower(v_old_qual)) = 0
     or position('auth.jwt()' in lower(v_old_qual)) = 0
     or position('app.organization_id' in lower(v_old_qual)) = 0
  then
    raise exception
      'SUP-B01.2: policy legada org_isolation_user_consents diverge da baseline esperada; abortando.';
  end if;
end $$;

-- 3) Objetos novos desta migration nao podem preexistir (modo conservador).
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'i'
      and c.relname = 'user_consents_one_active_acceptance_idx'
  ) then
    raise exception
      'SUP-B01.2: indice user_consents_one_active_acceptance_idx ja existe; abortando para evitar assumir objeto preexistente.';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'validate_user_consent_insert_eligibility'
      and p.pronargs = 0
  ) then
    raise exception
      'SUP-B01.2: funcao public.validate_user_consent_insert_eligibility() ja existe; abortando para evitar sobrescrita.';
  end if;

  if exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.user_consents'::regclass
      and t.tgname = 'trg_validate_user_consent_insert_eligibility'
      and not t.tgisinternal
  ) then
    raise exception
      'SUP-B01.2: trigger trg_validate_user_consent_insert_eligibility ja existe; abortando para evitar sobrescrita.';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid = 'public.user_consents'::regclass
      and polname in (
        'user_consents_select_self',
        'user_consents_insert_self',
        'user_consents_update_revoke_self'
      )
  ) then
    raise exception
      'SUP-B01.2: ao menos uma policy nova de user_consents ja existe; abortando para evitar drift.';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid = 'public.consent_documents'::regclass
      and polname in (
        'consent_documents_select_eligible',
        'consent_documents_select_history_self'
      )
  ) then
    raise exception
      'SUP-B01.2: ao menos uma policy nova de consent_documents ja existe; abortando para evitar drift.';
  end if;
end $$;

-- 4) Indice unico parcial para uma unica aceitacao ativa por documento/versionamento.
create unique index user_consents_one_active_acceptance_idx
  on public.user_consents (organization_id, user_id, consent_document_id)
  where revoked_at is null;

-- 5) Trigger de elegibilidade juridica do insert de aceite.
-- SECURITY DEFINER + search_path fixo para nao depender de policy permissiva em consent_documents.
create function public.validate_user_consent_insert_eligibility()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_document public.consent_documents%rowtype;
begin
  select d.*
    into v_document
    from public.consent_documents d
   where d.id = new.consent_document_id
   for update;

  if not found then
    raise exception
      'SUP-B01.2: consent_document_id % inexistente para registro de aceite.',
      new.consent_document_id;
  end if;

  if v_document.organization_id is distinct from new.organization_id then
    raise exception
      'SUP-B01.2: organization_id do aceite (%) diverge do organization_id do documento (%).',
      new.organization_id,
      v_document.organization_id;
  end if;

  if v_document.status <> 'ativo' then
    raise exception
      'SUP-B01.2: documento de consentimento % com status "%" nao e elegivel para novo aceite.',
      v_document.id,
      v_document.status;
  end if;

  if v_document.effective_at > transaction_timestamp() then
    raise exception
      'SUP-B01.2: documento de consentimento % ainda nao vigente (effective_at=%).',
      v_document.id,
      v_document.effective_at;
  end if;

  if v_document.expires_at is not null and v_document.expires_at <= transaction_timestamp() then
    raise exception
      'SUP-B01.2: documento de consentimento % expirado para novo aceite (expires_at=%).',
      v_document.id,
      v_document.expires_at;
  end if;

  return new;
end;
$$;

-- 5.1) Hardening de owner:
-- - baseline 0001..0005 nao fixa nome de owner via ALTER OWNER;
-- - portanto exigimos owner = current_user executor da migration;
-- - migration deve ser executada por role administrativa de migrations.
do $$
declare
  v_owner_name text;
  v_owner_oid oid;
  v_current_user text;
  v_anon_oid oid;
  v_authenticated_oid oid;
  v_service_role_oid oid;
  v_anon_can_assume_owner boolean := false;
  v_authenticated_can_assume_owner boolean := false;
begin
  select current_user into v_current_user;

  select r.rolname
       ,r.oid
    into v_owner_name, v_owner_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_roles r on r.oid = p.proowner
   where n.nspname = 'public'
     and p.proname = 'validate_user_consent_insert_eligibility'
     and p.pronargs = 0;

  if v_owner_name is null then
    raise exception
      'SUP-B01.2: owner da funcao validate_user_consent_insert_eligibility() nao localizado.';
  end if;

  if v_owner_name <> v_current_user then
    raise exception
      'SUP-B01.2: owner da funcao (%) deve coincidir com current_user executor da migration (%).',
      v_owner_name,
      v_current_user;
  end if;

  if v_owner_name in ('anon', 'authenticated', 'public', 'service_role') then
    raise exception
      'SUP-B01.2: owner inseguro para funcao validate_user_consent_insert_eligibility(): %.',
      v_owner_name;
  end if;

  -- Memberships indiretos: validar cadeia completa de assumibilidade/heranca.
  select oid into v_anon_oid from pg_roles where rolname = 'anon';
  select oid into v_authenticated_oid from pg_roles where rolname = 'authenticated';
  select oid into v_service_role_oid from pg_roles where rolname = 'service_role';

  if v_anon_oid is not null then
    v_anon_can_assume_owner := pg_has_role(v_anon_oid, v_owner_oid, 'MEMBER');
  end if;
  if v_authenticated_oid is not null then
    v_authenticated_can_assume_owner := pg_has_role(v_authenticated_oid, v_owner_oid, 'MEMBER');
  end if;

  if v_anon_can_assume_owner or v_authenticated_can_assume_owner then
    raise exception
      'SUP-B01.2: owner da funcao e assumivel por anon/authenticated (direta ou indiretamente); abortando.';
  end if;

  if v_service_role_oid is not null and v_owner_oid = v_service_role_oid then
    raise exception
      'SUP-B01.2: owner da funcao nao pode ser service_role.';
  end if;
end $$;

do $$
begin
  execute 'revoke all on function public.validate_user_consent_insert_eligibility() from public';

  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.validate_user_consent_insert_eligibility() from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.validate_user_consent_insert_eligibility() from authenticated';
  end if;
end $$;

-- Execucao por trigger nao requer GRANT EXECUTE ao papel de DML:
-- o backend invoca a funcao de trigger pelo trigger owner/contexto interno,
-- e os clientes continuam sem EXECUTE direto.
create trigger trg_validate_user_consent_insert_eligibility
before insert on public.user_consents
for each row execute function public.validate_user_consent_insert_eligibility();

-- 6) RLS user_consents: substituir policy tenant-only por policies de titular.
alter table public.user_consents enable row level security;

drop policy org_isolation_user_consents on public.user_consents;

create policy user_consents_select_self on public.user_consents
for select
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

create policy user_consents_insert_self on public.user_consents
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
  and exists (
    select 1
    from public.consent_documents d
    where d.id = user_consents.consent_document_id
      and d.organization_id = user_consents.organization_id
      and d.status = 'ativo'
      and d.effective_at <= transaction_timestamp()
      and (d.expires_at is null or d.expires_at > transaction_timestamp())
  )
);

create policy user_consents_update_revoke_self on public.user_consents
for update
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
)
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

-- 7) RLS consent_documents: leitura de elegiveis e historico proprio.
-- Nao ha recursao de policy: SELECT historico em consent_documents usa user_consents;
-- policy SELECT de user_consents nao referencia consent_documents.
alter table public.consent_documents enable row level security;

create policy consent_documents_select_eligible on public.consent_documents
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and status = 'ativo'
  and effective_at <= transaction_timestamp()
  and (expires_at is null or expires_at > transaction_timestamp())
);

create policy consent_documents_select_history_self on public.consent_documents
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and exists (
    select 1
    from public.user_consents uc
    where uc.organization_id = consent_documents.organization_id
      and uc.consent_document_id = consent_documents.id
      and uc.user_id = auth.uid()
  )
);

-- 8) Privilegios minimos de objeto (sem alterar owner/service_role).
revoke all on table public.consent_documents from public;
revoke all on table public.user_consents from public;

revoke all on table public.consent_documents from anon;
revoke all on table public.user_consents from anon;

revoke all on table public.consent_documents from authenticated;
grant select on table public.consent_documents to authenticated;

revoke all on table public.user_consents from authenticated;
grant select on table public.user_consents to authenticated;
grant insert (organization_id, user_id, consent_document_id, source) on table public.user_consents to authenticated;
grant update (revoked_at, revoked_source, revoked_reason, version, updated_at) on table public.user_consents to authenticated;
revoke delete on table public.user_consents from authenticated;

commit;
