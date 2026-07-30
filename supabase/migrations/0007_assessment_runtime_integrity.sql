-- SUP-B02: garantias estruturais de idempotencia/concorrencia para avaliacao runtime.
-- Escopo:
-- - unicidade de resposta por (assessment_id, assessment_question_id)
-- - unicidade de resultado por assessment_id
-- - criacao/retomada concorrente de avaliacao em andamento via funcao transacional
-- Fora de escopo:
-- - mudanca de policies existentes
-- - deduplicacao automatica de dados preexistentes

begin;

-- 0) Baseline estrutural minimo esperado.
do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'assessments'
      and c.relkind = 'r'
  ) then
    raise exception 'SUP-B02: pre-condicao ausente: tabela public.assessments nao encontrada.';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'assessment_responses'
      and c.relkind = 'r'
  ) then
    raise exception 'SUP-B02: pre-condicao ausente: tabela public.assessment_responses nao encontrada.';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'risk_results'
      and c.relkind = 'r'
  ) then
    raise exception 'SUP-B02: pre-condicao ausente: tabela public.risk_results nao encontrada.';
  end if;
end $$;

-- 1) Evitar assumir ownership de objetos homonimos preexistentes.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'i'
      and c.relname = 'assessment_responses_assessment_question_unique_idx'
  ) then
    raise exception 'SUP-B02: indice assessment_responses_assessment_question_unique_idx ja existe; abortando para evitar assumir objeto preexistente.';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'i'
      and c.relname = 'risk_results_assessment_unique_idx'
  ) then
    raise exception 'SUP-B02: indice risk_results_assessment_unique_idx ja existe; abortando para evitar assumir objeto preexistente.';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'i'
      and c.relname = 'assessments_one_in_progress_per_user_version_idx'
  ) then
    raise exception 'SUP-B02: indice assessments_one_in_progress_per_user_version_idx ja existe; abortando para evitar assumir objeto preexistente.';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_or_get_active_assessment'
      and p.pronargs = 3
  ) then
    raise exception 'SUP-B02: funcao public.create_or_get_active_assessment(uuid, uuid, text) ja existe; abortando para evitar sobrescrita.';
  end if;
end $$;

-- 2) Pre-checagens de duplicidade (sem deduplicacao silenciosa).
do $$
begin
  if exists (
    select 1
    from public.assessment_responses ar
    group by ar.assessment_id, ar.assessment_question_id
    having count(*) > 1
  ) then
    raise exception
      'SUP-B02: duplicidades detectadas em assessment_responses para (assessment_id, assessment_question_id). Regularize os dados antes de aplicar a migration.';
  end if;

  if exists (
    select 1
    from public.risk_results rr
    group by rr.assessment_id
    having count(*) > 1
  ) then
    raise exception
      'SUP-B02: duplicidades detectadas em risk_results para assessment_id. Regularize os dados antes de aplicar a migration.';
  end if;

  if exists (
    select 1
    from public.assessments a
    where a.status = 'em_andamento'
      and a.assessment_version_id is not null
    group by a.organization_id, a.user_id, a.assessment_version_id
    having count(*) > 1
  ) then
    raise exception
      'SUP-B02: duplicidades detectadas de avaliacao em andamento para (organization_id, user_id, assessment_version_id). Regularize os dados antes de aplicar a migration.';
  end if;
end $$;

-- 3) Unicidade estrutural de respostas e resultados.
create unique index assessment_responses_assessment_question_unique_idx
  on public.assessment_responses (assessment_id, assessment_question_id);

create unique index risk_results_assessment_unique_idx
  on public.risk_results (assessment_id);

-- 4) Unicidade de avaliacao em andamento por usuario/tenant/versao.
-- Justificativa:
-- - evita duplicidade concorrente da mesma avaliacao operacional;
-- - preserva historico concluido fora do predicado parcial;
-- - permite coexistencia de avaliacao concluida com nova avaliacao da mesma versao.
create unique index assessments_one_in_progress_per_user_version_idx
  on public.assessments (organization_id, user_id, assessment_version_id)
  where status = 'em_andamento'
    and assessment_version_id is not null;

-- 5) Funcao transacional para criar/retomar avaliacao concorrente.
-- SECURITY DEFINER e necessario para operar em ambiente com grants/policies de escrita restritos.
create function public.create_or_get_active_assessment(
  p_organization_id uuid,
  p_assessment_version_id uuid,
  p_initial_status text default 'em_andamento'
)
returns public.assessments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid;
  v_result public.assessments%rowtype;
  v_version_org uuid;
  v_version_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise insufficient_privilege using message = 'SUP-B02: sessao autenticada obrigatoria para criar ou retomar avaliacao.';
  end if;

  if p_initial_status is distinct from 'em_andamento' then
    raise exception 'SUP-B02: p_initial_status invalido (%).', p_initial_status;
  end if;

  if not app_auth.has_active_org_link(p_organization_id) then
    raise insufficient_privilege using message = 'SUP-B02: usuario sem vinculo organizacional ativo para a avaliacao.';
  end if;

  select av.organization_id, av.status
    into v_version_org, v_version_status
    from public.assessment_versions av
   where av.id = p_assessment_version_id;

  if v_version_org is null then
    raise exception 'SUP-B02: assessment_version_id % inexistente.', p_assessment_version_id;
  end if;

  if v_version_org is distinct from p_organization_id then
    raise exception
      'SUP-B02: assessment_version_id % pertence a organization_id divergente.',
      p_assessment_version_id;
  end if;

  if v_version_status <> 'ativo' then
    raise exception
      'SUP-B02: assessment_version_id % nao esta elegivel para iniciar avaliacao (status=%).',
      p_assessment_version_id,
      v_version_status;
  end if;

  select a.*
    into v_result
    from public.assessments a
   where a.organization_id = p_organization_id
     and a.user_id = v_uid
     and a.assessment_version_id = p_assessment_version_id
     and a.status = 'em_andamento'
   order by a.updated_at desc
   limit 1;

  if found then
    return v_result;
  end if;

  begin
    insert into public.assessments (
      organization_id,
      user_id,
      assessment_version_id,
      status
    ) values (
      p_organization_id,
      v_uid,
      p_assessment_version_id,
      p_initial_status
    )
    returning * into v_result;
  exception
    when unique_violation then
      select a.*
        into v_result
        from public.assessments a
       where a.organization_id = p_organization_id
         and a.user_id = v_uid
         and a.assessment_version_id = p_assessment_version_id
         and a.status = 'em_andamento'
       order by a.updated_at desc
       limit 1;
      if not found then
        raise exception
          'SUP-B02: unique_violation sem registro vencedor recuperavel em assessments.';
      end if;
  end;

  return v_result;
end;
$$;

do $$
begin
  execute 'revoke all on function public.create_or_get_active_assessment(uuid, uuid, text) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.create_or_get_active_assessment(uuid, uuid, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.create_or_get_active_assessment(uuid, uuid, text) to authenticated';
  end if;
end $$;

commit;
