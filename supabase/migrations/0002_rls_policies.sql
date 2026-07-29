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

create policy if not exists org_isolation_user_consents on user_consents
  using (organization_id::text = auth.jwt() ->> 'app.organization_id');

create policy if not exists own_data_assessments on assessments
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      user_id::text = auth.uid()::text
      or (auth.jwt() ->> 'app.role') in ('medico', 'profissional_saude', 'gestor_clinico')
    )
  );

create policy if not exists clinical_only_allowed_roles on clinical_records
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

create policy if not exists care_plan_only_allowed_roles on care_plans
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

create policy if not exists professional_assignment_scope on professional_assignments
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      (auth.jwt() ->> 'app.role') = 'gestor_clinico'
      or professional_id::text = auth.uid()::text
    )
  );

create policy if not exists risk_results_collective_or_owner on risk_results
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

create policy if not exists manager_campaigns_same_org on campaigns
  for all using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (auth.jwt() ->> 'app.role') in ('gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed')
  );

create policy if not exists manager_action_plans_same_org on action_plans
  for all using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (auth.jwt() ->> 'app.role') in ('gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed')
  );

create policy if not exists audit_read_only_for_auditor on audit_events
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (auth.jwt() ->> 'app.role') in ('auditor', 'admin_biomed')
  );
