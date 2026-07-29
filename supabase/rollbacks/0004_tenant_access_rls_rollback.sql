-- Rollback manual do pacote SUP-A03
-- Uso apenas em ambiente controlado.

drop policy if exists user_profiles_delete_admin on user_profiles;
drop policy if exists user_profiles_update_admin on user_profiles;
drop policy if exists user_profiles_insert_admin on user_profiles;
drop policy if exists user_profiles_select_scope on user_profiles;

drop policy if exists user_roles_delete_admin on user_roles;
drop policy if exists user_roles_update_admin on user_roles;
drop policy if exists user_roles_insert_admin on user_roles;
drop policy if exists user_roles_select_scope on user_roles;

drop policy if exists user_organizations_delete_admin on user_organizations;
drop policy if exists user_organizations_update_admin on user_organizations;
drop policy if exists user_organizations_insert_admin on user_organizations;
drop policy if exists user_organizations_select_scope on user_organizations;

drop policy if exists role_permissions_select_authenticated on role_permissions;
drop policy if exists permissions_select_authenticated on permissions;
drop policy if exists roles_select_authenticated on roles;
drop policy if exists profiles_select_authenticated on profiles;
drop policy if exists organization_units_select_same_org on organization_units;
drop policy if exists organizations_select_same_org on organizations;

drop function if exists app_auth.is_target_user_self(uuid);
drop function if exists app_auth.can_manage_access(uuid, uuid);
drop function if exists app_auth.has_active_role(uuid, text[], uuid);
drop function if exists app_auth.has_active_org_link(uuid);
drop function if exists app_auth.current_uid();

drop schema if exists app_auth;
