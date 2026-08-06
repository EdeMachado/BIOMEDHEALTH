-- WP-04.1 Platform Readiness
-- - Replace residual JWT-era RLS (0002) with app_auth helpers (tighten, no widen).
-- - Harden search_path on 0017 SECURITY DEFINER helpers.
-- Additive only. Does not edit migrations 0001-0020.

begin;

-- ---------------------------------------------------------------------------
-- 1) assessments: replace own_data_assessments
-- Owner + clinical assignment only (gestor_clinico no longer gets org-wide SELECT
-- by JWT role inference — aligns with fail-closed / least privilege).
-- ---------------------------------------------------------------------------
drop policy if exists own_data_assessments on public.assessments;
drop policy if exists assessments_select_owner on public.assessments;
drop policy if exists assessments_select_clinical_linked on public.assessments;

create policy assessments_select_owner
on public.assessments
for select
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

create policy assessments_select_clinical_linked
on public.assessments
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 2) professional_assignments: replace professional_assignment_scope
-- ---------------------------------------------------------------------------
drop policy if exists professional_assignment_scope on public.professional_assignments;
drop policy if exists professional_assignments_select_self on public.professional_assignments;
drop policy if exists professional_assignments_select_gestor_clinico on public.professional_assignments;

create policy professional_assignments_select_self
on public.professional_assignments
for select
to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

create policy professional_assignments_select_gestor_clinico
on public.professional_assignments
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and app_auth.has_active_role(
    organization_id,
    array['gestor_clinico']::text[],
    null::uuid
  )
);

-- ---------------------------------------------------------------------------
-- 3) Harden search_path on 0017 SECURITY DEFINER helpers
-- ---------------------------------------------------------------------------
alter function app_auth.unit_belongs_to_organization(uuid, uuid)
  set search_path = pg_catalog, public;
alter function app_auth.has_org_wide_collective_role(uuid, text[])
  set search_path = pg_catalog, public;
alter function app_auth.has_unit_collective_role(uuid, uuid, text[])
  set search_path = pg_catalog, public;
alter function app_auth.can_select_campaign(uuid, text, uuid, text, uuid)
  set search_path = pg_catalog, public;
alter function app_auth.can_write_campaign(uuid, text, uuid)
  set search_path = pg_catalog, public;
alter function app_auth.can_select_action_plan(uuid, text, uuid, text, uuid)
  set search_path = pg_catalog, public;
alter function app_auth.can_write_action_plan(uuid, text, uuid)
  set search_path = pg_catalog, public;

alter function public.enforce_campaign_organization_immutable()
  set search_path = pg_catalog, public;
alter function public.enforce_action_plan_organization_immutable()
  set search_path = pg_catalog, public;
alter function public.enforce_campaign_unit_belongs_to_org()
  set search_path = pg_catalog, public;
alter function public.enforce_action_plan_unit_belongs_to_org()
  set search_path = pg_catalog, public;
alter function public.enforce_campaign_unit_applicability_row()
  set search_path = pg_catalog, public;
alter function public.enforce_action_plan_unit_applicability_row()
  set search_path = pg_catalog, public;
alter function public.enforce_campaign_applicability_cardinality()
  set search_path = pg_catalog, public;
alter function public.enforce_action_plan_applicability_cardinality()
  set search_path = pg_catalog, public;
alter function public.enforce_campaign_audience_inherits_org()
  set search_path = pg_catalog, public;

-- ---------------------------------------------------------------------------
-- 4) Reassert least-privilege EXECUTE on 0017 helpers
-- ---------------------------------------------------------------------------
revoke all on function app_auth.unit_belongs_to_organization(uuid, uuid) from public, anon, authenticated;
revoke all on function app_auth.has_org_wide_collective_role(uuid, text[]) from public, anon, authenticated;
revoke all on function app_auth.has_unit_collective_role(uuid, uuid, text[]) from public, anon, authenticated;

revoke all on function app_auth.can_select_campaign(uuid, text, uuid, text, uuid) from public, anon;
revoke all on function app_auth.can_write_campaign(uuid, text, uuid) from public, anon;
revoke all on function app_auth.can_select_action_plan(uuid, text, uuid, text, uuid) from public, anon;
revoke all on function app_auth.can_write_action_plan(uuid, text, uuid) from public, anon;

grant execute on function app_auth.can_select_campaign(uuid, text, uuid, text, uuid) to authenticated;
grant execute on function app_auth.can_write_campaign(uuid, text, uuid) to authenticated;
grant execute on function app_auth.can_select_action_plan(uuid, text, uuid, text, uuid) to authenticated;
grant execute on function app_auth.can_write_action_plan(uuid, text, uuid) to authenticated;

revoke all on function public.enforce_campaign_organization_immutable() from public, anon, authenticated;
revoke all on function public.enforce_action_plan_organization_immutable() from public, anon, authenticated;
revoke all on function public.enforce_campaign_unit_belongs_to_org() from public, anon, authenticated;
revoke all on function public.enforce_action_plan_unit_belongs_to_org() from public, anon, authenticated;
revoke all on function public.enforce_campaign_unit_applicability_row() from public, anon, authenticated;
revoke all on function public.enforce_action_plan_unit_applicability_row() from public, anon, authenticated;
revoke all on function public.enforce_campaign_applicability_cardinality() from public, anon, authenticated;
revoke all on function public.enforce_action_plan_applicability_cardinality() from public, anon, authenticated;
revoke all on function public.enforce_campaign_audience_inherits_org() from public, anon, authenticated;

-- Reassert audit RPC grants (no widen)
revoke all on function public.register_audit_event(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.register_audit_event(uuid, text, text, text, text, text, text, text) to authenticated;

commit;
