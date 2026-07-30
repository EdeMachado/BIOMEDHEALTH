-- SUP-B03.2: leitura clinica vinculada (read-only) de jornada e progresso.
-- Incremental sobre 0008/0009. Nao altera policies de escrita nem imutabilidade.
--
-- Justificativa do helper SECURITY DEFINER:
-- professional_assignments ainda possui RLS legada (0002) baseada em claims JWT
-- app.organization_id/app.role. Subconsultar a tabela sob INVOKER falharia no modelo
-- atual (autorizacao por vinculos persistidos + app_auth). O helper segue o padrao
-- de app_auth.has_active_org_link / has_active_role: search_path fixo, auth.uid(),
-- org ativa, papel clinico permitido, vinculo ativo, grants minimos.

begin;

do $$
declare
  v_missing text[];
begin
  if not exists (select 1 from pg_class where oid = 'public.user_journeys'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.2: tabela public.user_journeys ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.user_activity_progress'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.2: tabela public.user_activity_progress ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.professional_assignments'::regclass and relkind = 'r') then
    raise exception 'SUP-B03.2: tabela public.professional_assignments ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'SUP-B03.2: funcao app_auth.has_active_org_link(uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_role(uuid,text[],uuid)') is null then
    raise exception 'SUP-B03.2: funcao app_auth.has_active_role(uuid,text[],uuid) ausente.';
  end if;

  select array_agg(policy_name order by policy_name)
    into v_missing
  from (
    values
      ('user_journeys_select_self'),
      ('user_journeys_update_self'),
      ('user_activity_progress_select_self'),
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
      'SUP-B03.2: policies titular 0008/0009 ausentes: %',
      array_to_string(v_missing, ', ');
  end if;

  if exists (
    select 1 from pg_policy
    where polname in (
      'user_journeys_select_clinical_linked',
      'user_activity_progress_select_clinical_linked'
    )
  ) then
    raise exception 'SUP-B03.2: policies clinicas ja existem; reaplicar somente apos rollback 0010.';
  end if;

  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is not null then
    raise exception 'SUP-B03.2: funcao app_auth.has_active_clinical_assignment(uuid,uuid) ja existe.';
  end if;
  if to_regprocedure('public.can_access_linked_patient_journey(uuid,uuid)') is not null then
    raise exception 'SUP-B03.2: funcao public.can_access_linked_patient_journey(uuid,uuid) ja existe.';
  end if;
end $$;

create function app_auth.has_active_clinical_assignment(
  target_organization_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and target_organization_id is not null
    and target_user_id is not null
    and app_auth.has_active_org_link(target_organization_id)
    and app_auth.has_active_role(
      target_organization_id,
      array['medico', 'profissional_saude']::text[],
      null::uuid
    )
    and exists (
      select 1
      from public.professional_assignments pa
      where pa.organization_id = target_organization_id
        and pa.user_id = target_user_id
        and pa.professional_id = auth.uid()
        and pa.status = 'ativo'
    );
$$;

revoke all on function app_auth.has_active_clinical_assignment(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function app_auth.has_active_clinical_assignment(uuid, uuid) from anon';
  end if;
end $$;
grant execute on function app_auth.has_active_clinical_assignment(uuid, uuid) to authenticated;

-- Wrapper publico para o repository (PostgREST/rpc) distinguir "sem jornada" de "sem vinculo"
-- sem enumerar dados de outro usuario/tenant: retorna apenas boolean.
create function public.can_access_linked_patient_journey(
  p_organization_id uuid,
  p_patient_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select app_auth.has_active_clinical_assignment(p_organization_id, p_patient_user_id);
$$;

revoke all on function public.can_access_linked_patient_journey(uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.can_access_linked_patient_journey(uuid, uuid) from anon';
  end if;
end $$;
grant execute on function public.can_access_linked_patient_journey(uuid, uuid) to authenticated;

-- SELECT clinico vinculado: OR com select_self existente (Postgres combina policies).
-- Sem INSERT/UPDATE/DELETE clinicos. USING governa leitura; WITH CHECK nao se aplica a SELECT.
create policy user_journeys_select_clinical_linked on public.user_journeys
for select to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

create policy user_activity_progress_select_clinical_linked on public.user_activity_progress
for select to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.user_journeys uj
    where uj.id = user_activity_progress.user_journey_id
      and uj.organization_id = user_activity_progress.organization_id
      and app_auth.has_active_clinical_assignment(uj.organization_id, uj.user_id)
  )
);

-- Grants inalterados: authenticated ja possui SELECT nas tabelas (0008).
-- Nenhum grant de INSERT/UPDATE/DELETE adicional ao profissional.

commit;
