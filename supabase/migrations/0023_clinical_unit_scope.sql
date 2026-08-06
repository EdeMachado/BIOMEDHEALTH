-- WP-04.4 Clinical Unit Scope Closure
-- Adds unit_id to clinical operational facts; fail-closed on null unit;
-- narrows helpers/policies to unit-scoped assignment + role.
-- Does NOT amplify access. Does NOT touch collective D01/D02.

begin;

do $$
begin
  if to_regclass('public.organization_units') is null then
    raise exception 'WP-04.4: organization_units ausente';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'WP-04.4: has_active_clinical_assignment(uuid,uuid) ausente';
  end if;
  if to_regprocedure('app_auth.has_active_role(uuid,text[],uuid)') is null then
    raise exception 'WP-04.4: has_active_role ausente';
  end if;
end $$;

-- ===== Columns =====
alter table public.professional_assignments
  add column if not exists unit_id uuid references public.organization_units(id);

alter table public.appointments
  add column if not exists unit_id uuid references public.organization_units(id);

alter table public.clinical_records
  add column if not exists unit_id uuid references public.organization_units(id);

alter table public.clinical_record_versions
  add column if not exists unit_id uuid references public.organization_units(id);

alter table public.care_plans
  add column if not exists unit_id uuid references public.organization_units(id);

alter table public.care_plan_actions
  add column if not exists unit_id uuid references public.organization_units(id);

alter table public.care_plan_events
  add column if not exists unit_id uuid references public.organization_units(id);

-- Backfill only when org has exactly one unit (deterministic, no invention across units)
update public.professional_assignments pa
   set unit_id = ou.unit_id
  from (
    select organization_id, min(id::text)::uuid as unit_id
      from public.organization_units
     group by organization_id
    having count(*) = 1
  ) ou
 where pa.organization_id = ou.organization_id
   and pa.unit_id is null;

update public.appointments t
   set unit_id = ou.unit_id
  from (
    select organization_id, min(id::text)::uuid as unit_id
      from public.organization_units
     group by organization_id
    having count(*) = 1
  ) ou
 where t.organization_id = ou.organization_id
   and t.unit_id is null;

update public.clinical_records t
   set unit_id = ou.unit_id
  from (
    select organization_id, min(id::text)::uuid as unit_id
      from public.organization_units
     group by organization_id
    having count(*) = 1
  ) ou
 where t.organization_id = ou.organization_id
   and t.unit_id is null;

update public.clinical_record_versions t
   set unit_id = ou.unit_id
  from (
    select organization_id, min(id::text)::uuid as unit_id
      from public.organization_units
     group by organization_id
    having count(*) = 1
  ) ou
 where t.organization_id = ou.organization_id
   and t.unit_id is null;

update public.care_plans t
   set unit_id = ou.unit_id
  from (
    select organization_id, min(id::text)::uuid as unit_id
      from public.organization_units
     group by organization_id
    having count(*) = 1
  ) ou
 where t.organization_id = ou.organization_id
   and t.unit_id is null;

update public.care_plan_actions t
   set unit_id = coalesce(
     (select cp.unit_id from public.care_plans cp where cp.id = t.care_plan_id),
     ou.unit_id
   )
  from (
    select organization_id, min(id::text)::uuid as unit_id
      from public.organization_units
     group by organization_id
    having count(*) = 1
  ) ou
 where t.organization_id = ou.organization_id
   and t.unit_id is null;

update public.care_plan_events t
   set unit_id = coalesce(
     (select cp.unit_id from public.care_plans cp where cp.id = t.care_plan_id),
     ou.unit_id
   )
  from (
    select organization_id, min(id::text)::uuid as unit_id
      from public.organization_units
     group by organization_id
    having count(*) = 1
  ) ou
 where t.organization_id = ou.organization_id
   and t.unit_id is null;

-- Org×unit integrity trigger (shared)
create or replace function app_auth.enforce_clinical_unit_org_match()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.unit_id is null then
    raise exception 'WP-04.4: unit_id obrigatorio em fato clinico (fail-closed)'
      using errcode = '23514';
  end if;
  if not exists (
    select 1
      from public.organization_units ou
     where ou.id = new.unit_id
       and ou.organization_id = new.organization_id
  ) then
    raise exception 'WP-04.4: unit_id nao pertence a organization_id'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pa_unit_org on public.professional_assignments;
create trigger trg_pa_unit_org
  before insert or update of unit_id, organization_id
  on public.professional_assignments
  for each row execute function app_auth.enforce_clinical_unit_org_match();

