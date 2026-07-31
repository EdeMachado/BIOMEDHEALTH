-- SUP-C03: plano de cuidado + acoes + evolucoes (SELECT/INSERT/UPDATE) por vinculo ativo.
-- Incremental sobre 0013. Nao altera ficha, agenda, carteira nem plano coletivo de gestao.
--
-- Modelo:
-- 1) care_plans = cabecalho clinico (plan_status) + lifecycle status (ativo/inativo);
-- 2) care_plan_actions = itens com action_status + lifecycle status;
-- 3) care_plan_events = historico append-only (estrutural/evolucao/reavaliacao/status);
-- 4) no maximo um plano nao encerrado por (org, professional, patient) quando status=ativo;
-- 5) plano encerrado e imutavel; novo plano apos conclusao/suspensao.
--
-- Justificativa SECURITY DEFINER / helpers:
-- 1) professional_assignments ainda usa RLS legada (0002) por claims JWT;
-- 2) identidade profissional decorre de auth.uid();
-- 3) snapshots de eventos automaticos precisam inserir sem grants amplos de escrita arbitraria.

begin;

do $$
begin
  if not exists (select 1 from pg_class where oid = 'public.care_plans'::regclass and relkind = 'r') then
    raise exception 'SUP-C03: tabela public.care_plans ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.care_plan_actions'::regclass and relkind = 'r') then
    raise exception 'SUP-C03: tabela public.care_plan_actions ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'SUP-C03: funcao app_auth.has_active_clinical_assignment(uuid,uuid) ausente (requer 0010).';
  end if;
  if to_regprocedure('public.can_manage_clinical_record(uuid)') is null then
    raise exception 'SUP-C03: dependencia 0013 (can_manage_clinical_record) ausente.';
  end if;
  if to_regclass('public.care_plan_events') is not null then
    raise exception 'SUP-C03: tabela public.care_plan_events ja existe; reaplicar somente apos rollback 0014.';
  end if;
end $$;

-- ===== care_plans: colunas clinicas =====
alter table public.care_plans add column if not exists plan_status text;
alter table public.care_plans add column if not exists general_objective text;
alter table public.care_plans add column if not exists starts_on date;
alter table public.care_plans add column if not exists target_date date;
alter table public.care_plans add column if not exists reassessment_due_on date;
alter table public.care_plans add column if not exists last_reassessed_at timestamptz;
alter table public.care_plans add column if not exists clinical_notes text;
alter table public.care_plans add column if not exists created_by uuid;
alter table public.care_plans add column if not exists updated_by uuid;
alter table public.care_plans add column if not exists closed_at timestamptz;
alter table public.care_plans add column if not exists closed_by uuid;
alter table public.care_plans add column if not exists suspension_reason text;
alter table public.care_plans add column if not exists schema_version text;
alter table public.care_plans add column if not exists clinical_record_id uuid;

-- Backfill deterministico (sem inventar conteudo clinico):
-- plan_status planejado; objetivo geral = title; autoria = professional_id; starts_on = created_at::date.
update public.care_plans
   set plan_status = coalesce(plan_status, 'planejado'),
       general_objective = coalesce(nullif(btrim(general_objective), ''), nullif(btrim(title), ''), 'Plano sem objetivo informado'),
       starts_on = coalesce(starts_on, created_at::date),
       clinical_notes = coalesce(clinical_notes, ''),
       created_by = coalesce(created_by, professional_id),
       updated_by = coalesce(updated_by, professional_id),
       schema_version = coalesce(schema_version, 'care_plan.v1')
 where plan_status is null
    or general_objective is null
    or starts_on is null
    or created_by is null
    or updated_by is null
    or schema_version is null
    or clinical_notes is null;

alter table public.care_plans alter column plan_status set default 'planejado';
alter table public.care_plans alter column general_objective set default '';
alter table public.care_plans alter column clinical_notes set default '';
alter table public.care_plans alter column schema_version set default 'care_plan.v1';

