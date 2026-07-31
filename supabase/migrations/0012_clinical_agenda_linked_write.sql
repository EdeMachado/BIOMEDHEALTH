-- SUP-C01.2: agenda clinica persistida (SELECT/INSERT/UPDATE) por vinculo ativo.
-- Incremental sobre 0011. Nao altera carteira, jornada titular nem imutabilidade 0008/0009.
-- unit_id adiado: schema/backlog parent nao exigem; arquitetura documenta gap residual.
--
-- Justificativa SECURITY DEFINER / helper:
-- 1) professional_assignments ainda usa RLS legada (0002) por claims JWT;
-- 2) identidade profissional deve decorrer exclusivamente de auth.uid();
-- 3) cliente nao informa professional_id para ampliar acesso;
-- 4) paciente so entra na agenda se has_active_clinical_assignment (carteira autorizada).

begin;

do $$
begin
  if not exists (select 1 from pg_class where oid = 'public.appointments'::regclass and relkind = 'r') then
    raise exception 'SUP-C01.2: tabela public.appointments ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'SUP-C01.2: funcao app_auth.has_active_org_link(uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_role(uuid,text[],uuid)') is null then
    raise exception 'SUP-C01.2: funcao app_auth.has_active_role(uuid,text[],uuid) ausente.';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'SUP-C01.2: funcao app_auth.has_active_clinical_assignment(uuid,uuid) ausente (requer 0010).';
  end if;
  if to_regprocedure('public.can_list_linked_clinical_portfolio(uuid)') is null then
    raise exception 'SUP-C01.2: funcao public.can_list_linked_clinical_portfolio(uuid) ausente (requer 0011).';
  end if;
  if to_regprocedure('public.can_manage_clinical_agenda(uuid)') is not null then
    raise exception 'SUP-C01.2: funcao public.can_manage_clinical_agenda(uuid) ja existe.';
  end if;
  if exists (
    select 1 from pg_policy
    where polrelid = 'public.appointments'::regclass
      and polname in (
        'appointments_select_clinical_own',
        'appointments_insert_clinical_own',
        'appointments_update_clinical_own'
      )
  ) then
    raise exception 'SUP-C01.2: policies de agenda ja existem; reaplicar somente apos rollback 0012.';
  end if;
end $$;

-- Tipo clinico do compromisso (valores alinhados a UI clinica).
alter table public.appointments
  add column if not exists appointment_type text;

update public.appointments
   set appointment_type = 'acompanhamento'
 where appointment_type is null;

alter table public.appointments
  alter column appointment_type set default 'acompanhamento';

alter table public.appointments
  alter column appointment_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_appointment_status_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_appointment_status_check
      check (
        appointment_status in (
          'solicitado',
          'confirmado',
          'concluido',
          'cancelado',
          'ausencia'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_appointment_type_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_appointment_type_check
      check (
        appointment_type in (
          'preventiva',
          'reavaliacao',
          'acompanhamento'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_ends_after_starts_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_ends_after_starts_check
      check (ends_at > starts_at);
  end if;
end $$;

create index if not exists appointments_organization_id_idx
  on public.appointments (organization_id);

create index if not exists appointments_professional_id_idx
  on public.appointments (professional_id);

create index if not exists appointments_user_id_idx
  on public.appointments (user_id);

create index if not exists appointments_starts_at_idx
  on public.appointments (starts_at);

-- Evita duplicidade evidente do mesmo profissional/paciente no mesmo horario (ativo).
create unique index if not exists appointments_active_slot_unique_idx
  on public.appointments (organization_id, professional_id, user_id, starts_at)
  where status = 'ativo';

-- True quando autenticado tem papel clinico ativo na organizacao da sessao.
create function public.can_manage_clinical_agenda(p_organization_id uuid)
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

revoke all on function public.can_manage_clinical_agenda(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.can_manage_clinical_agenda(uuid) from anon';
  end if;
end $$;
grant execute on function public.can_manage_clinical_agenda(uuid) to authenticated;

alter table public.appointments enable row level security;

create policy appointments_select_clinical_own on public.appointments
for select to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

create policy appointments_insert_clinical_own on public.appointments
for insert to authenticated
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

create policy appointments_update_clinical_own on public.appointments
for update to authenticated
using (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
)
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

revoke all on table public.appointments from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.appointments from anon';
  end if;
end $$;

revoke all on table public.appointments from authenticated;
grant select on table public.appointments to authenticated;
grant insert (
  organization_id,
  user_id,
  professional_id,
  starts_at,
  ends_at,
  appointment_status,
  appointment_type,
  status,
  version
) on table public.appointments to authenticated;
grant update (
  starts_at,
  ends_at,
  appointment_status,
  appointment_type,
  status,
  version,
  updated_at
) on table public.appointments to authenticated;

-- Sem DELETE. Cancelamento via appointment_status = cancelado.
-- Sem SELECT amplo sem vinculo. Sem unit_id nesta entrega.

commit;