drop trigger if exists trg_appointments_unit_org on public.appointments;
create trigger trg_appointments_unit_org
  before insert or update of unit_id, organization_id
  on public.appointments
  for each row execute function app_auth.enforce_clinical_unit_org_match();

drop trigger if exists trg_clinical_records_unit_org on public.clinical_records;
create trigger trg_clinical_records_unit_org
  before insert or update of unit_id, organization_id
  on public.clinical_records
  for each row execute function app_auth.enforce_clinical_unit_org_match();

drop trigger if exists trg_care_plans_unit_org on public.care_plans;
create trigger trg_care_plans_unit_org
  before insert or update of unit_id, organization_id
  on public.care_plans
  for each row execute function app_auth.enforce_clinical_unit_org_match();

drop trigger if exists trg_care_plan_actions_unit_org on public.care_plan_actions;
create trigger trg_care_plan_actions_unit_org
  before insert or update of unit_id, organization_id
  on public.care_plan_actions
  for each row execute function app_auth.enforce_clinical_unit_org_match();

drop trigger if exists trg_care_plan_events_unit_org on public.care_plan_events;
create trigger trg_care_plan_events_unit_org
  before insert or update of unit_id, organization_id
  on public.care_plan_events
  for each row execute function app_auth.enforce_clinical_unit_org_match();

-- Versions: allow trigger insert with unit; reject null
drop trigger if exists trg_clinical_record_versions_unit_org on public.clinical_record_versions;
create trigger trg_clinical_record_versions_unit_org
  before insert or update of unit_id, organization_id
  on public.clinical_record_versions
  for each row execute function app_auth.enforce_clinical_unit_org_match();

-- ===== Helpers =====

