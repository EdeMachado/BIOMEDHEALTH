-- SUP-C02: ficha clinica modular versionada (SELECT/INSERT/UPDATE) por vinculo ativo.
-- Incremental sobre 0012. Nao altera agenda, carteira, jornada nem care_plans (C03).
--
-- Modelo evolutivo:
-- 1) clinical_records = estado atual (rascunho|concluido) com sections jsonb + schema_version;
-- 2) clinical_record_versions = snapshots append-only (sem UPDATE/DELETE pela app);
-- 3) ficha concluida nao sofre edicao de conteudo; reabertura cria nova revision_number;
-- 4) chaves jsonb desconhecidas sao preservadas para evolucao sem perda.
--
-- Justificativa SECURITY DEFINER / helpers:
-- 1) professional_assignments ainda usa RLS legada (0002) por claims JWT;
-- 2) identidade profissional deve decorrer exclusivamente de auth.uid();
-- 3) snapshot de historico precisa inserir em clinical_record_versions sem ampliar grants de escrita arbitraria.

begin;

do $$
begin
  if not exists (select 1 from pg_class where oid = 'public.clinical_records'::regclass and relkind = 'r') then
    raise exception 'SUP-C02: tabela public.clinical_records ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'SUP-C02: funcao app_auth.has_active_org_link(uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_role(uuid,text[],uuid)') is null then
    raise exception 'SUP-C02: funcao app_auth.has_active_role(uuid,text[],uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'SUP-C02: funcao app_auth.has_active_clinical_assignment(uuid,uuid) ausente (requer 0010).';
  end if;
  if to_regprocedure('public.can_manage_clinical_agenda(uuid)') is null then
    raise exception 'SUP-C02: dependencia 0012 (can_manage_clinical_agenda) ausente.';
  end if;
  if to_regclass('public.clinical_record_versions') is not null then
    raise exception 'SUP-C02: tabela public.clinical_record_versions ja existe; reaplicar somente apos rollback 0013.';
  end if;
end $$;

-- Colunas evolutivas no cabecalho existente.
alter table public.clinical_records
  add column if not exists record_status text;

alter table public.clinical_records
  add column if not exists schema_version text;

alter table public.clinical_records
  add column if not exists sections jsonb;

alter table public.clinical_records
  add column if not exists revision_number int;

alter table public.clinical_records
  add column if not exists authored_by uuid;

alter table public.clinical_records
  add column if not exists concluded_at timestamptz;

alter table public.clinical_records
  add column if not exists concluded_by uuid;

update public.clinical_records
   set record_status = coalesce(record_status, 'rascunho'),
       schema_version = coalesce(schema_version, 'clinical_record.v1'),
       sections = coalesce(sections, '{}'::jsonb),
       revision_number = coalesce(revision_number, version, 1),
       authored_by = coalesce(authored_by, professional_id)
 where record_status is null
    or schema_version is null
    or sections is null
    or revision_number is null
    or authored_by is null;

alter table public.clinical_records
  alter column record_status set default 'rascunho';
alter table public.clinical_records
  alter column schema_version set default 'clinical_record.v1';
alter table public.clinical_records
  alter column sections set default '{}'::jsonb;
alter table public.clinical_records
  alter column revision_number set default 1;

alter table public.clinical_records
  alter column record_status set not null;
alter table public.clinical_records
  alter column schema_version set not null;
alter table public.clinical_records
  alter column sections set not null;
alter table public.clinical_records
  alter column revision_number set not null;
alter table public.clinical_records
  alter column authored_by set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinical_records_record_status_check'
      and conrelid = 'public.clinical_records'::regclass
  ) then
    alter table public.clinical_records
      add constraint clinical_records_record_status_check
      check (record_status in ('rascunho', 'concluido'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clinical_records_schema_version_check'
      and conrelid = 'public.clinical_records'::regclass
  ) then
    alter table public.clinical_records
      add constraint clinical_records_schema_version_check
      check (schema_version ~ '^clinical_record\.v[0-9]+$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clinical_records_revision_positive_check'
      and conrelid = 'public.clinical_records'::regclass
  ) then
    alter table public.clinical_records
      add constraint clinical_records_revision_positive_check
      check (revision_number >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clinical_records_concluded_consistency_check'
      and conrelid = 'public.clinical_records'::regclass
  ) then
    alter table public.clinical_records
      add constraint clinical_records_concluded_consistency_check
      check (
        (record_status = 'rascunho' and concluded_at is null and concluded_by is null)
        or (record_status = 'concluido' and concluded_at is not null and concluded_by is not null)
      );
  end if;
end $$;

create index if not exists clinical_records_organization_id_idx
  on public.clinical_records (organization_id);

create index if not exists clinical_records_professional_id_idx
  on public.clinical_records (professional_id);

create index if not exists clinical_records_user_id_idx
  on public.clinical_records (user_id);

create unique index if not exists clinical_records_active_unique_idx
  on public.clinical_records (organization_id, professional_id, user_id)
  where status = 'ativo';

create table public.clinical_record_versions (
  id uuid primary key default gen_random_uuid(),
  clinical_record_id uuid not null references public.clinical_records(id),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null,
  professional_id uuid not null,
  schema_version text not null,
  sections jsonb not null,
  summary text not null,
  record_status text not null,
  revision_number int not null,
  change_kind text not null,
  authored_by uuid not null,
  created_at timestamptz not null default now(),
  constraint clinical_record_versions_record_status_check
    check (record_status in ('rascunho', 'concluido')),
  constraint clinical_record_versions_change_kind_check
    check (change_kind in ('create', 'draft_save', 'conclude', 'reopen')),
  constraint clinical_record_versions_revision_positive_check
    check (revision_number >= 1)
);

create index if not exists clinical_record_versions_record_id_idx
  on public.clinical_record_versions (clinical_record_id, created_at desc);

create index if not exists clinical_record_versions_org_pro_user_idx
  on public.clinical_record_versions (organization_id, professional_id, user_id);

-- Helper: papel clinico ativo na organizacao (espelha agenda; evita acoplar grants de agenda a ficha).
create function public.can_manage_clinical_record(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and p_organization_id is not null
    and app_auth.has_active_org_link(p_organization_id)
    and app_auth.has_active_role(
      p_organization_id,
      array['medico', 'profissional_saude']::text[],
      null::uuid
    );
$$;

revoke all on function public.can_manage_clinical_record(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.can_manage_clinical_record(uuid) from anon';
  end if;
end $$;
grant execute on function public.can_manage_clinical_record(uuid) to authenticated;

-- Snapshot append-only apos escrita autorizada.
create function app_auth.snapshot_clinical_record_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'create';
  elsif old.record_status = 'concluido' and new.record_status = 'rascunho' then
    v_kind := 'reopen';
  elsif new.record_status = 'concluido' and coalesce(old.record_status, 'rascunho') = 'rascunho' then
    v_kind := 'conclude';
  else
    v_kind := 'draft_save';
  end if;

  insert into public.clinical_record_versions (
    clinical_record_id,
    organization_id,
    user_id,
    professional_id,
    schema_version,
    sections,
    summary,
    record_status,
    revision_number,
    change_kind,
    authored_by
  ) values (
    new.id,
    new.organization_id,
    new.user_id,
    new.professional_id,
    new.schema_version,
    new.sections,
    new.summary,
    new.record_status,
    new.revision_number,
    v_kind,
    new.authored_by
  );

  return new;
end;
$$;

drop trigger if exists trg_snapshot_clinical_record_version on public.clinical_records;
create trigger trg_snapshot_clinical_record_version
after insert or update on public.clinical_records
for each row
execute function app_auth.snapshot_clinical_record_version();

-- Impede edicao opaca de ficha concluida; permite apenas reopen com revision_number+1.
create function app_auth.guard_clinical_record_mutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.record_status = 'concluido' and new.record_status = 'concluido' then
    raise exception 'SUP-C02: ficha clinica concluida e imutavel'
      using errcode = '42501';
  end if;

  if old.record_status = 'concluido' and new.record_status = 'rascunho' then
    if new.revision_number <> old.revision_number + 1 then
      raise exception 'SUP-C02: reopen exige revision_number = anterior + 1'
        using errcode = '23514';
    end if;
    if new.concluded_at is not null or new.concluded_by is not null then
      raise exception 'SUP-C02: reopen deve limpar concluded_at/concluded_by'
        using errcode = '23514';
    end if;
  end if;

  if old.record_status = 'rascunho' and new.record_status = 'rascunho'
     and new.revision_number <> old.revision_number then
    raise exception 'SUP-C02: revision_number so muda em reopen apos conclusao'
      using errcode = '23514';
  end if;

  if new.professional_id is distinct from old.professional_id then
    raise exception 'SUP-C02: professional_id imutavel'
      using errcode = '42501';
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'SUP-C02: organization_id/user_id imutaveis'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_clinical_record_mutability on public.clinical_records;
create trigger trg_guard_clinical_record_mutability
before update on public.clinical_records
for each row
execute function app_auth.guard_clinical_record_mutability();

-- Substitui policy legada 0002 (SELECT por JWT claim) por modelo auth.uid + assignment.
drop policy if exists clinical_only_allowed_roles on public.clinical_records;

alter table public.clinical_records enable row level security;
alter table public.clinical_record_versions enable row level security;

create policy clinical_records_select_own on public.clinical_records
for select to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

create policy clinical_records_insert_own on public.clinical_records
for insert to authenticated
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and authored_by = auth.uid()
  and record_status = 'rascunho'
  and concluded_at is null
  and concluded_by is null
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

create policy clinical_records_update_own on public.clinical_records
for update to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
  and (
    record_status = 'rascunho'
    or record_status = 'concluido'
  )
)
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and authored_by = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
  and (
    (record_status = 'rascunho' and concluded_at is null and concluded_by is null)
    or (record_status = 'concluido' and concluded_at is not null and concluded_by = auth.uid())
  )
);

create policy clinical_record_versions_select_own on public.clinical_record_versions
for select to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

-- Sem INSERT/UPDATE/DELETE direto em versions pela role authenticated (somente trigger SECURITY DEFINER).

revoke all on table public.clinical_records from public;
revoke all on table public.clinical_record_versions from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.clinical_records from anon';
    execute 'revoke all on table public.clinical_record_versions from anon';
  end if;
end $$;

revoke all on table public.clinical_records from authenticated;
revoke all on table public.clinical_record_versions from authenticated;

grant select on table public.clinical_records to authenticated;
grant insert (
  organization_id,
  user_id,
  professional_id,
  summary,
  status,
  version,
  record_status,
  schema_version,
  sections,
  revision_number,
  authored_by,
  concluded_at,
  concluded_by
) on table public.clinical_records to authenticated;
grant update (
  summary,
  status,
  version,
  record_status,
  schema_version,
  sections,
  revision_number,
  authored_by,
  concluded_at,
  concluded_by,
  updated_at
) on table public.clinical_records to authenticated;

grant select on table public.clinical_record_versions to authenticated;

-- Sem DELETE. Sem grants de escrita em clinical_record_versions para authenticated.

commit;
