-- Policies de demonstracao para isolamento por organizacao e papel.
-- Exigem claims JWT: app.organization_id e app.role.

alter table user_consents enable row level security;
alter table assessments enable row level security;
alter table clinical_records enable row level security;
alter table care_plans enable row level security;
alter table risk_results enable row level security;
alter table campaigns enable row level security;
alter table action_plans enable row level security;
alter table audit_events enable row level security;
alter table professional_assignments enable row level security;

drop policy if exists org_isolation_user_consents on user_consents;
create policy org_isolation_user_consents on user_consents
  using (organization_id::text = auth.jwt() ->> 'app.organization_id');

drop policy if exists own_data_assessments on assessments;
create policy own_data_assessments on assessments
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      user_id::text = auth.uid()::text
      or (auth.jwt() ->> 'app.role') in ('medico', 'profissional_saude', 'gestor_clinico')
    )
  );

drop policy if exists clinical_only_allowed_roles on clinical_records;
create policy clinical_only_allowed_roles on clinical_records
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      (auth.jwt() ->> 'app.role') = 'gestor_clinico'
      or (
        (auth.jwt() ->> 'app.role') in ('medico', 'profissional_saude')
        and exists (
          select 1
          from professional_assignments pa
          where pa.organization_id = clinical_records.organization_id
            and pa.professional_id::text = auth.uid()::text
            and pa.user_id = clinical_records.user_id
            and pa.status = 'ativo'
        )
      )
    )
  );

drop policy if exists care_plan_only_allowed_roles on care_plans;
create policy care_plan_only_allowed_roles on care_plans
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      (auth.jwt() ->> 'app.role') = 'gestor_clinico'
      or (
        (auth.jwt() ->> 'app.role') in ('medico', 'profissional_saude')
        and exists (
          select 1
          from professional_assignments pa
          where pa.organization_id = care_plans.organization_id
            and pa.professional_id::text = auth.uid()::text
            and pa.user_id = care_plans.user_id
            and pa.status = 'ativo'
        )
      )
    )
  );

drop policy if exists professional_assignment_scope on professional_assignments;
create policy professional_assignment_scope on professional_assignments
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      (auth.jwt() ->> 'app.role') = 'gestor_clinico'
      or professional_id::text = auth.uid()::text
    )
  );

drop policy if exists risk_results_collective_or_owner on risk_results;
create policy risk_results_collective_or_owner on risk_results
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      (auth.jwt() ->> 'app.role') in ('gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed', 'auditor')
      or exists (
        select 1
        from assessments a
        where a.id = risk_results.assessment_id
          and a.user_id::text = auth.uid()::text
      )
    )
  );

drop policy if exists manager_campaigns_same_org on campaigns;
create policy manager_campaigns_same_org on campaigns
  for all using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (auth.jwt() ->> 'app.role') in ('gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed')
  );

drop policy if exists manager_action_plans_same_org on action_plans;
create policy manager_action_plans_same_org on action_plans
  for all using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (auth.jwt() ->> 'app.role') in ('gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed')
  );

drop policy if exists audit_read_only_for_auditor on audit_events;
create policy audit_read_only_for_auditor on audit_events
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (auth.jwt() ->> 'app.role') in ('auditor', 'admin_biomed')
  );
