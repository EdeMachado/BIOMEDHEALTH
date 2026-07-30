-- Rollback manual SUP-B03.2 (0010)
-- Remove somente policies/funcao introduzidas por 0010.
-- Restaura estado de leitura clinica ausente (permanecem policies titular 0008/0009).
-- Nao apaga dados.

begin;

do $$
begin
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception
      'Rollback 0010 bloqueado: funcao app_auth.has_active_clinical_assignment(uuid,uuid) ausente.';
  end if;
  if to_regprocedure('public.can_access_linked_patient_journey(uuid,uuid)') is null then
    raise exception
      'Rollback 0010 bloqueado: funcao public.can_access_linked_patient_journey(uuid,uuid) ausente.';
  end if;

  if not exists (
    select 1 from pg_policy
    where polname = 'user_journeys_select_clinical_linked'
      and polrelid = 'public.user_journeys'::regclass
  ) then
    raise exception 'Rollback 0010 bloqueado: policy user_journeys_select_clinical_linked ausente.';
  end if;

  if not exists (
    select 1 from pg_policy
    where polname = 'user_activity_progress_select_clinical_linked'
      and polrelid = 'public.user_activity_progress'::regclass
  ) then
    raise exception
      'Rollback 0010 bloqueado: policy user_activity_progress_select_clinical_linked ausente.';
  end if;

  if not exists (
    select 1 from pg_policy
    where polname = 'user_journeys_select_self'
      and polrelid = 'public.user_journeys'::regclass
  ) then
    raise exception 'Rollback 0010 bloqueado: policy titular user_journeys_select_self ausente.';
  end if;

  if not exists (
    select 1 from pg_policy
    where polname = 'user_activity_progress_select_self'
      and polrelid = 'public.user_activity_progress'::regclass
  ) then
    raise exception
      'Rollback 0010 bloqueado: policy titular user_activity_progress_select_self ausente.';
  end if;
end $$;

drop policy user_journeys_select_clinical_linked on public.user_journeys;
drop policy user_activity_progress_select_clinical_linked on public.user_activity_progress;

do $$
begin
  execute 'revoke all on function public.can_access_linked_patient_journey(uuid, uuid) from authenticated';
  execute 'revoke all on function public.can_access_linked_patient_journey(uuid, uuid) from public';
  execute 'revoke all on function app_auth.has_active_clinical_assignment(uuid, uuid) from authenticated';
  execute 'revoke all on function app_auth.has_active_clinical_assignment(uuid, uuid) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.can_access_linked_patient_journey(uuid, uuid) from anon';
    execute 'revoke all on function app_auth.has_active_clinical_assignment(uuid, uuid) from anon';
  end if;
end $$;

drop function public.can_access_linked_patient_journey(uuid, uuid);
drop function app_auth.has_active_clinical_assignment(uuid, uuid);

commit;
