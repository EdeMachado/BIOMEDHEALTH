-- Rollback manual SUP-C03 (0014)
-- Remove policies/grants/triggers/funcoes/tabela/colunas introduzidos por 0014.
-- Restaura policy SELECT legada 0002 (care_plan_only_allowed_roles).

begin;

do $$
begin
  if to_regprocedure('public.can_manage_clinical_care_plan(uuid)') is null then
    raise exception 'Rollback 0014 bloqueado: funcao public.can_manage_clinical_care_plan(uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'Rollback 0014 bloqueado: dependencia 0010 ausente.';
  end if;
end $$;

drop trigger if exists trg_snapshot_care_plan_event on public.care_plans;
drop trigger if exists trg_guard_care_plan_mutability on public.care_plans;
drop trigger if exists trg_snapshot_care_plan_action_event on public.care_plan_actions;
drop trigger if exists trg_guard_care_plan_action_mutability on public.care_plan_actions;

drop policy if exists care_plans_select_own on public.care_plans;
drop policy if exists care_plans_insert_own on public.care_plans;
drop policy if exists care_plans_update_own on public.care_plans;
drop policy if exists care_plan_actions_select_own on public.care_plan_actions;
drop policy if exists care_plan_actions_insert_own on public.care_plan_actions;
drop policy if exists care_plan_actions_update_own on public.care_plan_actions;
drop policy if exists care_plan_events_select_own on public.care_plan_events;
drop policy if exists care_plan_events_insert_clinical_notes on public.care_plan_events;

do $$
begin
  execute 'revoke all on table public.care_plans from authenticated';
  execute 'revoke all on table public.care_plan_actions from authenticated';
  execute 'revoke all on table public.care_plan_events from authenticated';
  execute 'revoke all on table public.care_plans from public';
  execute 'revoke all on table public.care_plan_actions from public';
  execute 'revoke all on table public.care_plan_events from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.care_plans from anon';
    execute 'revoke all on table public.care_plan_actions from anon';
    execute 'revoke all on table public.care_plan_events from anon';
  end if;
end $$;

drop function if exists app_auth.snapshot_care_plan_event();
drop function if exists app_auth.snapshot_care_plan_action_event();
drop function if exists app_auth.guard_care_plan_mutability();
drop function if exists app_auth.guard_care_plan_action_mutability();
drop function if exists app_auth.append_care_plan_event(uuid,uuid,uuid,uuid,uuid,text,text,jsonb,text,int,int,uuid);
drop function if exists public.can_manage_clinical_care_plan(uuid);

drop table if exists public.care_plan_events;

drop index if exists public.care_plans_one_open_unique_idx;
drop index if exists public.care_plans_user_id_idx;
drop index if exists public.care_plans_professional_id_idx;
drop index if exists public.care_plans_organization_id_idx;
drop index if exists public.care_plan_actions_plan_id_idx;
drop index if exists public.care_plan_actions_org_pro_user_idx;

alter table public.care_plans drop constraint if exists care_plans_clinical_record_fk;
alter table public.care_plans drop constraint if exists care_plans_closed_consistency_check;
alter table public.care_plans drop constraint if exists care_plans_schema_version_check;
alter table public.care_plans drop constraint if exists care_plans_plan_status_check;

alter table public.care_plan_actions drop constraint if exists care_plan_actions_completed_consistency_check;
alter table public.care_plan_actions drop constraint if exists care_plan_actions_action_status_check;

alter table public.care_plans drop column if exists clinical_record_id;
alter table public.care_plans drop column if exists schema_version;
alter table public.care_plans drop column if exists suspension_reason;
alter table public.care_plans drop column if exists closed_by;
alter table public.care_plans drop column if exists closed_at;
alter table public.care_plans drop column if exists updated_by;
alter table public.care_plans drop column if exists created_by;
alter table public.care_plans drop column if exists clinical_notes;
alter table public.care_plans drop column if exists last_reassessed_at;
alter table public.care_plans drop column if exists reassessment_due_on;
alter table public.care_plans drop column if exists target_date;
alter table public.care_plans drop column if exists starts_on;
alter table public.care_plans drop column if exists general_objective;
alter table public.care_plans drop column if exists plan_status;

alter table public.care_plan_actions drop column if exists completed_at;
alter table public.care_plan_actions drop column if exists updated_by;
alter table public.care_plan_actions drop column if exists created_by;
alter table public.care_plan_actions drop column if exists notes;
alter table public.care_plan_actions drop column if exists display_order;
alter table public.care_plan_actions drop column if exists action_status;
alter table public.care_plan_actions drop column if exists frequency;
alter table public.care_plan_actions drop column if exists specific_objective;
alter table public.care_plan_actions drop column if exists professional_id;
alter table public.care_plan_actions drop column if exists user_id;

drop policy if exists care_plan_only_allowed_roles on public.care_plans;
create policy care_plan_only_allowed_roles on public.care_plans
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      (auth.jwt() ->> 'app.role') = 'gestor_clinico'
      or (
        (auth.jwt() ->> 'app.role') in ('medico', 'profissional_saude')
        and exists (
          select 1
          from public.professional_assignments pa
          where pa.organization_id = care_plans.organization_id
            and pa.professional_id::text = auth.uid()::text
            and pa.user_id = care_plans.user_id
            and pa.status = 'ativo'
        )
      )
    )
  );

commit;