alter table public.care_plans alter column plan_status set not null;
alter table public.care_plans alter column general_objective set not null;
alter table public.care_plans alter column starts_on set not null;
alter table public.care_plans alter column clinical_notes set not null;
alter table public.care_plans alter column created_by set not null;
alter table public.care_plans alter column updated_by set not null;
alter table public.care_plans alter column schema_version set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'care_plans_plan_status_check'
      and conrelid = 'public.care_plans'::regclass
  ) then
    alter table public.care_plans
      add constraint care_plans_plan_status_check
      check (plan_status in ('planejado', 'em_andamento', 'concluido', 'suspenso'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'care_plans_schema_version_check'
      and conrelid = 'public.care_plans'::regclass
  ) then
    alter table public.care_plans
      add constraint care_plans_schema_version_check
      check (schema_version ~ '^care_plan\.v[0-9]+$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'care_plans_closed_consistency_check'
      and conrelid = 'public.care_plans'::regclass
  ) then
    alter table public.care_plans
      add constraint care_plans_closed_consistency_check
      check (
        (
          plan_status in ('planejado', 'em_andamento')
          and closed_at is null
          and closed_by is null
          and suspension_reason is null
        )
        or (
          plan_status = 'concluido'
          and closed_at is not null
          and closed_by is not null
          and suspension_reason is null
        )
        or (
          plan_status = 'suspenso'
          and closed_at is not null
          and closed_by is not null
          and suspension_reason is not null
          and btrim(suspension_reason) <> ''
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'care_plans_clinical_record_fk'
      and conrelid = 'public.care_plans'::regclass
  ) then
    alter table public.care_plans
      add constraint care_plans_clinical_record_fk
      foreign key (clinical_record_id) references public.clinical_records(id);
  end if;
end $$;

create index if not exists care_plans_organization_id_idx on public.care_plans (organization_id);
create index if not exists care_plans_professional_id_idx on public.care_plans (professional_id);
create index if not exists care_plans_user_id_idx on public.care_plans (user_id);

-- Reapply/legado: apos rollback, plan_status some e o backfill reabre todos como planejado.
-- Sem inventar conteudo clinico: demove lifecycle status=inativo nos duplicados, mantendo o mais recente.
with ranked as (
  select id,
         row_number() over (
           partition by organization_id, professional_id, user_id
           order by updated_at desc nulls last, created_at desc nulls last, id desc
         ) as rn
    from public.care_plans
   where status = 'ativo'
     and plan_status in ('planejado', 'em_andamento')
)
update public.care_plans p
   set status = 'inativo'
  from ranked r
 where p.id = r.id
   and r.rn > 1;

create unique index if not exists care_plans_one_open_unique_idx
  on public.care_plans (organization_id, professional_id, user_id)
  where status = 'ativo' and plan_status in ('planejado', 'em_andamento');

-- ===== care_plan_actions: colunas clinicas =====
alter table public.care_plan_actions add column if not exists user_id uuid;
alter table public.care_plan_actions add column if not exists professional_id uuid;
alter table public.care_plan_actions add column if not exists specific_objective text;
alter table public.care_plan_actions add column if not exists frequency text;
alter table public.care_plan_actions add column if not exists action_status text;
alter table public.care_plan_actions add column if not exists display_order int;
alter table public.care_plan_actions add column if not exists notes text;
alter table public.care_plan_actions add column if not exists created_by uuid;
alter table public.care_plan_actions add column if not exists updated_by uuid;
alter table public.care_plan_actions add column if not exists completed_at timestamptz;

update public.care_plan_actions a
   set user_id = coalesce(a.user_id, p.user_id),
       professional_id = coalesce(a.professional_id, p.professional_id),
       specific_objective = coalesce(nullif(btrim(a.specific_objective), ''), left(a.action_text, 200)),
       frequency = coalesce(a.frequency, ''),
       action_status = coalesce(a.action_status, 'pendente'),
       display_order = coalesce(a.display_order, 1),
       notes = coalesce(a.notes, ''),
       created_by = coalesce(a.created_by, p.professional_id),
       updated_by = coalesce(a.updated_by, p.professional_id)
  from public.care_plans p
 where p.id = a.care_plan_id
   and (
     a.user_id is null
     or a.professional_id is null
     or a.specific_objective is null
     or a.frequency is null
     or a.action_status is null
     or a.display_order is null
     or a.notes is null
     or a.created_by is null
     or a.updated_by is null
   );

alter table public.care_plan_actions alter column specific_objective set default '';
alter table public.care_plan_actions alter column frequency set default '';
alter table public.care_plan_actions alter column action_status set default 'pendente';
alter table public.care_plan_actions alter column display_order set default 1;
alter table public.care_plan_actions alter column notes set default '';

alter table public.care_plan_actions alter column user_id set not null;
alter table public.care_plan_actions alter column professional_id set not null;
alter table public.care_plan_actions alter column specific_objective set not null;
alter table public.care_plan_actions alter column frequency set not null;
alter table public.care_plan_actions alter column action_status set not null;
alter table public.care_plan_actions alter column display_order set not null;
alter table public.care_plan_actions alter column notes set not null;
alter table public.care_plan_actions alter column created_by set not null;
alter table public.care_plan_actions alter column updated_by set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'care_plan_actions_action_status_check'
      and conrelid = 'public.care_plan_actions'::regclass
  ) then
    alter table public.care_plan_actions
      add constraint care_plan_actions_action_status_check
      check (action_status in ('pendente', 'em_andamento', 'concluida', 'suspensa', 'cancelada'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'care_plan_actions_completed_consistency_check'
      and conrelid = 'public.care_plan_actions'::regclass
  ) then
    alter table public.care_plan_actions
      add constraint care_plan_actions_completed_consistency_check
      check (
        (action_status = 'concluida' and completed_at is not null)
        or (action_status <> 'concluida' and completed_at is null)
      );
  end if;
end $$;

create index if not exists care_plan_actions_plan_id_idx on public.care_plan_actions (care_plan_id);
create index if not exists care_plan_actions_org_pro_user_idx
  on public.care_plan_actions (organization_id, professional_id, user_id);

-- ===== historico append-only =====
create table public.care_plan_events (
  id uuid primary key default gen_random_uuid(),
  care_plan_id uuid not null references public.care_plans(id),
  care_plan_action_id uuid references public.care_plan_actions(id),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null,
  professional_id uuid not null,
  event_kind text not null,
  event_category text not null,
  payload jsonb not null default '{}'::jsonb,
  note text,
  version_before int,
  version_after int,
  authored_by uuid not null,
  created_at timestamptz not null default now(),
  constraint care_plan_events_event_kind_check
    check (event_kind in (
      'create',
      'plan_update',
      'action_create',
      'action_update',
      'action_status',
      'plan_status',
      'evolution',
      'reassessment',
      'conclude',
      'suspend'
    )),
  constraint care_plan_events_event_category_check
    check (event_category in ('structural', 'clinical_evolution', 'reassessment', 'status_change'))
);

create index if not exists care_plan_events_plan_id_idx
  on public.care_plan_events (care_plan_id, created_at desc);

create index if not exists care_plan_events_org_pro_user_idx
  on public.care_plan_events (organization_id, professional_id, user_id);

create function public.can_manage_clinical_care_plan(p_organization_id uuid)
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

revoke all on function public.can_manage_clinical_care_plan(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.can_manage_clinical_care_plan(uuid) from anon';
  end if;
end $$;
grant execute on function public.can_manage_clinical_care_plan(uuid) to authenticated;

create function app_auth.append_care_plan_event(
  p_care_plan_id uuid,
  p_care_plan_action_id uuid,
  p_organization_id uuid,
  p_user_id uuid,
  p_professional_id uuid,
  p_event_kind text,
  p_event_category text,
  p_payload jsonb,
  p_note text,
  p_version_before int,
  p_version_after int,
  p_authored_by uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.care_plan_events (
    care_plan_id,
    care_plan_action_id,
    organization_id,
    user_id,
    professional_id,
    event_kind,
    event_category,
    payload,
    note,
    version_before,
    version_after,
    authored_by
  ) values (
    p_care_plan_id,
    p_care_plan_action_id,
    p_organization_id,
    p_user_id,
    p_professional_id,
    p_event_kind,
    p_event_category,
    coalesce(p_payload, '{}'::jsonb),
    p_note,
    p_version_before,
    p_version_after,
    p_authored_by
  );
end;
$$;

create function app_auth.snapshot_care_plan_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_kind text;
  v_category text;
  v_note text := null;
begin
  if tg_op = 'INSERT' then
    v_kind := 'create';
    v_category := 'structural';
  elsif old.plan_status is distinct from new.plan_status then
    if new.plan_status = 'concluido' then
      v_kind := 'conclude';
    elsif new.plan_status = 'suspenso' then
      v_kind := 'suspend';
      v_note := new.suspension_reason;
    else
      v_kind := 'plan_status';
    end if;
    v_category := 'status_change';
  else
    v_kind := 'plan_update';
    v_category := 'structural';
  end if;

  perform app_auth.append_care_plan_event(
    new.id,
    null,
    new.organization_id,
    new.user_id,
    new.professional_id,
    v_kind,
    v_category,
    jsonb_build_object(
      'title', new.title,
      'general_objective', new.general_objective,
      'plan_status', new.plan_status,
      'starts_on', new.starts_on,
      'target_date', new.target_date,
      'reassessment_due_on', new.reassessment_due_on,
      'clinical_notes', new.clinical_notes,
      'schema_version', new.schema_version
    ),
    v_note,
    case when tg_op = 'UPDATE' then old.version else null end,
    new.version,
    new.updated_by
  );
  return new;
end;
$$;

create function app_auth.snapshot_care_plan_action_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_kind text;
  v_category text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'action_create';
    v_category := 'structural';
  elsif old.action_status is distinct from new.action_status then
    v_kind := 'action_status';
    v_category := 'status_change';
  else
    v_kind := 'action_update';
    v_category := 'structural';
  end if;

  perform app_auth.append_care_plan_event(
    new.care_plan_id,
    new.id,
    new.organization_id,
    new.user_id,
    new.professional_id,
    v_kind,
    v_category,
    jsonb_build_object(
      'specific_objective', new.specific_objective,
      'action_text', new.action_text,
      'frequency', new.frequency,
      'due_date', new.due_date,
      'action_status', new.action_status,
      'display_order', new.display_order,
      'notes', new.notes,
      'completed_at', new.completed_at
    ),
    null,
    case when tg_op = 'UPDATE' then old.version else null end,
    new.version,
    new.updated_by
  );
  return new;
end;
$$;

create function app_auth.guard_care_plan_mutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.plan_status in ('concluido', 'suspenso') then
    raise exception 'SUP-C03: plano de cuidado encerrado e imutavel'
      using errcode = '42501';
  end if;

  if new.professional_id is distinct from old.professional_id
     or new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'SUP-C03: chaves de escopo do plano sao imutaveis'
      using errcode = '42501';
  end if;

  if new.version <> old.version + 1 then
    raise exception 'SUP-C03: version deve incrementar em +1 (otimismo)'
      using errcode = '23514';
  end if;

  if old.plan_status = 'planejado' and new.plan_status = 'em_andamento'
     and (btrim(new.general_objective) = '' or btrim(new.title) = '') then
    raise exception 'SUP-C03: em_andamento exige titulo e objetivo geral'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function app_auth.guard_care_plan_action_mutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan public.care_plans%rowtype;
begin
  select * into v_plan from public.care_plans where id = new.care_plan_id;
  if not found then
    raise exception 'SUP-C03: plano da acao ausente' using errcode = '23503';
  end if;

  if v_plan.plan_status in ('concluido', 'suspenso') then
    raise exception 'SUP-C03: acoes de plano encerrado sao imutaveis'
      using errcode = '42501';
  end if;

  if new.organization_id is distinct from v_plan.organization_id
     or new.user_id is distinct from v_plan.user_id
     or new.professional_id is distinct from v_plan.professional_id then
    raise exception 'SUP-C03: acao deve herdar escopo do plano'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.version <> old.version + 1 then
      raise exception 'SUP-C03: version da acao deve incrementar em +1'
        using errcode = '23514';
    end if;
    if new.care_plan_id is distinct from old.care_plan_id then
      raise exception 'SUP-C03: care_plan_id da acao e imutavel'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_snapshot_care_plan_event on public.care_plans;
create trigger trg_snapshot_care_plan_event
after insert or update on public.care_plans
for each row execute function app_auth.snapshot_care_plan_event();

drop trigger if exists trg_guard_care_plan_mutability on public.care_plans;
create trigger trg_guard_care_plan_mutability
before update on public.care_plans
for each row execute function app_auth.guard_care_plan_mutability();

drop trigger if exists trg_snapshot_care_plan_action_event on public.care_plan_actions;
create trigger trg_snapshot_care_plan_action_event
after insert or update on public.care_plan_actions
for each row execute function app_auth.snapshot_care_plan_action_event();

drop trigger if exists trg_guard_care_plan_action_mutability on public.care_plan_actions;
create trigger trg_guard_care_plan_action_mutability
before insert or update on public.care_plan_actions
for each row execute function app_auth.guard_care_plan_action_mutability();

-- Policies: substitui legado 0002
drop policy if exists care_plan_only_allowed_roles on public.care_plans;

alter table public.care_plans enable row level security;
alter table public.care_plan_actions enable row level security;
alter table public.care_plan_events enable row level security;

create policy care_plans_select_own on public.care_plans
for select to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

create policy care_plans_insert_own on public.care_plans
for insert to authenticated
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and plan_status in ('planejado', 'em_andamento')
  and closed_at is null
  and closed_by is null
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

create policy care_plans_update_own on public.care_plans
for update to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and plan_status in ('planejado', 'em_andamento')
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
)
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and updated_by = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
  and (
    (plan_status in ('planejado', 'em_andamento') and closed_at is null and closed_by is null)
    or (plan_status = 'concluido' and closed_at is not null and closed_by = auth.uid())
    or (
      plan_status = 'suspenso'
      and closed_at is not null
      and closed_by = auth.uid()
      and suspension_reason is not null
      and btrim(suspension_reason) <> ''
    )
  )
);

create policy care_plan_actions_select_own on public.care_plan_actions
for select to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

create policy care_plan_actions_insert_own on public.care_plan_actions
for insert to authenticated
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
  and exists (
    select 1 from public.care_plans p
    where p.id = care_plan_id
      and p.organization_id = organization_id
      and p.user_id = user_id
      and p.professional_id = professional_id
      and p.plan_status in ('planejado', 'em_andamento')
  )
);

create policy care_plan_actions_update_own on public.care_plan_actions
for update to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
  and exists (
    select 1 from public.care_plans p
    where p.id = care_plan_id
      and p.plan_status in ('planejado', 'em_andamento')
  )
)
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and updated_by = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
  and exists (
    select 1 from public.care_plans p
    where p.id = care_plan_id
      and p.organization_id = organization_id
      and p.user_id = user_id
      and p.professional_id = professional_id
      and p.plan_status in ('planejado', 'em_andamento')
  )
);

