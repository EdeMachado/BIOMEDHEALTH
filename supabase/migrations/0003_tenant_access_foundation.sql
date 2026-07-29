-- SUP-A01: fundacao de schema tenant e acesso
-- Objetivo: consolidar estrutura de vinculos organizacionais, papeis multiplos e escopo por unidade.

create table if not exists role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id),
  permission_id uuid not null references permissions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'ativo',
  version int not null default 1
);

create unique index if not exists role_permissions_unique_idx
  on role_permissions (role_id, permission_id);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_organization_id uuid not null references user_organizations(id),
  profile_id uuid not null references profiles(id),
  unit_id uuid references organization_units(id),
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists user_profiles_org_idx on user_profiles (organization_id);
create index if not exists user_profiles_unit_idx on user_profiles (unit_id) where unit_id is not null;
create unique index if not exists user_profiles_unique_context_idx
  on user_profiles (user_organization_id, profile_id, coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'user_roles'
      and column_name = 'unit_id'
  ) then
    alter table user_roles add column unit_id uuid references organization_units(id);
  end if;
end $$;

create index if not exists user_roles_org_idx on user_roles (organization_id);
create index if not exists user_roles_unit_idx on user_roles (unit_id) where unit_id is not null;
create unique index if not exists user_roles_unique_context_idx
  on user_roles (user_organization_id, role_id, coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_organizations_unique_org_user'
  ) then
    alter table user_organizations
      add constraint user_organizations_unique_org_user unique (organization_id, user_id);
  end if;
end $$;

create or replace function public.validate_user_role_context()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from user_organizations uo
    where uo.id = new.user_organization_id
      and uo.organization_id = new.organization_id
      and uo.status = 'ativo'
  ) then
    raise exception 'Vinculo organizacional invalido para user_roles.';
  end if;

  if new.unit_id is not null and not exists (
    select 1
    from organization_units ou
    where ou.id = new.unit_id
      and ou.organization_id = new.organization_id
      and ou.status = 'ativo'
  ) then
    raise exception 'Unidade invalida para o contexto organizacional em user_roles.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_user_role_context on user_roles;
create trigger trg_validate_user_role_context
before insert or update on user_roles
for each row execute function public.validate_user_role_context();

create or replace function public.validate_user_profile_context()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from user_organizations uo
    where uo.id = new.user_organization_id
      and uo.organization_id = new.organization_id
      and uo.status = 'ativo'
  ) then
    raise exception 'Vinculo organizacional invalido para user_profiles.';
  end if;

  if new.unit_id is not null and not exists (
    select 1
    from organization_units ou
    where ou.id = new.unit_id
      and ou.organization_id = new.organization_id
      and ou.status = 'ativo'
  ) then
    raise exception 'Unidade invalida para o contexto organizacional em user_profiles.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_user_profile_context on user_profiles;
create trigger trg_validate_user_profile_context
before insert or update on user_profiles
for each row execute function public.validate_user_profile_context();
