-- Rollback manual SUP-C01.1 (0011)
-- Remove somente funcoes/grants introduzidos por 0011.
-- Nao apaga assignments, jornadas, progresso ou objetos 0010.

begin;

do $$
begin
  if to_regprocedure('public.list_linked_clinical_patients()') is null then
    raise exception 'Rollback 0011 bloqueado: funcao public.list_linked_clinical_patients() ausente.';
  end if;
  if to_regprocedure('public.can_list_linked_clinical_portfolio()') is null then
    raise exception 'Rollback 0011 bloqueado: funcao public.can_list_linked_clinical_portfolio() ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'Rollback 0011 bloqueado: dependencia 0010 ausente.';
  end if;
end $$;

do $$
begin
  execute 'revoke all on function public.list_linked_clinical_patients() from authenticated';
  execute 'revoke all on function public.list_linked_clinical_patients() from public';
  execute 'revoke all on function public.can_list_linked_clinical_portfolio() from authenticated';
  execute 'revoke all on function public.can_list_linked_clinical_portfolio() from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.list_linked_clinical_patients() from anon';
    execute 'revoke all on function public.can_list_linked_clinical_portfolio() from anon';
  end if;
end $$;

drop function public.list_linked_clinical_patients();
drop function public.can_list_linked_clinical_portfolio();

commit;
