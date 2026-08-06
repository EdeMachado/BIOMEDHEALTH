-- Rollback for 0020_residual_rls_and_audit_rpc.sql

begin;

drop function if exists public.register_audit_event(uuid, text, text, text, text, text, text, text);

drop policy if exists audit_events_select_auditor on public.audit_events;
create policy audit_read_only_for_auditor on public.audit_events
for select using (
  (auth.jwt() ->> 'app.role') in ('auditor', 'admin_biomed')
);

drop policy if exists documents_update_owner on public.documents;
drop policy if exists documents_insert_owner on public.documents;
drop policy if exists documents_select_clinical_linked on public.documents;
drop policy if exists documents_select_owner on public.documents;
drop policy if exists notifications_update_owner on public.notifications;
drop policy if exists notifications_select_owner on public.notifications;
drop policy if exists assessment_responses_update_owner on public.assessment_responses;
drop policy if exists assessment_responses_insert_owner on public.assessment_responses;
drop policy if exists assessment_responses_select_clinical_linked on public.assessment_responses;
drop policy if exists assessment_responses_select_owner on public.assessment_responses;
drop policy if exists educational_contents_select_org_member on public.educational_contents;
drop policy if exists risk_rules_select_org_member on public.risk_rules;
drop policy if exists assessment_options_select_org_member on public.assessment_options;
drop policy if exists assessment_questions_select_org_member on public.assessment_questions;
drop policy if exists assessment_versions_select_org_member on public.assessment_versions;

alter table public.documents disable row level security;
alter table public.notifications disable row level security;
alter table public.educational_contents disable row level security;
alter table public.risk_rules disable row level security;
alter table public.assessment_responses disable row level security;
alter table public.assessment_options disable row level security;
alter table public.assessment_questions disable row level security;
alter table public.assessment_versions disable row level security;

commit;
