-- Rollback for 0021_platform_readiness.sql
-- Restores JWT-era policies from 0002 and search_path=public on 0017 helpers.
-- RISKS REOPENED:
--   - JWT claim drift vs membership tables
--   - assessments SELECT for clinical roles without assignment
--   - search_path hijack surface on collective DEFINER helpers
-- Does NOT delete audit_events rows.
-- Does NOT alter migrations 0001-0020 files.

begin;

drop policy if exists assessments_select_owner on public.assessments;
drop policy if exists assessments_select_clinical_linked on public.assessments;
drop policy if exists own_data_assessments on public.assessments;

create policy own_data_assessments on public.assessments
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      user_id::text = auth.uid()::text
      or (auth.jwt() ->> 'app.role') in ('medico', 'profissional_saude', 'gestor_clinico')
    )
  );

drop policy if exists professional_assignments_select_self on public.professional_assignments;
drop policy if exists professional_assignments_select_gestor_clinico on public.professional_assignments;
drop policy if exists professional_assignment_scope on public.professional_assignments;

create policy professional_assignment_scope on public.professional_assignments
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      (auth.jwt() ->> 'app.role') = 'gestor_clinico'
      or professional_id::text = auth.uid()::text
    )
  );

alter function app_auth.unit_belongs_to_organization(uuid, uuid) set search_path = public;
alter function app_auth.has_org_wide_collective_role(uuid, text[]) set search_path = public;
alter function app_auth.has_unit_collective_role(uuid, uuid, text[]) set search_path = public;
alter function app_auth.can_select_campaign(uuid, text, uuid, text, uuid) set search_path = public;
alter function app_auth.can_write_campaign(uuid, text, uuid) set search_path = public;
alter function app_auth.can_select_action_plan(uuid, text, uuid, text, uuid) set search_path = public;
alter function app_auth.can_write_action_plan(uuid, text, uuid) set search_path = public;
alter function public.enforce_campaign_organization_immutable() set search_path = public;
alter function public.enforce_action_plan_organization_immutable() set search_path = public;
alter function public.enforce_campaign_unit_belongs_to_org() set search_path = public;
alter function public.enforce_action_plan_unit_belongs_to_org() set search_path = public;
alter function public.enforce_campaign_unit_applicability_row() set search_path = public;
alter function public.enforce_action_plan_unit_applicability_row() set search_path = public;
alter function public.enforce_campaign_applicability_cardinality() set search_path = public;
alter function public.enforce_action_plan_applicability_cardinality() set search_path = public;
alter function public.enforce_campaign_audience_inherits_org() set search_path = public;

commit;
