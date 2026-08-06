-- Validation cases for migration 0020_residual_rls_and_audit_rpc.sql
-- Prefer local disposable DB after `supabase db reset`.

do $$
declare
  missing_rls integer;
begin
  select count(*)
    into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'assessment_versions',
      'assessment_questions',
      'assessment_options',
      'assessment_responses',
      'risk_rules',
      'educational_contents',
      'notifications',
      'documents'
    )
    and not c.relrowsecurity;

  if missing_rls <> 0 then
    raise exception '0020 validation failed: % residual table(s) without RLS', missing_rls;
  end if;
end;
$$;

do $$
begin
  if to_regprocedure('public.register_audit_event(uuid, text, text, text, text, text, text, text)') is null then
    raise exception '0020 validation failed: public.register_audit_event missing';
  end if;

  if has_function_privilege('anon', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE')
     or has_function_privilege('public', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception '0020 validation failed: register_audit_event executable by PUBLIC/anon';
  end if;

  if not has_function_privilege('authenticated', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception '0020 validation failed: authenticated missing register_audit_event EXECUTE';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_events'
      and policyname = 'audit_read_only_for_auditor'
  ) then
    raise exception '0020 validation failed: legacy JWT audit policy still present';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_events'
      and policyname = 'audit_events_select_auditor'
  ) then
    raise exception '0020 validation failed: modern audit select policy missing';
  end if;
end;
$$;

do $$
declare
  anon_select integer;
begin
  select count(*)
    into anon_select
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type = 'SELECT'
    and table_name in (
      'assessment_versions',
      'assessment_questions',
      'assessment_options',
      'assessment_responses',
      'risk_rules',
      'educational_contents',
      'notifications',
      'documents'
    );

  if anon_select <> 0 then
    raise exception '0020 validation failed: anon retains SELECT on % residual table(s)', anon_select;
  end if;
end;
$$;