-- 3-arg: fail-closed on null unit
create or replace function app_auth.has_active_clinical_assignment(
  target_organization_id uuid,
  target_user_id uuid,
  target_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and target_organization_id is not null
    and target_user_id is not null
    and target_unit_id is not null
    and app_auth.has_active_org_link(target_organization_id)
    and app_auth.has_active_role(
      target_organization_id,
      array['medico', 'profissional_saude']::text[],
      target_unit_id
    )
    and exists (
      select 1
      from public.professional_assignments pa
      where pa.organization_id = target_organization_id
        and pa.user_id = target_user_id
        and pa.professional_id = auth.uid()
        and pa.status = 'ativo'
        and pa.unit_id = target_unit_id
    );
$$;

revoke all on function app_auth.has_active_clinical_assignment(uuid, uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function app_auth.has_active_clinical_assignment(uuid, uuid, uuid) from anon';
  end if;
end $$;
grant execute on function app_auth.has_active_clinical_assignment(uuid, uuid, uuid) to authenticated;

-- 2-arg: unit-aware via assignment.unit_id (never null role scope)
create or replace function app_auth.has_active_clinical_assignment(
  target_organization_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and target_organization_id is not null
    and target_user_id is not null
    and app_auth.has_active_org_link(target_organization_id)
    and exists (
      select 1
      from public.professional_assignments pa
      where pa.organization_id = target_organization_id
        and pa.user_id = target_user_id
        and pa.professional_id = auth.uid()
        and pa.status = 'ativo'
        and pa.unit_id is not null
        and app_auth.has_active_role(
          target_organization_id,
          array['medico', 'profissional_saude']::text[],
          pa.unit_id
        )
    );
$$;

-- Supervisor: 2-arg unit-scoped (fail-closed on null)
create or replace function public.can_supervise_clinical_care_plan(
  p_organization_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and p_organization_id is not null
    and p_unit_id is not null
    and app_auth.has_active_org_link(p_organization_id)
    and app_auth.has_active_role(
      p_organization_id,
      array['gestor_clinico']::text[],
      p_unit_id
    );
$$;

revoke all on function public.can_supervise_clinical_care_plan(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.can_supervise_clinical_care_plan(uuid, uuid) from anon';
  end if;
end $$;
grant execute on function public.can_supervise_clinical_care_plan(uuid, uuid) to authenticated;

-- 1-arg: no longer org-wide — always false (fail-closed)
create or replace function public.can_supervise_clinical_care_plan(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select false;
$$;

-- Portfolio: role must match assignment unit; expose unit_id; exclude null units
create or replace function public.can_list_linked_clinical_portfolio(p_organization_id uuid)
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
    and exists (
      select 1
      from public.professional_assignments pa
      where pa.organization_id = p_organization_id
        and pa.professional_id = auth.uid()
        and pa.status = 'ativo'
        and pa.unit_id is not null
        and app_auth.has_active_role(
          p_organization_id,
          array['medico', 'profissional_saude']::text[],
          pa.unit_id
        )
    );
$$;

drop function if exists public.list_linked_clinical_patients(uuid);

create function public.list_linked_clinical_patients(p_organization_id uuid)
returns table (
  patient_user_id uuid,
  organization_id uuid,
  unit_id uuid,
  assignment_status text,
  assignment_reason text,
  display_name text
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    scoped.patient_user_id,
    scoped.organization_id,
    scoped.unit_id,
    scoped.assignment_status,
    scoped.assignment_reason,
    scoped.display_name
  from (
    select distinct on (pa.user_id, pa.unit_id)
      pa.user_id as patient_user_id,
      pa.organization_id,
      pa.unit_id,
      pa.status as assignment_status,
      pa.assignment_reason,
      coalesce(
        nullif(au.raw_user_meta_data ->> 'full_name', ''),
        nullif(au.raw_user_meta_data ->> 'name', ''),
        nullif(au.email, ''),
        'Paciente'
      ) as display_name
    from public.professional_assignments pa
    join public.user_organizations patient_uo
      on patient_uo.organization_id = pa.organization_id
     and patient_uo.user_id = pa.user_id
     and patient_uo.status = 'ativo'
    left join auth.users au
      on au.id = pa.user_id
    where auth.uid() is not null
      and p_organization_id is not null
      and pa.organization_id = p_organization_id
      and pa.professional_id = auth.uid()
      and pa.status = 'ativo'
      and pa.unit_id is not null
      and app_auth.has_active_org_link(p_organization_id)
      and app_auth.has_active_role(
        p_organization_id,
        array['medico', 'profissional_saude']::text[],
        pa.unit_id
      )
    order by pa.user_id asc, pa.unit_id asc
  ) scoped
  order by scoped.display_name asc, scoped.patient_user_id asc, scoped.unit_id asc;
$$;

revoke all on function public.list_linked_clinical_patients(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.list_linked_clinical_patients(uuid) from anon';
  end if;
end $$;
grant execute on function public.list_linked_clinical_patients(uuid) to authenticated;

-- Snapshot versions copy unit_id
create or replace function app_auth.snapshot_clinical_record_version()
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
    unit_id,
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
    new.unit_id,
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

-- append_care_plan_event: copy unit from plan
create or replace function app_auth.append_care_plan_event(
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
declare
  v_unit uuid;
begin
  select cp.unit_id into v_unit
    from public.care_plans cp
   where cp.id = p_care_plan_id;

  if v_unit is null then
    raise exception 'WP-04.4: care_plan sem unit_id (fail-closed)'
      using errcode = '23514';
  end if;

  insert into public.care_plan_events (
    care_plan_id,
    care_plan_action_id,
    organization_id,
    unit_id,
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
    v_unit,
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

-- ===== Policies: appointments =====
drop policy if exists appointments_select_clinical_own on public.appointments;
drop policy if exists appointments_insert_clinical_own on public.appointments;
drop policy if exists appointments_update_clinical_own on public.appointments;

create policy appointments_select_clinical_own on public.appointments
for select to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

create policy appointments_insert_clinical_own on public.appointments
for insert to authenticated
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

create policy appointments_update_clinical_own on public.appointments
for update to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
)
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

revoke all on table public.appointments from authenticated;
grant select on table public.appointments to authenticated;
grant insert (
  organization_id, unit_id, user_id, professional_id, starts_at, ends_at,
  appointment_status, appointment_type, status, version
) on table public.appointments to authenticated;
grant update (
  starts_at, ends_at, appointment_status, appointment_type, status, version, updated_at
) on table public.appointments to authenticated;

-- ===== Policies: clinical_records =====
drop policy if exists clinical_records_select_own on public.clinical_records;
drop policy if exists clinical_records_insert_own on public.clinical_records;
drop policy if exists clinical_records_update_own on public.clinical_records;
drop policy if exists clinical_records_select_clinical_own on public.clinical_records;
drop policy if exists clinical_records_insert_clinical_own on public.clinical_records;
drop policy if exists clinical_records_update_clinical_own on public.clinical_records;
drop policy if exists clinical_record_versions_select_own on public.clinical_record_versions;
drop policy if exists clinical_record_versions_select_clinical_own on public.clinical_record_versions;

create policy clinical_records_select_unit on public.clinical_records
for select to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

create policy clinical_records_insert_unit on public.clinical_records
for insert to authenticated
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and authored_by = auth.uid()
  and record_status = 'rascunho'
  and concluded_at is null
  and concluded_by is null
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

create policy clinical_records_update_unit on public.clinical_records
for update to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
  and (
    record_status = 'rascunho'
    or record_status = 'concluido'
  )
)
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and authored_by = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
  and (
    (record_status = 'rascunho' and concluded_at is null and concluded_by is null)
    or (record_status = 'concluido' and concluded_at is not null and concluded_by = auth.uid())
  )
);

create policy clinical_record_versions_select_unit on public.clinical_record_versions
for select to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

revoke all on table public.clinical_records from authenticated;
grant select on table public.clinical_records to authenticated;
grant insert (
  organization_id, unit_id, user_id, professional_id, summary, status, version,
  record_status, schema_version, sections, revision_number, authored_by,
  concluded_at, concluded_by
) on table public.clinical_records to authenticated;
grant update (
  summary, status, version, record_status, schema_version, sections,
  revision_number, authored_by, concluded_at, concluded_by, updated_at
) on table public.clinical_records to authenticated;
grant select on table public.clinical_record_versions to authenticated;

-- ===== Policies: care plans =====
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('care_plans', 'care_plan_actions', 'care_plan_events')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy care_plans_select_unit on public.care_plans
for select to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and (
    (professional_id = auth.uid()
      and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id))
    or public.can_supervise_clinical_care_plan(organization_id, unit_id)
  )
);

create policy care_plans_insert_unit on public.care_plans
for insert to authenticated
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

create policy care_plans_update_unit on public.care_plans
for update to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
)
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

create policy care_plan_actions_select_unit on public.care_plan_actions
for select to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and (
    (professional_id = auth.uid()
      and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id))
    or public.can_supervise_clinical_care_plan(organization_id, unit_id)
  )
);

create policy care_plan_actions_insert_unit on public.care_plan_actions
for insert to authenticated
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

create policy care_plan_actions_update_unit on public.care_plan_actions
for update to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
)
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
);

