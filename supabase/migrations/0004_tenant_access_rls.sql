-- SUP-A03: RLS base com deny-by-default para fundacao tenant/acesso.
-- Politicas baseadas em vinculos persistidos, nao apenas claims no token.

create schema if not exists app_auth;

create or replace function app_auth.current_uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function app_auth.has_active_org_link(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_organizations uo
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
set search_path = public
as $$
  select exists (
    select 1
    from user_organizations uo
    join user_roles ur
      on ur.user_organization_id = uo.id
     and ur.organization_id = uo.organization_id
     and ur.status = 'ativo'
    join roles r
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
set search_path = public
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
set search_path = public
as $$
  select exists (
    select 1
    from user_organizations uo
    where uo.id = target_user_organization_id
      and uo.user_id = auth.uid()
  );
$$;

grant execute on function app_auth.current_uid() to authenticated;
grant execute on function app_auth.has_active_org_link(uuid) to authenticated;
grant execute on function app_auth.has_active_role(uuid, text[], uuid) to authenticated;
grant execute on function app_auth.can_manage_access(uuid, uuid) to authenticated;
grant execute on function app_auth.is_target_user_self(uuid) to authenticated;
grant usage on schema app_auth to authenticated;

alter table organizations enable row level security;
alter table organization_units enable row level security;
alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_organizations enable row level security;
alter table user_profiles enable row level security;
alter table user_roles enable row level security;

drop policy if exists organizations_select_same_org on organizations;
create policy organizations_select_same_org on organizations
for select using (
  auth.uid() is not null
  and app_auth.has_active_org_link(id)
);

drop policy if exists organization_units_select_same_org on organization_units;
create policy organization_units_select_same_org on organization_units
for select using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
);

drop policy if exists profiles_select_authenticated on profiles;
create policy profiles_select_authenticated on profiles
for select using (
  auth.uid() is not null
);

drop policy if exists roles_select_authenticated on roles;
create policy roles_select_authenticated on roles
for select using (
  auth.uid() is not null
);

drop policy if exists permissions_select_authenticated on permissions;
create policy permissions_select_authenticated on permissions
for select using (
  auth.uid() is not null
);

drop policy if exists role_permissions_select_authenticated on role_permissions;
create policy role_permissions_select_authenticated on role_permissions
for select using (
  auth.uid() is not null
);

drop policy if exists user_organizations_select_scope on user_organizations;
create policy user_organizations_select_scope on user_organizations
for select using (
  auth.uid() is not null
  and (
    user_id = auth.uid()
    or app_auth.can_manage_access(organization_id, null)
  )
);

drop policy if exists user_organizations_insert_admin on user_organizations;
create policy user_organizations_insert_admin on user_organizations
for insert with check (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, null)
  and user_id <> auth.uid()
);

drop policy if exists user_organizations_update_admin on user_organizations;
create policy user_organizations_update_admin on user_organizations
for update using (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, null)
  and user_id <> auth.uid()
)
with check (
  app_auth.can_manage_access(organization_id, null)
  and user_id <> auth.uid()
);

drop policy if exists user_organizations_delete_admin on user_organizations;
create policy user_organizations_delete_admin on user_organizations
for delete using (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, null)
  and user_id <> auth.uid()
);

drop policy if exists user_roles_select_scope on user_roles;
create policy user_roles_select_scope on user_roles
for select using (
  auth.uid() is not null
  and (
    app_auth.can_manage_access(organization_id, unit_id)
    or app_auth.is_target_user_self(user_organization_id)
  )
);

drop policy if exists user_roles_insert_admin on user_roles;
create policy user_roles_insert_admin on user_roles
for insert with check (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, unit_id)
  and not app_auth.is_target_user_self(user_organization_id)
);

drop policy if exists user_roles_update_admin on user_roles;
create policy user_roles_update_admin on user_roles
for update using (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, unit_id)
  and not app_auth.is_target_user_self(user_organization_id)
)
with check (
  app_auth.can_manage_access(organization_id, unit_id)
  and not app_auth.is_target_user_self(user_organization_id)
);

drop policy if exists user_roles_delete_admin on user_roles;
create policy user_roles_delete_admin on user_roles
for delete using (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, unit_id)
  and not app_auth.is_target_user_self(user_organization_id)
);

drop policy if exists user_profiles_select_scope on user_profiles;
create policy user_profiles_select_scope on user_profiles
for select using (
  auth.uid() is not null
  and (
    app_auth.can_manage_access(organization_id, unit_id)
    or app_auth.is_target_user_self(user_organization_id)
  )
);

drop policy if exists user_profiles_insert_admin on user_profiles;
create policy user_profiles_insert_admin on user_profiles
for insert with check (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, unit_id)
  and not app_auth.is_target_user_self(user_organization_id)
);

drop policy if exists user_profiles_update_admin on user_profiles;
create policy user_profiles_update_admin on user_profiles
for update using (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, unit_id)
  and not app_auth.is_target_user_self(user_organization_id)
)
with check (
  app_auth.can_manage_access(organization_id, unit_id)
  and not app_auth.is_target_user_self(user_organization_id)
);

drop policy if exists user_profiles_delete_admin on user_profiles;
create policy user_profiles_delete_admin on user_profiles
for delete using (
  auth.uid() is not null
  and app_auth.can_manage_access(organization_id, unit_id)
  and not app_auth.is_target_user_self(user_organization_id)
);
