-- WP-02 security hardening.
-- Tightens foundational SECURITY DEFINER helpers and removes institutional
-- access to individual risk results. Collective access must use aggregated,
-- purpose-specific interfaces instead of raw personal rows.

create or replace function app_auth.has_active_org_link(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_organizations uo
    where uo.user_id = auth.uid()
      and uo.organization_id = target_organization_id
      and uo.status = 'ativo'
  );
$$;

create or replace function app_auth.has_active_role(
  target_organization_id uuid,
  accepted_roles text[],
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_organizations uo
    join public.user_roles ur
      on ur.user_organization_id = uo.id
     and ur.organization_id = uo.organization_id
     and ur.status = 'ativo'
    join public.roles r
      on r.id = ur.role_id
     and r.status = 'ativo'
    where uo.user_id = auth.uid()
      and uo.organization_id = target_organization_id
      and uo.status = 'ativo'
      and r.code = any(accepted_roles)
      and (
        target_unit_id is null
        or ur.unit_id is null
        or ur.unit_id = target_unit_id
      )
  );
$$;

create or replace function app_auth.can_manage_access(
  target_organization_id uuid,
  target_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select app_auth.has_active_role(
    target_organization_id,
    array['admin_biomed', 'admin_cliente'],
    target_unit_id
  );
$$;

create or replace function app_auth.is_target_user_self(target_user_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_organizations uo
    where uo.id = target_user_organization_id
      and uo.user_id = auth.uid()
  );
$$;

revoke all on function app_auth.current_uid() from public;
revoke all on function app_auth.has_active_org_link(uuid) from public;
revoke all on function app_auth.has_active_role(uuid, text[], uuid) from public;
revoke all on function app_auth.can_manage_access(uuid, uuid) from public;
revoke all on function app_auth.is_target_user_self(uuid) from public;

revoke all on function app_auth.current_uid() from anon;
revoke all on function app_auth.has_active_org_link(uuid) from anon;
revoke all on function app_auth.has_active_role(uuid, text[], uuid) from anon;
revoke all on function app_auth.can_manage_access(uuid, uuid) from anon;
revoke all on function app_auth.is_target_user_self(uuid) from anon;

grant usage on schema app_auth to authenticated;
grant execute on function app_auth.current_uid() to authenticated;
grant execute on function app_auth.has_active_org_link(uuid) to authenticated;
grant execute on function app_auth.has_active_role(uuid, text[], uuid) to authenticated;
grant execute on function app_auth.can_manage_access(uuid, uuid) to authenticated;
grant execute on function app_auth.is_target_user_self(uuid) to authenticated;

drop policy if exists risk_results_collective_or_owner on public.risk_results;
drop policy if exists risk_results_owner_only on public.risk_results;

create policy risk_results_owner_only on public.risk_results
for select using (
  auth.uid() is not null
  and exists (
    select 1
    from public.assessments a
    where a.id = risk_results.assessment_id
      and a.organization_id = risk_results.organization_id
      and a.user_id = auth.uid()
  )
);
