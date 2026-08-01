-- SUP-D01-B: persistencia estrutural de escopo coletivo para campanhas/planos.
-- Escopo:
-- - colunas scope_type / unit_id / unit_applicability em campaigns e action_plans
-- - tabela campaign_unit_applicabilities (selected_units)
-- - tabela action_plan_unit_applicabilities (analogia SPEC)
-- - CHECKs, FKs, triggers unit∈organization e coerencia selected_units
-- - RLS membership (substitui policy JWT legado de campaigns/action_plans)
-- - RLS em campaign_audiences (antes sem RLS)
-- Fora de escopo:
-- - UI / repositories / AuthContext
-- - agregacoes / limiar / suppressed (SUP-D02)
-- - program_participations / acesso nominal
-- - dados demo alem do backfill explicito all_units

begin;

-- ---------------------------------------------------------------------------
-- 0) Pre-condicoes
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.campaigns') is null then
    raise exception 'SUP-D01-B: pre-condicao ausente: public.campaigns';
  end if;
  if to_regclass('public.campaign_audiences') is null then
    raise exception 'SUP-D01-B: pre-condicao ausente: public.campaign_audiences';
  end if;
  if to_regclass('public.action_plans') is null then
    raise exception 'SUP-D01-B: pre-condicao ausente: public.action_plans';
  end if;
  if to_regclass('public.organization_units') is null then
    raise exception 'SUP-D01-B: pre-condicao ausente: public.organization_units';
  end if;
  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'SUP-D01-B: pre-condicao ausente: app_auth.has_active_org_link(uuid)';
  end if;
  if to_regprocedure('app_auth.has_active_role(uuid,text[],uuid)') is null then
    raise exception 'SUP-D01-B: pre-condicao ausente: app_auth.has_active_role(uuid,text[],uuid)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'campaigns' and column_name = 'scope_type'
  ) then
    raise exception 'SUP-D01-B: coluna campaigns.scope_type ja existe; abortando.';
  end if;

  if to_regclass('public.campaign_unit_applicabilities') is not null then
    raise exception 'SUP-D01-B: tabela campaign_unit_applicabilities ja existe; abortando.';
  end if;

  if to_regclass('public.action_plan_unit_applicabilities') is not null then
    raise exception 'SUP-D01-B: tabela action_plan_unit_applicabilities ja existe; abortando.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Colunas de escopo + backfill explicito (SPEC §12)
-- ---------------------------------------------------------------------------
alter table public.campaigns
  add column scope_type text,
  add column unit_id uuid references public.organization_units(id),
  add column unit_applicability text;

alter table public.action_plans
  add column scope_type text,
  add column unit_id uuid references public.organization_units(id),
  add column unit_applicability text;

update public.campaigns
   set scope_type = 'organization',
       unit_id = null,
       unit_applicability = 'all_units'
 where scope_type is null;

update public.action_plans
   set scope_type = 'organization',
       unit_id = null,
       unit_applicability = 'all_units'
 where scope_type is null;

alter table public.campaigns
  alter column scope_type set not null,
  alter column scope_type set default 'organization';

alter table public.action_plans
  alter column scope_type set not null,
  alter column scope_type set default 'organization';

alter table public.campaigns
  add constraint campaigns_scope_type_check
    check (scope_type in ('organization', 'unit')),
  add constraint campaigns_scope_unit_applicability_check
    check (
      (
        scope_type = 'organization'
        and unit_id is null
        and unit_applicability in ('all_units', 'selected_units')
      )
      or (
        scope_type = 'unit'
        and unit_id is not null
        and unit_applicability is null
      )
    );

alter table public.action_plans
  add constraint action_plans_scope_type_check
    check (scope_type in ('organization', 'unit')),
  add constraint action_plans_scope_unit_applicability_check
    check (
      (
        scope_type = 'organization'
        and unit_id is null
        and unit_applicability in ('all_units', 'selected_units')
      )
      or (
        scope_type = 'unit'
        and unit_id is not null
        and unit_applicability is null
      )
    );

create index campaigns_organization_scope_idx
  on public.campaigns (organization_id, scope_type, unit_id);

create index action_plans_organization_scope_idx
  on public.action_plans (organization_id, scope_type, unit_id);

