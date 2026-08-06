-- Rollback WP-04.4 clinical unit scope.
-- Restores pre-0023 helper semantics (org-wide role null).
-- Columns/policies from 0023: prefer backup restore for HML; not dropped here.

begin;

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
    and app_auth.has_active_role(
      target_organization_id,
      array['medico', 'profissional_saude']::text[],
      null::uuid
    )
    and exists (
      select 1
      from public.professional_assignments pa
      where pa.organization_id = target_organization_id
        and pa.user_id = target_user_id
        and pa.professional_id = auth.uid()
        and pa.status = 'ativo'
    );
$$;

drop function if exists app_auth.has_active_clinical_assignment(uuid, uuid, uuid);

create or replace function public.can_supervise_clinical_care_plan(p_organization_id uuid)
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
    and app_auth.has_active_role(
      p_organization_id,
      array['gestor_clinico']::text[],
      null::uuid
    );
$$;

drop function if exists public.can_supervise_clinical_care_plan(uuid, uuid);

do $$
begin
  raise notice 'WP-04.4 rollback applied (helpers). Columns/policies may need backup restore.';
end;
$$;

commit;
