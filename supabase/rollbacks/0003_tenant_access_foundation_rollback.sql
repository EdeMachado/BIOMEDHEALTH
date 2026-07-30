-- Rollback manual do pacote SUP-A01
-- Uso apenas em ambiente controlado.

drop trigger if exists trg_validate_user_profile_context on user_profiles;
drop function if exists public.validate_user_profile_context();

drop trigger if exists trg_validate_user_role_context on user_roles;
drop function if exists public.validate_user_role_context();

drop index if exists user_profiles_unique_context_idx;
drop index if exists user_profiles_unit_idx;
drop index if exists user_profiles_org_idx;
drop table if exists user_profiles;

drop index if exists role_permissions_unique_idx;
drop table if exists role_permissions;

drop index if exists user_roles_unique_context_idx;
drop index if exists user_roles_unit_idx;
drop index if exists user_roles_org_idx;

alter table user_roles
  drop column if exists unit_id;

alter table user_organizations
  drop constraint if exists user_organizations_unique_org_user;