-- ---------------------------------------------------------------------------
-- 2) Tabelas de aplicabilidade selected_units
-- ---------------------------------------------------------------------------
create table public.campaign_unit_applicabilities (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  unit_id uuid not null references public.organization_units(id),
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_unit_applicabilities_unique unique (campaign_id, unit_id)
);

create table public.action_plan_unit_applicabilities (
  id uuid primary key default gen_random_uuid(),
  action_plan_id uuid not null references public.action_plans(id) on delete cascade,
  unit_id uuid not null references public.organization_units(id),
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_plan_unit_applicabilities_unique unique (action_plan_id, unit_id)
);

create index campaign_unit_applicabilities_unit_idx
  on public.campaign_unit_applicabilities (unit_id);

create index action_plan_unit_applicabilities_unit_idx
  on public.action_plan_unit_applicabilities (unit_id);

grant select, insert, update, delete on table public.campaign_unit_applicabilities to authenticated;
grant select, insert, update, delete on table public.action_plan_unit_applicabilities to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Helpers de integridade / autorizacao coletiva
--     (apos tabelas, para language sql validar referencias)
-- ---------------------------------------------------------------------------
create or replace function app_auth.unit_belongs_to_organization(
  target_unit_id uuid,
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_units ou
    where ou.id = target_unit_id
      and ou.organization_id = target_organization_id
      and ou.status = 'ativo'
  );
$$;

create or replace function app_auth.has_org_wide_collective_role(
  target_organization_id uuid,
  accepted_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_organizations uo
    join public.user_roles ur
      on ur.user_organization_id = uo.id
     and ur.organization_id = uo.organization_id
     and ur.status = 'ativo'
    join public.roles r
      on r.id = ur.role_id
     and r.status = 'ativo'
    where uo.user_id = auth.uid()
      and uo.organization_id = target_organization_id
      and uo.status = 'ativo'
      and r.code = any(accepted_roles)
      and ur.unit_id is null
  );
$$;

create or replace function app_auth.has_unit_collective_role(
  target_organization_id uuid,
  target_unit_id uuid,
  accepted_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_organizations uo
    join public.user_roles ur
      on ur.user_organization_id = uo.id
     and ur.organization_id = uo.organization_id
     and ur.status = 'ativo'
    join public.roles r
      on r.id = ur.role_id
     and r.status = 'ativo'
    where uo.user_id = auth.uid()
      and uo.organization_id = target_organization_id
      and uo.status = 'ativo'
      and r.code = any(accepted_roles)
      and ur.unit_id = target_unit_id
  );
$$;

