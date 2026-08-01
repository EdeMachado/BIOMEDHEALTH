-- Rollback manual SUP-D01-B (0017).
-- Remove objetos introduzidos pela 0017 e restaura policies JWT legadas de campaigns/action_plans (0002).
-- Nao remove colunas/tabelas se houver dependencia externa. Nao reabre C04.2b / D02.

begin;

do $$
begin
  if to_regclass('public.campaigns') is null then
    raise exception 'Rollback 0017 bloqueado: public.campaigns ausente.';
  end if;
end $$;

-- Policies novas
drop policy if exists campaigns_select_collective on public.campaigns;
drop policy if exists campaigns_insert_collective on public.campaigns;
drop policy if exists campaigns_update_collective on public.campaigns;
drop policy if exists campaigns_delete_collective on public.campaigns;

drop policy if exists action_plans_select_collective on public.action_plans;
drop policy if exists action_plans_insert_collective on public.action_plans;
drop policy if exists action_plans_update_collective on public.action_plans;
drop policy if exists action_plans_delete_collective on public.action_plans;

drop policy if exists campaign_audiences_select_collective on public.campaign_audiences;
drop policy if exists campaign_audiences_insert_collective on public.campaign_audiences;
drop policy if exists campaign_audiences_update_collective on public.campaign_audiences;
drop policy if exists campaign_audiences_delete_collective on public.campaign_audiences;

drop policy if exists campaign_unit_applicabilities_select on public.campaign_unit_applicabilities;
drop policy if exists campaign_unit_applicabilities_insert on public.campaign_unit_applicabilities;
drop policy if exists campaign_unit_applicabilities_update on public.campaign_unit_applicabilities;
drop policy if exists campaign_unit_applicabilities_delete on public.campaign_unit_applicabilities;

drop policy if exists action_plan_unit_applicabilities_select on public.action_plan_unit_applicabilities;
drop policy if exists action_plan_unit_applicabilities_insert on public.action_plan_unit_applicabilities;
drop policy if exists action_plan_unit_applicabilities_update on public.action_plan_unit_applicabilities;
drop policy if exists action_plan_unit_applicabilities_delete on public.action_plan_unit_applicabilities;

-- Triggers
drop trigger if exists campaigns_organization_immutable on public.campaigns;
drop trigger if exists action_plans_organization_immutable on public.action_plans;
drop trigger if exists campaigns_unit_belongs_to_org on public.campaigns;
drop trigger if exists action_plans_unit_belongs_to_org on public.action_plans;
drop trigger if exists campaign_unit_applicabilities_row_guard on public.campaign_unit_applicabilities;
drop trigger if exists action_plan_unit_applicabilities_row_guard on public.action_plan_unit_applicabilities;
drop trigger if exists campaigns_applicability_cardinality on public.campaigns;
drop trigger if exists campaign_unit_applicabilities_cardinality on public.campaign_unit_applicabilities;
drop trigger if exists action_plans_applicability_cardinality on public.action_plans;
drop trigger if exists action_plan_unit_applicabilities_cardinality on public.action_plan_unit_applicabilities;
drop trigger if exists campaign_audiences_inherit_org on public.campaign_audiences;

drop function if exists public.enforce_campaign_organization_immutable();
drop function if exists public.enforce_action_plan_organization_immutable();
drop function if exists public.enforce_campaign_unit_belongs_to_org();
drop function if exists public.enforce_action_plan_unit_belongs_to_org();
drop function if exists public.enforce_campaign_unit_applicability_row();
drop function if exists public.enforce_action_plan_unit_applicability_row();
drop function if exists public.enforce_campaign_applicability_cardinality();
drop function if exists public.enforce_action_plan_applicability_cardinality();
drop function if exists public.enforce_campaign_audience_inherits_org();

drop function if exists app_auth.can_write_action_plan(uuid, text, uuid);
drop function if exists app_auth.can_select_action_plan(uuid, text, uuid, text, uuid);
drop function if exists app_auth.can_write_campaign(uuid, text, uuid);
drop function if exists app_auth.can_select_campaign(uuid, text, uuid, text, uuid);
drop function if exists app_auth.has_unit_collective_role(uuid, uuid, text[]);
drop function if exists app_auth.has_org_wide_collective_role(uuid, text[]);
drop function if exists app_auth.unit_belongs_to_organization(uuid, uuid);

drop table if exists public.action_plan_unit_applicabilities;
drop table if exists public.campaign_unit_applicabilities;

drop index if exists public.campaigns_organization_scope_idx;
drop index if exists public.action_plans_organization_scope_idx;

alter table public.campaigns
  drop constraint if exists campaigns_scope_unit_applicability_check,
  drop constraint if exists campaigns_scope_type_check;

alter table public.action_plans
  drop constraint if exists action_plans_scope_unit_applicability_check,
  drop constraint if exists action_plans_scope_type_check;

alter table public.campaigns
  drop column if exists unit_applicability,
  drop column if exists unit_id,
  drop column if exists scope_type;

alter table public.action_plans
  drop column if exists unit_applicability,
  drop column if exists unit_id,
  drop column if exists scope_type;

-- Restaura policies JWT legado (estado pre-0017 documentado em 0002)
drop policy if exists manager_campaigns_same_org on public.campaigns;
create policy manager_campaigns_same_org on public.campaigns
  for all using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (auth.jwt() ->> 'app.role') in ('gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed')
  );

drop policy if exists manager_action_plans_same_org on public.action_plans;
create policy manager_action_plans_same_org on public.action_plans
  for all using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (auth.jwt() ->> 'app.role') in ('gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed')
  );

-- campaign_audiences: RLS permanece habilitada (deny-by-default) apos remocao das policies 0017.
-- Reabilitacao de acesso aberto pre-0017 exigiria DROP RLS, o que seria regressao de isolamento.
-- Documentado: rollback remove policies D01-B; tabela continua com RLS on sem policies = deny.

commit;
