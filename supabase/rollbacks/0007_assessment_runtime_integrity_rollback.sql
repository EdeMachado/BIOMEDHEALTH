-- Rollback manual SUP-B02 (0007)
-- Estrategia conservadora:
-- - validar presenca dos objetos da 0007 antes de remover;
-- - abortar em ausencia/divergencia de identidade;
-- - nao apagar dados.

begin;

do $$
declare
  v_fn_oid oid;
  v_idx_resp oid;
  v_idx_risk oid;
  v_idx_active oid;
begin
  select p.oid
    into v_fn_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_or_get_active_assessment'
     and p.pronargs = 3;

  if v_fn_oid is null then
    raise exception
      'Rollback 0007 bloqueado: funcao public.create_or_get_active_assessment(uuid, uuid, text) ausente.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where p.oid = v_fn_oid
     and n.nspname = 'public'
    and p.prorettype = 'public.assessments'::regtype
  ) then
    raise exception
      'Rollback 0007 bloqueado: assinatura de retorno da funcao create_or_get_active_assessment divergente.';
  end if;

  select c.oid into v_idx_resp
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'assessment_responses_assessment_question_unique_idx'
    and c.relkind = 'i';
  if v_idx_resp is null then
    raise exception
      'Rollback 0007 bloqueado: indice assessment_responses_assessment_question_unique_idx ausente.';
  end if;

  select c.oid into v_idx_risk
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'risk_results_assessment_unique_idx'
    and c.relkind = 'i';
  if v_idx_risk is null then
    raise exception
      'Rollback 0007 bloqueado: indice risk_results_assessment_unique_idx ausente.';
  end if;

  select c.oid into v_idx_active
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'assessments_one_in_progress_per_user_version_idx'
    and c.relkind = 'i';
  if v_idx_active is null then
    raise exception
      'Rollback 0007 bloqueado: indice assessments_one_in_progress_per_user_version_idx ausente.';
  end if;
end $$;

do $$
begin
  execute 'revoke all on function public.create_or_get_active_assessment(uuid, uuid, text) from authenticated';
  execute 'revoke all on function public.create_or_get_active_assessment(uuid, uuid, text) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.create_or_get_active_assessment(uuid, uuid, text) from anon';
  end if;
end $$;

drop function public.create_or_get_active_assessment(uuid, uuid, text);
drop index public.assessment_responses_assessment_question_unique_idx;
drop index public.risk_results_assessment_unique_idx;
drop index public.assessments_one_in_progress_per_user_version_idx;

commit;
