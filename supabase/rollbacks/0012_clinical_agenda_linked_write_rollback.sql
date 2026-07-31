-- Rollback manual SUP-C01.2 (0012)
-- Remove policies/grants/indexes/constraints/coluna/funcoes introduzidos por 0012.
-- Nao apaga linhas de appointments nem objetos 0010/0011.

begin;

do $$
begin
  if to_regprocedure('public.can_manage_clinical_agenda(uuid)') is null then
    raise exception 'Rollback 0012 bloqueado: funcao public.can_manage_clinical_agenda(uuid) ausente.';
  end if;
  if to_regprocedure('public.can_list_linked_clinical_portfolio(uuid)') is null then
    raise exception 'Rollback 0012 bloqueado: dependencia 0011 ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'Rollback 0012 bloqueado: dependencia 0010 ausente.';
  end if;
end $$;

drop policy if exists appointments_select_clinical_own on public.appointments;
drop policy if exists appointments_insert_clinical_own on public.appointments;
drop policy if exists appointments_update_clinical_own on public.appointments;

do $$
begin
  execute 'revoke all on table public.appointments from authenticated';
  execute 'revoke all on table public.appointments from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.appointments from anon';
  end if;
end $$;

drop function public.can_manage_clinical_agenda(uuid);

drop index if exists public.appointments_active_slot_unique_idx;
drop index if exists public.appointments_starts_at_idx;
drop index if exists public.appointments_user_id_idx;
drop index if exists public.appointments_professional_id_idx;
drop index if exists public.appointments_organization_id_idx;

alter table public.appointments drop constraint if exists appointments_ends_after_starts_check;
alter table public.appointments drop constraint if exists appointments_appointment_type_check;
alter table public.appointments drop constraint if exists appointments_appointment_status_check;

alter table public.appointments drop column if exists appointment_type;

alter table public.appointments disable row level security;

commit;