create policy care_plan_events_select_own on public.care_plan_events
for select to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

-- Evolucao/reavaliacao clinicas inseridas pela app (demais eventos via trigger SECURITY DEFINER).
create policy care_plan_events_insert_clinical_notes on public.care_plan_events
for insert to authenticated
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and authored_by = auth.uid()
  and event_kind in ('evolution', 'reassessment')
  and event_category in ('clinical_evolution', 'reassessment')
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
  and exists (
    select 1 from public.care_plans p
    where p.id = care_plan_id
      and p.organization_id = organization_id
      and p.user_id = user_id
      and p.professional_id = professional_id
      and p.plan_status in ('planejado', 'em_andamento')
  )
);

revoke all on table public.care_plans from public;
revoke all on table public.care_plan_actions from public;
revoke all on table public.care_plan_events from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.care_plans from anon';
    execute 'revoke all on table public.care_plan_actions from anon';
    execute 'revoke all on table public.care_plan_events from anon';
  end if;
end $$;

revoke all on table public.care_plans from authenticated;
revoke all on table public.care_plan_actions from authenticated;
revoke all on table public.care_plan_events from authenticated;

grant select on table public.care_plans to authenticated;
grant insert (
  organization_id, user_id, professional_id, title, status, version,
  plan_status, general_objective, starts_on, target_date, reassessment_due_on,
  last_reassessed_at, clinical_notes, created_by, updated_by, closed_at, closed_by,
  suspension_reason, schema_version, clinical_record_id
) on table public.care_plans to authenticated;
grant update (
  title, status, version, plan_status, general_objective, starts_on, target_date,
  reassessment_due_on, last_reassessed_at, clinical_notes, updated_by, updated_at,
  closed_at, closed_by, suspension_reason, schema_version, clinical_record_id
) on table public.care_plans to authenticated;

grant select on table public.care_plan_actions to authenticated;
grant insert (
  organization_id, care_plan_id, user_id, professional_id, action_text, due_date,
  status, version, specific_objective, frequency, action_status, display_order,
  notes, created_by, updated_by, completed_at
) on table public.care_plan_actions to authenticated;
grant update (
  action_text, due_date, status, version, specific_objective, frequency, action_status,
  display_order, notes, updated_by, updated_at, completed_at
) on table public.care_plan_actions to authenticated;

grant select on table public.care_plan_events to authenticated;
grant insert (
  care_plan_id, care_plan_action_id, organization_id, user_id, professional_id,
  event_kind, event_category, payload, note, version_before, version_after, authored_by
) on table public.care_plan_events to authenticated;

-- Sem DELETE. Sem UPDATE em care_plan_events.

commit;
