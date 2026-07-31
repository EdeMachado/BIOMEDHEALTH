-- SUP-C03 hardening residual (pos-merge PR #10):
-- 1) revoga EXECUTE direto em helpers internos app_auth.* do plano de cuidado;
-- 2) restringe INSERT autenticado em care_plan_events a evolution clinica.
--
-- Nao altera regras funcionais da 0014 (unicidade, lifecycle, RPC atomica, RLS de leitura).
-- Compatível com bancos ja migrados pela 0014 e com instalacoes novas (0001..0015).

begin;

do $$
begin
  if to_regclass('public.care_plan_events') is null then
    raise exception 'SUP-C03-H: tabela public.care_plan_events ausente (requer 0014).';
  end if;
  if to_regprocedure('app_auth.append_care_plan_event(uuid,uuid,uuid,uuid,uuid,text,text,jsonb,text,integer,integer,uuid)') is null then
    raise exception 'SUP-C03-H: helper app_auth.append_care_plan_event ausente (requer 0014).';
  end if;
  if to_regprocedure('app_auth.snapshot_care_plan_event()') is null then
    raise exception 'SUP-C03-H: helper app_auth.snapshot_care_plan_event ausente (requer 0014).';
  end if;
  if to_regprocedure('app_auth.snapshot_care_plan_action_event()') is null then
    raise exception 'SUP-C03-H: helper app_auth.snapshot_care_plan_action_event ausente (requer 0014).';
  end if;
  if to_regprocedure('app_auth.guard_care_plan_mutability()') is null then
    raise exception 'SUP-C03-H: helper app_auth.guard_care_plan_mutability ausente (requer 0014).';
  end if;
  if to_regprocedure('app_auth.guard_care_plan_action_mutability()') is null then
    raise exception 'SUP-C03-H: helper app_auth.guard_care_plan_action_mutability ausente (requer 0014).';
  end if;
  if to_regprocedure('public.reassess_clinical_care_plan(uuid,integer,text,date)') is null then
    raise exception 'SUP-C03-H: RPC public.reassess_clinical_care_plan ausente (requer 0014).';
  end if;
end $$;

-- Helpers internos: somente owner/triggers (SECURITY DEFINER). Sem EXECUTE direto.
revoke all on function app_auth.append_care_plan_event(
  uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text, integer, integer, uuid
) from public;
revoke all on function app_auth.snapshot_care_plan_event() from public;
revoke all on function app_auth.snapshot_care_plan_action_event() from public;
revoke all on function app_auth.guard_care_plan_mutability() from public;
revoke all on function app_auth.guard_care_plan_action_mutability() from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute $sql$
      revoke all on function app_auth.append_care_plan_event(
        uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text, integer, integer, uuid
      ) from anon
    $sql$;
    execute 'revoke all on function app_auth.snapshot_care_plan_event() from anon';
    execute 'revoke all on function app_auth.snapshot_care_plan_action_event() from anon';
    execute 'revoke all on function app_auth.guard_care_plan_mutability() from anon';
    execute 'revoke all on function app_auth.guard_care_plan_action_mutability() from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $sql$
      revoke all on function app_auth.append_care_plan_event(
        uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text, integer, integer, uuid
      ) from authenticated
    $sql$;
    execute 'revoke all on function app_auth.snapshot_care_plan_event() from authenticated';
    execute 'revoke all on function app_auth.snapshot_care_plan_action_event() from authenticated';
    execute 'revoke all on function app_auth.guard_care_plan_mutability() from authenticated';
    execute 'revoke all on function app_auth.guard_care_plan_action_mutability() from authenticated';
  end if;
end $$;

-- INSERT direto autenticado: somente evolucao clinica.
-- reassessment permanece exclusivo da RPC public.reassess_clinical_care_plan.
drop policy if exists care_plan_events_insert_clinical_notes on public.care_plan_events;
create policy care_plan_events_insert_clinical_notes on public.care_plan_events
for insert to authenticated
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and authored_by = auth.uid()
  and event_kind = 'evolution'
  and event_category = 'clinical_evolution'
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
  and exists (
    select 1 from public.care_plans p
    where p.id = care_plan_id
      and p.organization_id = organization_id
      and p.user_id = user_id
      and p.professional_id = professional_id
      and p.plan_status in ('planejado', 'em_andamento')
  )
);

commit;