create policy care_plan_events_select_unit on public.care_plan_events
for select to authenticated
using (
  auth.uid() is not null
  and unit_id is not null
  and (
    (professional_id = auth.uid()
      and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id))
    or public.can_supervise_clinical_care_plan(organization_id, unit_id)
  )
);

create policy care_plan_events_insert_unit on public.care_plan_events
for insert to authenticated
with check (
  auth.uid() is not null
  and unit_id is not null
  and professional_id = auth.uid()
  and authored_by = auth.uid()
  and event_kind = 'evolution'
  and event_category = 'clinical_evolution'
  and app_auth.has_active_clinical_assignment(organization_id, user_id, unit_id)
  and exists (
    select 1 from public.care_plans p
    where p.id = care_plan_id
      and p.organization_id = organization_id
      and p.unit_id = unit_id
      and p.user_id = user_id
      and p.professional_id = professional_id
      and p.plan_status in ('planejado', 'em_andamento')
  )
);

revoke all on table public.care_plans from authenticated;
revoke all on table public.care_plan_actions from authenticated;
revoke all on table public.care_plan_events from authenticated;

grant select on table public.care_plans to authenticated;
grant insert (
  organization_id, unit_id, user_id, professional_id, title, status, version,
  plan_status, general_objective, starts_on, target_date, reassessment_due_on,
  clinical_notes, created_by, updated_by, schema_version, clinical_record_id
) on table public.care_plans to authenticated;
grant update (
  title, version, plan_status, general_objective, starts_on, target_date,
  reassessment_due_on, clinical_notes, updated_by, updated_at,
  closed_at, closed_by, suspension_reason, schema_version, clinical_record_id
) on table public.care_plans to authenticated;

grant select on table public.care_plan_actions to authenticated;
grant insert (
  organization_id, unit_id, care_plan_id, user_id, professional_id, action_text, due_date,
  status, version, specific_objective, frequency, action_status, display_order,
  notes, created_by, updated_by, completed_at
) on table public.care_plan_actions to authenticated;
grant update (
  action_text, due_date, status, version, specific_objective, frequency, action_status,
  display_order, notes, updated_by, updated_at, completed_at
) on table public.care_plan_actions to authenticated;

grant select on table public.care_plan_events to authenticated;
grant insert (
  care_plan_id, care_plan_action_id, organization_id, unit_id, user_id, professional_id,
  event_kind, event_category, payload, note, version_before, version_after, authored_by
) on table public.care_plan_events to authenticated;

create index if not exists professional_assignments_unit_idx
  on public.professional_assignments (organization_id, unit_id, professional_id)
  where status = 'ativo';

create index if not exists appointments_unit_idx
  on public.appointments (organization_id, unit_id, professional_id);

create index if not exists clinical_records_unit_idx
  on public.clinical_records (organization_id, unit_id, professional_id);

create index if not exists care_plans_unit_idx
  on public.care_plans (organization_id, unit_id, professional_id);

commit;
