-- Validation cases for migration 0019_security_hardening.sql.
-- Run only against a disposable local Supabase database after `supabase db reset`.

-- 1. SECURITY DEFINER helpers use the hardened search_path.
do $$
declare
  unsafe_count integer;
begin
  select count(*)
    into unsafe_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_auth'
    and p.proname in (
      'has_active_org_link',
      'has_active_role',
      'can_manage_access',
      'is_target_user_self'
    )
    and not coalesce(p.proconfig, array[]::text[]) @> array['search_path=pg_catalog, public'];

  if unsafe_count <> 0 then
    raise exception '0019 validation failed: % helper(s) without hardened search_path', unsafe_count;
  end if;
end;
$$;

-- 2. PUBLIC and anon cannot execute the foundational helpers.
do $$
declare
  exposed_count integer;
begin
  select count(*)
    into exposed_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_auth'
    and p.proname in (
      'current_uid',
      'has_active_org_link',
      'has_active_role',
      'can_manage_access',
      'is_target_user_self'
    )
    and (
      has_function_privilege('public', p.oid, 'EXECUTE')
      or has_function_privilege('anon', p.oid, 'EXECUTE')
    );

  if exposed_count <> 0 then
    raise exception '0019 validation failed: % helper(s) executable by PUBLIC/anon', exposed_count;
  end if;
end;
$$;

-- 3. authenticated retains the required execution privileges.
do $$
declare
  missing_count integer;
begin
  select count(*)
    into missing_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_auth'
    and p.proname in (
      'current_uid',
      'has_active_org_link',
      'has_active_role',
      'can_manage_access',
      'is_target_user_self'
    )
    and not has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if missing_count <> 0 then
    raise exception '0019 validation failed: authenticated missing % helper privilege(s)', missing_count;
  end if;
end;
$$;

-- 4. Legacy institutional raw-row policy is absent and owner-only policy exists.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'risk_results'
      and policyname = 'risk_results_collective_or_owner'
  ) then
    raise exception '0019 validation failed: legacy risk_results policy still exists';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'risk_results'
      and policyname = 'risk_results_owner_only'
      and cmd = 'SELECT'
  ) then
    raise exception '0019 validation failed: owner-only risk_results policy missing';
  end if;
end;
$$;

-- Behavioral cases to execute with the repository auth harness:
-- A) assessment owner reads the matching risk_result: allowed.
-- B) another user in the same organization reads the row: denied.
-- C) institutional manager/SST/admin/auditor reads the raw row: denied.
-- D) user from another organization reads the row: denied.
-- E) aggregated, purpose-specific collective interfaces remain the only path for management analytics.
