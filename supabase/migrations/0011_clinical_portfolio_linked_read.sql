-- SUP-C01.1: carteira clinica persistida (read-only) por vinculo ativo.
-- Incremental sobre 0010. Nao altera escrita titular nem imutabilidade 0008/0009.
--
-- Justificativa SECURITY DEFINER / RPC:
-- 1) professional_assignments ainda usa RLS legada (0002) por claims JWT;
-- 2) a identidade do profissional deve decorrer exclusivamente de auth.uid();
-- 3) o cliente nao pode informar professional_id para ler carteira alheia;
-- 4) display_name minimo via auth.users, apenas para pacientes ja autorizados pelo vinculo.

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
  if to_regprocedure('public.can_list_linked_clinical_portfolio()') is not null then
    raise exception 'SUP-C01.1: funcao public.can_list_linked_clinical_portfolio() ja existe.';
  end if;
  if to_regprocedure('public.list_linked_clinical_patients()') is not null then
    raise exception 'SUP-C01.1: funcao public.list_linked_clinical_patients() ja existe.';
  end if;
end $$;

-- True quando o autenticado possui papel clinico ativo em alguma organizacao.
-- Distingue "carteira autorizada vazia" de "acesso clinico negado".
create function public.can_list_linked_clinical_portfolio()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.user_organizations uo
      join public.user_roles ur
        on ur.user_organization_id = uo.id
       and ur.organization_id = uo.organization_id
       and ur.status = 'ativo'
      join public.roles r
        on r.id = ur.role_id
       and r.status = 'ativo'
       and r.code in ('medico', 'profissional_saude')
      where uo.user_id = auth.uid()
        and uo.status = 'ativo'
        and app_auth.has_active_org_link(uo.organization_id)
    );
$$;

revoke all on function public.can_list_linked_clinical_portfolio() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.can_list_linked_clinical_portfolio() from anon';
  end if;
end $$;
grant execute on function public.can_list_linked_clinical_portfolio() to authenticated;

-- Lista somente pacientes com assignment ativo do auth.uid(), mesma org ativa,
-- paciente com membership ativo, papel clinico do profissional na org do vinculo.
-- Sem parametros de identidade: impede consulta da carteira de outro profissional.
create function public.list_linked_clinical_patients()
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
    and pa.professional_id = auth.uid()
    and pa.status = 'ativo'
    and app_auth.has_active_org_link(pa.organization_id)
    and app_auth.has_active_role(
      pa.organization_id,
      array['medico', 'profissional_saude']::text[],
      null::uuid
    )
  order by
    coalesce(
      nullif(au.raw_user_meta_data ->> 'full_name', ''),
      nullif(au.raw_user_meta_data ->> 'name', ''),
      nullif(au.email, ''),
      'Paciente'
    ) asc,
    pa.user_id asc;
$$;

revoke all on function public.list_linked_clinical_patients() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.list_linked_clinical_patients() from anon';
  end if;
end $$;
grant execute on function public.list_linked_clinical_patients() to authenticated;

-- Sem grants/policies de escrita. Sem SELECT amplo em professional_assignments.

commit;
