-- Rollback manual SUP-C02 (0013)
-- Remove policies/grants/triggers/funcoes/tabela/colunas introduzidos por 0013.
-- Nao apaga linhas remanescentes de clinical_records existentes antes de 0013.
-- Restaura policy SELECT legada 0002 (clinical_only_allowed_roles) para baseline.

begin;

do $$
begin
  if to_regprocedure('public.can_manage_clinical_record(uuid)') is null then
    raise exception 'Rollback 0013 bloqueado: funcao public.can_manage_clinical_record(uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'Rollback 0013 bloqueado: dependencia 0010 ausente.';
  end if;
end $$;

drop trigger if exists trg_snapshot_clinical_record_version on public.clinical_records;
drop trigger if exists trg_guard_clinical_record_mutability on public.clinical_records;

drop policy if exists clinical_records_select_own on public.clinical_records;
drop policy if exists clinical_records_insert_own on public.clinical_records;
drop policy if exists clinical_records_update_own on public.clinical_records;
drop policy if exists clinical_record_versions_select_own on public.clinical_record_versions;

do $$
begin
  execute 'revoke all on table public.clinical_records from authenticated';
  execute 'revoke all on table public.clinical_record_versions from authenticated';
  execute 'revoke all on table public.clinical_records from public';
  execute 'revoke all on table public.clinical_record_versions from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.clinical_records from anon';
    execute 'revoke all on table public.clinical_record_versions from anon';
  end if;
end $$;

drop function if exists app_auth.snapshot_clinical_record_version();
drop function if exists app_auth.guard_clinical_record_mutability();
drop function if exists public.can_manage_clinical_record(uuid);

drop table if exists public.clinical_record_versions;

drop index if exists public.clinical_records_active_unique_idx;
drop index if exists public.clinical_records_user_id_idx;
drop index if exists public.clinical_records_professional_id_idx;
drop index if exists public.clinical_records_organization_id_idx;

alter table public.clinical_records drop constraint if exists clinical_records_concluded_consistency_check;
alter table public.clinical_records drop constraint if exists clinical_records_revision_positive_check;
alter table public.clinical_records drop constraint if exists clinical_records_schema_version_check;
alter table public.clinical_records drop constraint if exists clinical_records_record_status_check;

alter table public.clinical_records drop column if exists concluded_by;
alter table public.clinical_records drop column if exists concluded_at;
alter table public.clinical_records drop column if exists authored_by;
alter table public.clinical_records drop column if exists revision_number;
alter table public.clinical_records drop column if exists sections;
alter table public.clinical_records drop column if exists schema_version;
alter table public.clinical_records drop column if exists record_status;

-- Restaura policy legada de demonstracao (0002) apos remover hardening 0013.
drop policy if exists clinical_only_allowed_roles on public.clinical_records;
create policy clinical_only_allowed_roles on public.clinical_records
  for select using (
    organization_id::text = auth.jwt() ->> 'app.organization_id'
    and (
      (auth.jwt() ->> 'app.role') = 'gestor_clinico'
      or (
        (auth.jwt() ->> 'app.role') in ('medico', 'profissional_saude')
        and exists (
          select 1
          from public.professional_assignments pa
          where pa.organization_id = clinical_records.organization_id
            and pa.professional_id::text = auth.uid()::text
            and pa.user_id = clinical_records.user_id
            and pa.status = 'ativo'
        )
      )
    )
  );

commit;
