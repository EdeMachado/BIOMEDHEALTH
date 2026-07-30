-- Rollback manual SUP-B03.1 corretivo (0009)
-- Restaura exatamente as policies de escrita de user_journeys/user_activity_progress da 0008.
-- Nao apaga dados.

begin;

do $$
declare
  v_missing text[];
begin
  if not exists (select 1 from pg_class where oid = 'public.user_journeys'::regclass and relkind = 'r') then
    raise exception 'Rollback 0009 bloqueado: tabela public.user_journeys ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.user_activity_progress'::regclass and relkind = 'r') then
    raise exception 'Rollback 0009 bloqueado: tabela public.user_activity_progress ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'Rollback 0009 bloqueado: funcao app_auth.has_active_org_link(uuid) ausente.';
  end if;

  select array_agg(policy_name order by policy_name)
    into v_missing
  from (
    values
      ('user_journeys_update_self'),
      ('user_activity_progress_insert_self'),
      ('user_activity_progress_update_self')
  ) as required(policy_name)
  where not exists (
    select 1
    from pg_policy p
    where p.polname = required.policy_name
      and p.polrelid in (
        'public.user_journeys'::regclass,
        'public.user_activity_progress'::regclass
      )
  );

  if v_missing is not null then
    raise exception
      'Rollback 0009 bloqueado: policies alvo ausentes: %',
      array_to_string(v_missing, ', ');
  end if;
end $$;

drop policy user_journeys_update_self on public.user_journeys;
create policy user_journeys_update_self on public.user_journeys
for update to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
)
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

drop policy user_activity_progress_insert_self on public.user_activity_progress;
create policy user_activity_progress_insert_self on public.user_activity_progress
for insert to authenticated
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.user_journeys uj
    join public.journey_activities ja on ja.id = user_activity_progress.journey_activity_id
    join public.journey_steps js on js.id = ja.journey_step_id
    where uj.id = user_activity_progress.user_journey_id
      and uj.organization_id = user_activity_progress.organization_id
      and uj.user_id = auth.uid()
      and ja.organization_id = user_activity_progress.organization_id
      and js.journey_version_id = uj.journey_version_id
      and app_auth.has_active_org_link(uj.organization_id)
  )
);

drop policy user_activity_progress_update_self on public.user_activity_progress;
create policy user_activity_progress_update_self on public.user_activity_progress
for update to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.user_journeys uj
    where uj.id = user_activity_progress.user_journey_id
      and uj.organization_id = user_activity_progress.organization_id
      and uj.user_id = auth.uid()
      and app_auth.has_active_org_link(uj.organization_id)
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.user_journeys uj
    join public.journey_activities ja on ja.id = user_activity_progress.journey_activity_id
    join public.journey_steps js on js.id = ja.journey_step_id
    where uj.id = user_activity_progress.user_journey_id
      and uj.organization_id = user_activity_progress.organization_id
      and uj.user_id = auth.uid()
      and ja.organization_id = user_activity_progress.organization_id
      and js.journey_version_id = uj.journey_version_id
      and app_auth.has_active_org_link(uj.organization_id)
  )
);

commit;
