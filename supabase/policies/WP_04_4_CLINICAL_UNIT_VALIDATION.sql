-- WP-04.4 clinical unit scope validation
-- Prefer local disposable DB after supabase db reset.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments' and column_name = 'unit_id'
  ) then
    raise exception 'WP-04.4 failed: appointments.unit_id missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'professional_assignments' and column_name = 'unit_id'
  ) then
    raise exception 'WP-04.4 failed: professional_assignments.unit_id missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinical_records' and column_name = 'unit_id'
  ) then
    raise exception 'WP-04.4 failed: clinical_records.unit_id missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'care_plans' and column_name = 'unit_id'
  ) then
    raise exception 'WP-04.4 failed: care_plans.unit_id missing';
  end if;

  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid,uuid)') is null then
    raise exception 'WP-04.4 failed: 3-arg has_active_clinical_assignment missing';
  end if;
  if to_regprocedure('public.can_supervise_clinical_care_plan(uuid,uuid)') is null then
    raise exception 'WP-04.4 failed: unit-scoped can_supervise missing';
  end if;

  if has_function_privilege('anon', 'app_auth.has_active_clinical_assignment(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('public', 'app_auth.has_active_clinical_assignment(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'WP-04.4 failed: 3-arg assignment executable by PUBLIC/anon';
  end if;
end;
$$;

do $$
declare
  org1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa61';
  org2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa62';
  unit_a uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb61';
  unit_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb62';
  unit_other uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb63';
  actor uuid := 'cccccccc-cccc-cccc-cccc-cccccccccc61';
  patient uuid := 'cccccccc-cccc-cccc-cccc-cccccccccc62';
  denied boolean;
begin
  delete from public.professional_assignments where organization_id in (org1, org2);
  delete from public.user_organizations where organization_id in (org1, org2);
  delete from public.organization_units where organization_id in (org1, org2);
  delete from public.organizations where id in (org1, org2);

  insert into public.organizations (id, name, status)
  values (org1, 'TMP Org Unit A', 'ativo'), (org2, 'TMP Org Unit B', 'ativo');

  insert into public.organization_units (id, organization_id, name, status)
  values
    (unit_a, org1, 'Unit A', 'ativo'),
    (unit_b, org1, 'Unit B', 'ativo'),
    (unit_other, org2, 'Unit Other', 'ativo');

  -- null unit fail-closed
  if app_auth.has_active_clinical_assignment(org1, patient, null) then
    raise exception 'WP-04.4 failed: null unit must deny';
  end if;

  -- 1-arg supervisor org-wide must be false
  if public.can_supervise_clinical_care_plan(org1) then
    raise exception 'WP-04.4 failed: 1-arg supervisor must be fail-closed false';
  end if;

  if public.can_supervise_clinical_care_plan(org1, null) then
    raise exception 'WP-04.4 failed: supervisor null unit must deny';
  end if;

  -- cleanup
  delete from public.organization_units where organization_id in (org1, org2);
  delete from public.organizations where id in (org1, org2);

  if exists (select 1 from public.organizations where id in (org1, org2)) then
    raise exception 'WP-04.4 fixtures residual';
  end if;

  raise notice 'WP-04.4 validation PASS (structural + fail-closed unit helpers)';
end;
$$;
