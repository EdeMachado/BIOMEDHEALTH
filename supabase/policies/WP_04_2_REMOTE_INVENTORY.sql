-- WP-04.2 remote inventory — READ ONLY.
-- Safe for HML after merge + authorized migration apply.
-- Does not INSERT/UPDATE/DELETE. Does not print secrets.

\echo '=== WP-04.2 REMOTE INVENTORY (read-only) ==='

\echo '-- migrations (schema_migrations)'
select version, name
from supabase_migrations.schema_migrations
order by version;

\echo '-- audit_events columns'
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'audit_events'
order by ordinal_position;

\echo '-- audit_events RLS'
select c.relname,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'audit_events';

\echo '-- audit_events policies'
select policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'audit_events'
order by policyname;

\echo '-- register_audit_event search_path + security'
select p.proname,
       p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as args,
       coalesce(array_to_string(p.proconfig, ','), '') as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'register_audit_event';

\echo '-- EXECUTE privileges on register_audit_event'
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'register_audit_event'
order by grantee, privilege_type;

\echo '-- table privileges on audit_events'
select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'audit_events'
order by grantee, privilege_type;

\echo '-- JWT-era residual policies (expect 0)'
select schemaname, tablename, policyname
from pg_policies
where policyname in ('own_data_assessments', 'professional_assignment_scope');

\echo '-- triggers on audit_events'
select tgname, tgenabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'audit_events' and not t.tgisinternal;

\echo '=== END INVENTORY ==='
