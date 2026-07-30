-- Rollback manual SUP-B03.1 (0008)
-- Estrategia conservadora:
-- - validar identidade dos objetos antes de remover;
-- - remover exclusivamente objetos introduzidos por 0008;
-- - nao apagar dados.

begin;

do $$
declare
  v_fn_oid oid;
begin
  select p.oid
    into v_fn_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_or_get_active_user_journey'
     and p.pronargs = 3;

  if v_fn_oid is null then
    raise exception
      'Rollback 0008 bloqueado: funcao public.create_or_get_active_user_journey(uuid, uuid, text) ausente.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where p.oid = v_fn_oid
     and n.nspname = 'public'
     and p.prorettype = 'public.user_journeys'::regtype
  ) then
    raise exception
      'Rollback 0008 bloqueado: assinatura de retorno da funcao create_or_get_active_user_journey divergente.';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_activity_progress_user_journey_activity_unique_idx'
      and c.relkind = 'i'
  ) then
    raise exception
      'Rollback 0008 bloqueado: indice user_activity_progress_user_journey_activity_unique_idx ausente.';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_journeys_one_active_per_user_idx'
      and c.relkind = 'i'
  ) then
    raise exception
      'Rollback 0008 bloqueado: indice user_journeys_one_active_per_user_idx ausente.';
  end if;
end $$;

do $$
begin
  execute 'revoke all on function public.create_or_get_active_user_journey(uuid, uuid, text) from authenticated';
  execute 'revoke all on function public.create_or_get_active_user_journey(uuid, uuid, text) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.create_or_get_active_user_journey(uuid, uuid, text) from anon';
  end if;
end $$;

drop function public.create_or_get_active_user_journey(uuid, uuid, text);

drop policy health_journeys_select_eligible_self on public.health_journeys;
drop policy journey_versions_select_eligible_self on public.journey_versions;
drop policy journey_steps_select_eligible_self on public.journey_steps;
drop policy journey_activities_select_eligible_self on public.journey_activities;
drop policy user_journeys_select_self on public.user_journeys;
drop policy user_journeys_update_self on public.user_journeys;
drop policy user_activity_progress_select_self on public.user_activity_progress;
drop policy user_activity_progress_insert_self on public.user_activity_progress;
drop policy user_activity_progress_update_self on public.user_activity_progress;

drop index public.user_activity_progress_user_journey_activity_unique_idx;
drop index public.user_journeys_one_active_per_user_idx;

revoke all on table public.health_journeys from authenticated;
revoke all on table public.journey_versions from authenticated;
revoke all on table public.journey_steps from authenticated;
revoke all on table public.journey_activities from authenticated;
revoke all on table public.user_journeys from authenticated;
revoke all on table public.user_activity_progress from authenticated;

do $$
begin
  if not exists (select 1 from pg_policy where polrelid = 'public.health_journeys'::regclass) then
    alter table public.health_journeys disable row level security;
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.journey_versions'::regclass) then
    alter table public.journey_versions disable row level security;
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.journey_steps'::regclass) then
    alter table public.journey_steps disable row level security;
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.journey_activities'::regclass) then
    alter table public.journey_activities disable row level security;
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.user_journeys'::regclass) then
    alter table public.user_journeys disable row level security;
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.user_activity_progress'::regclass) then
    alter table public.user_activity_progress disable row level security;
  end if;
end $$;

commit;