-- Leitura conforme SPEC §6.2 (metadados coletivos; sem dado nominal).
create or replace function app_auth.can_select_campaign(
  p_organization_id uuid,
  p_scope_type text,
  p_unit_id uuid,
  p_unit_applicability text,
  p_campaign_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and app_auth.has_active_org_link(p_organization_id)
    and (
      app_auth.has_org_wide_collective_role(
        p_organization_id,
        array['gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed', 'auditor']
      )
      or (
        p_scope_type = 'unit'
        and p_unit_id is not null
        and app_auth.has_unit_collective_role(
          p_organization_id,
          p_unit_id,
          array['sst', 'gestor_institucional', 'admin_cliente', 'admin_biomed', 'auditor']
        )
      )
      or (
        p_scope_type = 'organization'
        and p_unit_applicability = 'all_units'
        and exists (
          select 1
          from public.user_organizations uo
          join public.user_roles ur
            on ur.user_organization_id = uo.id
           and ur.organization_id = uo.organization_id
           and ur.status = 'ativo'
          join public.roles r
            on r.id = ur.role_id
           and r.status = 'ativo'
          where uo.user_id = auth.uid()
            and uo.organization_id = p_organization_id
            and uo.status = 'ativo'
            and r.code = any(array['sst', 'gestor_institucional', 'admin_cliente', 'admin_biomed', 'auditor'])
            and ur.unit_id is not null
        )
      )
      or (
        p_scope_type = 'organization'
        and p_unit_applicability = 'selected_units'
        and exists (
          select 1
          from public.user_organizations uo
          join public.user_roles ur
            on ur.user_organization_id = uo.id
           and ur.organization_id = uo.organization_id
           and ur.status = 'ativo'
          join public.roles r
            on r.id = ur.role_id
           and r.status = 'ativo'
          join public.campaign_unit_applicabilities cua
            on cua.campaign_id = p_campaign_id
           and cua.unit_id = ur.unit_id
          where uo.user_id = auth.uid()
            and uo.organization_id = p_organization_id
            and uo.status = 'ativo'
            and r.code = any(array['sst', 'gestor_institucional', 'admin_cliente', 'admin_biomed', 'auditor'])
            and ur.unit_id is not null
        )
      )
    );
$$;

create or replace function app_auth.can_write_campaign(
  p_organization_id uuid,
  p_scope_type text,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and app_auth.has_active_org_link(p_organization_id)
    and (
      app_auth.has_org_wide_collective_role(
        p_organization_id,
        array['gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed']
      )
      or (
        p_scope_type = 'unit'
        and p_unit_id is not null
        and app_auth.has_unit_collective_role(
          p_organization_id,
          p_unit_id,
          array['sst']
        )
      )
    );
$$;

create or replace function app_auth.can_select_action_plan(
  p_organization_id uuid,
  p_scope_type text,
  p_unit_id uuid,
  p_unit_applicability text,
  p_action_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and app_auth.has_active_org_link(p_organization_id)
    and (
      app_auth.has_org_wide_collective_role(
        p_organization_id,
        array['gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed', 'auditor']
      )
      or (
        p_scope_type = 'unit'
        and p_unit_id is not null
        and app_auth.has_unit_collective_role(
          p_organization_id,
          p_unit_id,
          array['sst', 'gestor_institucional', 'admin_cliente', 'admin_biomed', 'auditor']
        )
      )
      or (
        p_scope_type = 'organization'
        and p_unit_applicability = 'all_units'
        and exists (
          select 1
          from public.user_organizations uo
          join public.user_roles ur
            on ur.user_organization_id = uo.id
           and ur.organization_id = uo.organization_id
           and ur.status = 'ativo'
          join public.roles r
            on r.id = ur.role_id
           and r.status = 'ativo'
          where uo.user_id = auth.uid()
            and uo.organization_id = p_organization_id
            and uo.status = 'ativo'
            and r.code = any(array['sst', 'gestor_institucional', 'admin_cliente', 'admin_biomed', 'auditor'])
            and ur.unit_id is not null
        )
      )
      or (
        p_scope_type = 'organization'
        and p_unit_applicability = 'selected_units'
        and exists (
          select 1
          from public.user_organizations uo
          join public.user_roles ur
            on ur.user_organization_id = uo.id
           and ur.organization_id = uo.organization_id
           and ur.status = 'ativo'
          join public.roles r
            on r.id = ur.role_id
           and r.status = 'ativo'
          join public.action_plan_unit_applicabilities apua
            on apua.action_plan_id = p_action_plan_id
           and apua.unit_id = ur.unit_id
          where uo.user_id = auth.uid()
            and uo.organization_id = p_organization_id
            and uo.status = 'ativo'
            and r.code = any(array['sst', 'gestor_institucional', 'admin_cliente', 'admin_biomed', 'auditor'])
            and ur.unit_id is not null
        )
      )
    );
$$;

create or replace function app_auth.can_write_action_plan(
  p_organization_id uuid,
  p_scope_type text,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_auth.can_write_campaign(p_organization_id, p_scope_type, p_unit_id);
$$;

-- Privilegio minimo (SUP-D01-B / B1):
-- - helpers internos (unit_belongs / has_*_collective_role): sem EXECUTE para PUBLIC/authenticated/anon;
--   usados apenas por triggers e por can_* SECURITY DEFINER (owner).
-- - can_select_* / can_write_*: EXECUTE somente authenticated (chamados pelas policies RLS).
revoke all on function app_auth.unit_belongs_to_organization(uuid, uuid) from public;
revoke all on function app_auth.unit_belongs_to_organization(uuid, uuid) from authenticated;
revoke all on function app_auth.has_org_wide_collective_role(uuid, text[]) from public;
revoke all on function app_auth.has_org_wide_collective_role(uuid, text[]) from authenticated;
revoke all on function app_auth.has_unit_collective_role(uuid, uuid, text[]) from public;
revoke all on function app_auth.has_unit_collective_role(uuid, uuid, text[]) from authenticated;
revoke all on function app_auth.can_select_campaign(uuid, text, uuid, text, uuid) from public;
revoke all on function app_auth.can_write_campaign(uuid, text, uuid) from public;
revoke all on function app_auth.can_select_action_plan(uuid, text, uuid, text, uuid) from public;
revoke all on function app_auth.can_write_action_plan(uuid, text, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function app_auth.unit_belongs_to_organization(uuid, uuid) from anon';
    execute 'revoke all on function app_auth.has_org_wide_collective_role(uuid, text[]) from anon';
    execute 'revoke all on function app_auth.has_unit_collective_role(uuid, uuid, text[]) from anon';
    execute 'revoke all on function app_auth.can_select_campaign(uuid, text, uuid, text, uuid) from anon';
    execute 'revoke all on function app_auth.can_write_campaign(uuid, text, uuid) from anon';
    execute 'revoke all on function app_auth.can_select_action_plan(uuid, text, uuid, text, uuid) from anon';
    execute 'revoke all on function app_auth.can_write_action_plan(uuid, text, uuid) from anon';
  end if;
end $$;

grant execute on function app_auth.can_select_campaign(uuid, text, uuid, text, uuid) to authenticated;
grant execute on function app_auth.can_write_campaign(uuid, text, uuid) to authenticated;
grant execute on function app_auth.can_select_action_plan(uuid, text, uuid, text, uuid) to authenticated;
grant execute on function app_auth.can_write_action_plan(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Triggers de integridade
-- ---------------------------------------------------------------------------
create or replace function public.enforce_campaign_organization_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'SUP-D01-B: campaigns.organization_id e imutavel'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger campaigns_organization_immutable
before update of organization_id
on public.campaigns
for each row
execute function public.enforce_campaign_organization_immutable();

create or replace function public.enforce_action_plan_organization_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'SUP-D01-B: action_plans.organization_id e imutavel'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger action_plans_organization_immutable
before update of organization_id
on public.action_plans
for each row
execute function public.enforce_action_plan_organization_immutable();

create or replace function public.enforce_campaign_unit_belongs_to_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unit_id is not null
     and not app_auth.unit_belongs_to_organization(new.unit_id, new.organization_id) then
    raise exception 'SUP-D01-B: unit_id % nao pertence a organization_id %', new.unit_id, new.organization_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger campaigns_unit_belongs_to_org
before insert or update of unit_id, organization_id
on public.campaigns
for each row
execute function public.enforce_campaign_unit_belongs_to_org();

create or replace function public.enforce_action_plan_unit_belongs_to_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unit_id is not null
     and not app_auth.unit_belongs_to_organization(new.unit_id, new.organization_id) then
    raise exception 'SUP-D01-B: unit_id % nao pertence a organization_id %', new.unit_id, new.organization_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger action_plans_unit_belongs_to_org
before insert or update of unit_id, organization_id
on public.action_plans
for each row
execute function public.enforce_action_plan_unit_belongs_to_org();

create or replace function public.enforce_campaign_unit_applicability_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_scope text;
  v_applicability text;
begin
  select c.organization_id, c.scope_type, c.unit_applicability
    into v_org, v_scope, v_applicability
  from public.campaigns c
  where c.id = new.campaign_id;

  if v_org is null then
    raise exception 'SUP-D01-B: campaign_id % inexistente', new.campaign_id
      using errcode = '23503';
  end if;

  if v_scope is distinct from 'organization' or v_applicability is distinct from 'selected_units' then
    raise exception 'SUP-D01-B: associacoes so permitidas quando scope_type=organization e unit_applicability=selected_units'
      using errcode = '23514';
  end if;

  if not app_auth.unit_belongs_to_organization(new.unit_id, v_org) then
    raise exception 'SUP-D01-B: unit_id % fora da organization da campanha', new.unit_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger campaign_unit_applicabilities_row_guard
before insert or update
on public.campaign_unit_applicabilities
for each row
execute function public.enforce_campaign_unit_applicability_row();

create or replace function public.enforce_action_plan_unit_applicability_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_scope text;
  v_applicability text;
begin
  select p.organization_id, p.scope_type, p.unit_applicability
    into v_org, v_scope, v_applicability
  from public.action_plans p
  where p.id = new.action_plan_id;

  if v_org is null then
    raise exception 'SUP-D01-B: action_plan_id % inexistente', new.action_plan_id
      using errcode = '23503';
  end if;

  if v_scope is distinct from 'organization' or v_applicability is distinct from 'selected_units' then
    raise exception 'SUP-D01-B: associacoes so permitidas quando scope_type=organization e unit_applicability=selected_units'
      using errcode = '23514';
  end if;

  if not app_auth.unit_belongs_to_organization(new.unit_id, v_org) then
    raise exception 'SUP-D01-B: unit_id % fora da organization do plano', new.unit_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger action_plan_unit_applicabilities_row_guard
before insert or update
on public.action_plan_unit_applicabilities
for each row
execute function public.enforce_action_plan_unit_applicability_row();

-- Coerencia deferred: selected_units => >=1; all_units/unit => 0
create or replace function public.enforce_campaign_applicability_cardinality()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_applicability text;
  v_scope text;
  v_count integer;
begin
  if tg_table_name = 'campaigns' then
    v_campaign_id := coalesce(new.id, old.id);
  else
    v_campaign_id := coalesce(new.campaign_id, old.campaign_id);
  end if;

  select c.scope_type, c.unit_applicability
    into v_scope, v_applicability
  from public.campaigns c
  where c.id = v_campaign_id;

  if not found then
    return null;
  end if;

  select count(*)::integer into v_count
  from public.campaign_unit_applicabilities cua
  where cua.campaign_id = v_campaign_id;

  if v_scope = 'organization' and v_applicability = 'selected_units' and v_count < 1 then
    raise exception 'SUP-D01-B: selected_units exige ao menos uma associacao campanha-unidade'
      using errcode = '23514';
  end if;

  if (v_scope = 'unit' or (v_scope = 'organization' and v_applicability = 'all_units')) and v_count > 0 then
    raise exception 'SUP-D01-B: all_units/unit nao admite associacoes em campaign_unit_applicabilities'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger campaigns_applicability_cardinality
after insert or update of scope_type, unit_applicability
on public.campaigns
deferrable initially deferred
for each row
execute function public.enforce_campaign_applicability_cardinality();

create constraint trigger campaign_unit_applicabilities_cardinality
after insert or update or delete
on public.campaign_unit_applicabilities
deferrable initially deferred
for each row
execute function public.enforce_campaign_applicability_cardinality();

create or replace function public.enforce_action_plan_applicability_cardinality()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_applicability text;
  v_scope text;
  v_count integer;
begin
  if tg_table_name = 'action_plans' then
    v_plan_id := coalesce(new.id, old.id);
  else
    v_plan_id := coalesce(new.action_plan_id, old.action_plan_id);
  end if;

  select p.scope_type, p.unit_applicability
    into v_scope, v_applicability
  from public.action_plans p
  where p.id = v_plan_id;

  if not found then
    return null;
  end if;

  select count(*)::integer into v_count
  from public.action_plan_unit_applicabilities apua
  where apua.action_plan_id = v_plan_id;

  if v_scope = 'organization' and v_applicability = 'selected_units' and v_count < 1 then
    raise exception 'SUP-D01-B: selected_units exige ao menos uma associacao plano-unidade'
      using errcode = '23514';
  end if;

  if (v_scope = 'unit' or (v_scope = 'organization' and v_applicability = 'all_units')) and v_count > 0 then
    raise exception 'SUP-D01-B: all_units/unit nao admite associacoes em action_plan_unit_applicabilities'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger action_plans_applicability_cardinality
after insert or update of scope_type, unit_applicability
on public.action_plans
deferrable initially deferred
for each row
execute function public.enforce_action_plan_applicability_cardinality();

create constraint trigger action_plan_unit_applicabilities_cardinality
after insert or update or delete
on public.action_plan_unit_applicabilities
deferrable initially deferred
for each row
execute function public.enforce_action_plan_applicability_cardinality();

-- Audiencia: organization_id fisico preexistente deve herdar da campanha (sem override de escopo)
create or replace function public.enforce_campaign_audience_inherits_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select c.organization_id into v_org
  from public.campaigns c
  where c.id = new.campaign_id;

  if v_org is null then
    raise exception 'SUP-D01-B: campaign_id % inexistente para audiencia', new.campaign_id
      using errcode = '23503';
  end if;

  if new.organization_id is distinct from v_org then
    raise exception 'SUP-D01-B: campaign_audiences.organization_id deve herdar campaigns.organization_id'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger campaign_audiences_inherit_org
before insert or update of campaign_id, organization_id
on public.campaign_audiences
for each row
execute function public.enforce_campaign_audience_inherits_org();

-- Triggers SECURITY DEFINER: uso interno apenas (sem EXECUTE para PUBLIC/authenticated)
revoke all on function public.enforce_campaign_organization_immutable() from public;
revoke all on function public.enforce_action_plan_organization_immutable() from public;
revoke all on function public.enforce_campaign_unit_belongs_to_org() from public;
revoke all on function public.enforce_action_plan_unit_belongs_to_org() from public;
revoke all on function public.enforce_campaign_unit_applicability_row() from public;
revoke all on function public.enforce_action_plan_unit_applicability_row() from public;
revoke all on function public.enforce_campaign_applicability_cardinality() from public;
revoke all on function public.enforce_action_plan_applicability_cardinality() from public;
revoke all on function public.enforce_campaign_audience_inherits_org() from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.enforce_campaign_organization_immutable() from authenticated';
    execute 'revoke all on function public.enforce_action_plan_organization_immutable() from authenticated';
    execute 'revoke all on function public.enforce_campaign_unit_belongs_to_org() from authenticated';
    execute 'revoke all on function public.enforce_action_plan_unit_belongs_to_org() from authenticated';
    execute 'revoke all on function public.enforce_campaign_unit_applicability_row() from authenticated';
    execute 'revoke all on function public.enforce_action_plan_unit_applicability_row() from authenticated';
    execute 'revoke all on function public.enforce_campaign_applicability_cardinality() from authenticated';
    execute 'revoke all on function public.enforce_action_plan_applicability_cardinality() from authenticated';
    execute 'revoke all on function public.enforce_campaign_audience_inherits_org() from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.enforce_campaign_organization_immutable() from anon';
    execute 'revoke all on function public.enforce_action_plan_organization_immutable() from anon';
    execute 'revoke all on function public.enforce_campaign_unit_belongs_to_org() from anon';
    execute 'revoke all on function public.enforce_action_plan_unit_belongs_to_org() from anon';
    execute 'revoke all on function public.enforce_campaign_unit_applicability_row() from anon';
    execute 'revoke all on function public.enforce_action_plan_unit_applicability_row() from anon';
    execute 'revoke all on function public.enforce_campaign_applicability_cardinality() from anon';
    execute 'revoke all on function public.enforce_action_plan_applicability_cardinality() from anon';
    execute 'revoke all on function public.enforce_campaign_audience_inherits_org() from anon';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) RLS: substituir JWT legado; habilitar audiencias/associacoes
-- ---------------------------------------------------------------------------
drop policy if exists manager_campaigns_same_org on public.campaigns;
drop policy if exists manager_action_plans_same_org on public.action_plans;

alter table public.campaign_audiences enable row level security;
alter table public.campaign_unit_applicabilities enable row level security;
alter table public.action_plan_unit_applicabilities enable row level security;

-- campaigns
create policy campaigns_select_collective on public.campaigns
for select to authenticated
using (
  app_auth.can_select_campaign(
    organization_id,
    scope_type,
    unit_id,
    unit_applicability,
    id
  )
);

create policy campaigns_insert_collective on public.campaigns
for insert to authenticated
with check (
  app_auth.can_write_campaign(organization_id, scope_type, unit_id)
);

create policy campaigns_update_collective on public.campaigns
for update to authenticated
using (
  app_auth.can_write_campaign(organization_id, scope_type, unit_id)
)
with check (
  app_auth.can_write_campaign(organization_id, scope_type, unit_id)
);

create policy campaigns_delete_collective on public.campaigns
for delete to authenticated
using (
  app_auth.can_write_campaign(organization_id, scope_type, unit_id)
);

-- action_plans
create policy action_plans_select_collective on public.action_plans
for select to authenticated
using (
  app_auth.can_select_action_plan(
    organization_id,
    scope_type,
    unit_id,
    unit_applicability,
    id
  )
);

create policy action_plans_insert_collective on public.action_plans
for insert to authenticated
with check (
  app_auth.can_write_action_plan(organization_id, scope_type, unit_id)
);

create policy action_plans_update_collective on public.action_plans
for update to authenticated
using (
  app_auth.can_write_action_plan(organization_id, scope_type, unit_id)
)
with check (
  app_auth.can_write_action_plan(organization_id, scope_type, unit_id)
);

create policy action_plans_delete_collective on public.action_plans
for delete to authenticated
using (
  app_auth.can_write_action_plan(organization_id, scope_type, unit_id)
);

-- campaign_audiences: herda acesso da campanha; sem acesso nominal
create policy campaign_audiences_select_collective on public.campaign_audiences
for select to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and c.organization_id = campaign_audiences.organization_id
      and app_auth.can_select_campaign(
        c.organization_id,
        c.scope_type,
        c.unit_id,
        c.unit_applicability,
        c.id
      )
  )
);

create policy campaign_audiences_insert_collective on public.campaign_audiences
for insert to authenticated
with check (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and c.organization_id = organization_id
      and app_auth.can_write_campaign(c.organization_id, c.scope_type, c.unit_id)
  )
);

create policy campaign_audiences_update_collective on public.campaign_audiences
for update to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and c.organization_id = campaign_audiences.organization_id
      and app_auth.can_write_campaign(c.organization_id, c.scope_type, c.unit_id)
  )
)
with check (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and c.organization_id = organization_id
      and app_auth.can_write_campaign(c.organization_id, c.scope_type, c.unit_id)
  )
);

