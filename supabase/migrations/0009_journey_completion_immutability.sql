-- SUP-B03.1 corretivo: imutabilidade pos-conclusao de jornada/progresso no banco.
-- Incremental sobre 0008 (nao edita 0008).
-- Estrategia: reforco de RLS com USING (OLD) + WITH CHECK (NEW).
-- Justificativa: policy de UPDATE enxerga linha atual em USING e valores novos em WITH CHECK,
-- permitindo bloquear reabertura sem SECURITY DEFINER adicional nem trigger.
-- Conclusao legitima permanece via UPDATE autenticado enquanto completed_at IS NULL.

begin;

do $$
declare
  v_missing text[];
begin
  if not exists (select 1 from pg_class where oid = 'public.user_journeys'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.1-fix: tabela public.user_journeys ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.user_activity_progress'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.1-fix: tabela public.user_activity_progress ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'SUP-B03.1-fix: funcao app_auth.has_active_org_link(uuid) ausente.';
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
      'SUP-B03.1-fix: policies 0008 ausentes (reaplicar 0008 antes): %',
      array_to_string(v_missing, ', ');
  end if;
end $$;

-- 1) user_journeys: so atualiza jornada ainda aberta; NEW deve permanecer coerente.
drop policy user_journeys_update_self on public.user_journeys;
create policy user_journeys_update_self on public.user_journeys
for update to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
  and completed_at is null
)
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
  and (
    (completed_at is null and status = 'ativo')
    or (completed_at is not null and status = 'concluida')
  )
);

-- 2) progresso: insert/update apenas enquanto a jornada do titular estiver aberta.
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
      and uj.completed_at is null
      and uj.status = 'ativo'
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
      and uj.completed_at is null
      and uj.status = 'ativo'
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
      and uj.completed_at is null
      and uj.status = 'ativo'
      and ja.organization_id = user_activity_progress.organization_id
      and js.journey_version_id = uj.journey_version_id
      and app_auth.has_active_org_link(uj.organization_id)
  )
);

-- Grants inalterados: SELECT historico + UPDATE de conclusao em jornada ativa permanecem minimos.
-- Nenhuma nova funcao SECURITY DEFINER nesta migration.

commit;
