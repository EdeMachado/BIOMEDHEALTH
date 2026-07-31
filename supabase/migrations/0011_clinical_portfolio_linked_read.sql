-- SUP-C01.1: carteira clinica persistida (read-only) por vinculo ativo.
-- Incremental sobre 0010. Nao altera escrita titular nem imutabilidade 0008/0009.
--
-- Justificativa SECURITY DEFINER / RPC:
-- 1) professional_assignments ainda usa RLS legada (0002) por claims JWT;
-- 2) a identidade do profissional deve decorrer exclusivamente de auth.uid();
-- 3) o cliente nao pode informar professional_id para ler carteira alheia;
-- 4) organization_id e parametro de escopo da sessao e so e aceito apos
--    has_active_org_link + papel clinico na mesma org (padrao 0010);
-- 5) display_name minimo via auth.users, apenas para pacientes ja autorizados.

begin;

do $$
begin
  if not exists (select 1 from pg_class where oid = 'public.professional_assignments'::regclass and relkind = 'r') then
    raise exception 'SUP-C01.1: tabela public.professional_assignments ausente.';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.user_organizations'::regclass and relkind = 'r') then
    raise exception 'SUP-C01.1: tabela public.user_organizations ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'SUP-C01.1: funcao app_auth.has_active_org_link(uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_role(uuid,text[],uuid)') is null then
    raise exception 'SUP-C01.1: funcao app_auth.has_active_role(uuid,text[],uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'SUP-C01.1: funcao app_auth.has_active_clinical_assignment(uuid,uuid) ausente (requer 0010).';
  end if;
  if to_regclass('auth.users') is null then
    raise exception 'SUP-C01.1: auth.users ausente (dependencia Supabase para display_name minimo).';
  end if;
  if to_regprocedure('public.can_list_linked_clinical_portfolio(uuid)') is not null then
    raise exception 'SUP-C01.1: funcao public.can_list_linked_clinical_portfolio(uuid) ja existe.';
  end if;
  if to_regprocedure('public.list_linked_clinical_patients(uuid)') is not null then
    raise exception 'SUP-C01.1: funcao public.list_linked_clinical_patients(uuid) ja existe.';
  end if;
end $$;

-- True quando o autenticado possui papel clinico ativo na organizacao informada.
-- Distingue "carteira autorizada vazia" de "acesso clinico negado" por org da sessao.
create function public.can_list_linked_clinical_portfolio(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and p_organization_id is not null
    and app_auth.has_active_org_link(p_organization_id)
    and app_auth.has_active_role(
      p_organization_id,
      array['medico', 'profissional_saude']::text[],
      null::uuid
    );
$$;

revoke all on function public.can_list_linked_clinical_portfolio(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.can_list_linked_clinical_portfolio(uuid) from anon';
  end if;
end $$;
grant execute on function public.can_list_linked_clinical_portfolio(uuid) to authenticated;

-- Lista somente pacientes com assignment ativo do auth.uid() na organizacao
-- autorizada da sessao. organization_id nao e confiado sem membership+papel clinico.
create function public.list_linked_clinical_patients(p_organization_id uuid)
returns table (
  patient_user_id uuid,
  organization_id uuid,
  assignment_status text,
  assignment_reason text,
  display_name text
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    scoped.patient_user_id,
    scoped.organization_id,
    scoped.assignment_status,
    scoped.assignment_reason,
    scoped.display_name
  from (
    select distinct on (pa.user_id)
      pa.user_id as patient_user_id,
      pa.organization_id,
      pa.status as assignment_status,
      pa.assignment_reason,
      coalesce(
        nullif(au.raw_user_meta_data ->> 'full_name', ''),
        nullif(au.raw_user_meta_data ->> 'name', ''),
        nullif(au.email, ''),
        'Paciente'
      ) as display_name
    from public.professional_assignments pa
    join public.user_organizations patient_uo
      on patient_uo.organization_id = pa.organization_id
     and patient_uo.user_id = pa.user_id
     and patient_uo.status = 'ativo'
    left join auth.users au
      on au.id = pa.user_id
    where auth.uid() is not null
      and p_organization_id is not null
      and pa.organization_id = p_organization_id
      and pa.professional_id = auth.uid()
      and pa.status = 'ativo'
      and app_auth.has_active_org_link(p_organization_id)
      and app_auth.has_active_role(
        p_organization_id,
        array['medico', 'profissional_saude']::text[],
        null::uuid
      )
    order by pa.user_id asc
  ) scoped
  order by scoped.display_name asc, scoped.patient_user_id asc;
$$;

revoke all on function public.list_linked_clinical_patients(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.list_linked_clinical_patients(uuid) from anon';
  end if;
end $$;
grant execute on function public.list_linked_clinical_patients(uuid) to authenticated;

-- Sem grants/policies de escrita. Sem SELECT amplo em professional_assignments.

commit;