create policy campaign_audiences_delete_collective on public.campaign_audiences
for delete to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and c.organization_id = campaign_audiences.organization_id
      and app_auth.can_write_campaign(c.organization_id, c.scope_type, c.unit_id)
  )
);

-- associations
create policy campaign_unit_applicabilities_select on public.campaign_unit_applicabilities
for select to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and app_auth.can_select_campaign(
        c.organization_id,
        c.scope_type,
        c.unit_id,
        c.unit_applicability,
        c.id
      )
  )
);

create policy campaign_unit_applicabilities_insert on public.campaign_unit_applicabilities
for insert to authenticated
with check (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and app_auth.can_write_campaign(c.organization_id, c.scope_type, c.unit_id)
  )
);

create policy campaign_unit_applicabilities_update on public.campaign_unit_applicabilities
for update to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and app_auth.can_write_campaign(c.organization_id, c.scope_type, c.unit_id)
  )
)
with check (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and app_auth.can_write_campaign(c.organization_id, c.scope_type, c.unit_id)
  )
);

create policy campaign_unit_applicabilities_delete on public.campaign_unit_applicabilities
for delete to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and app_auth.can_write_campaign(c.organization_id, c.scope_type, c.unit_id)
  )
);

create policy action_plan_unit_applicabilities_select on public.action_plan_unit_applicabilities
for select to authenticated
using (
  exists (
    select 1
    from public.action_plans p
    where p.id = action_plan_id
      and app_auth.can_select_action_plan(
        p.organization_id,
        p.scope_type,
        p.unit_id,
        p.unit_applicability,
        p.id
      )
  )
);

create policy action_plan_unit_applicabilities_insert on public.action_plan_unit_applicabilities
for insert to authenticated
with check (
  exists (
    select 1
    from public.action_plans p
    where p.id = action_plan_id
      and app_auth.can_write_action_plan(p.organization_id, p.scope_type, p.unit_id)
  )
);

create policy action_plan_unit_applicabilities_update on public.action_plan_unit_applicabilities
for update to authenticated
using (
  exists (
    select 1
    from public.action_plans p
    where p.id = action_plan_id
      and app_auth.can_write_action_plan(p.organization_id, p.scope_type, p.unit_id)
  )
)
with check (
  exists (
    select 1
    from public.action_plans p
    where p.id = action_plan_id
      and app_auth.can_write_action_plan(p.organization_id, p.scope_type, p.unit_id)
  )
);

create policy action_plan_unit_applicabilities_delete on public.action_plan_unit_applicabilities
for delete to authenticated
using (
  exists (
    select 1
    from public.action_plans p
    where p.id = action_plan_id
      and app_auth.can_write_action_plan(p.organization_id, p.scope_type, p.unit_id)
  )
);

commit;
