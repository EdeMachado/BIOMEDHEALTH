-- Rollback manual SUP-C03 hardening residual (0015).
-- Restaura EXECUTE default (PUBLIC) dos helpers internos e a policy INSERT 0014
-- (evolution + reassessment). Nao remove objetos da 0014.

begin;

do $$
begin
  if to_regclass('public.care_plan_events') is null then
    raise exception 'Rollback 0015 bloqueado: tabela public.care_plan_events ausente.';
  end if;
  if to_regprocedure('app_auth.append_care_plan_event(uuid,uuid,uuid,uuid,uuid,text,text,jsonb,text,integer,integer,uuid)') is null then
    raise exception 'Rollback 0015 bloqueado: helper app_auth.append_care_plan_event ausente.';
  end if;
  if to_regprocedure('public.reassess_clinical_care_plan(uuid,integer,text,date)') is null then
    raise exception 'Rollback 0015 bloqueado: RPC reassess_clinical_care_plan ausente.';
  end if;
end $$;

-- Restaura estado de privilegio pos-0014 (EXECUTE concedido a PUBLIC por default do CREATE FUNCTION).
grant execute on function app_auth.append_care_plan_event(
  uuid, uuid, uuid, uuid, uuid, text, text, jsonb, text, integer, integer, uuid
) to public;
grant execute on function app_auth.snapshot_care_plan_event() to public;
grant execute on function app_auth.snapshot_care_plan_action_event() to public;
grant execute on function app_auth.guard_care_plan_mutability() to public;
grant execute on function app_auth.guard_care_plan_action_mutability() to public;

-- Restaura policy INSERT da 0014 (permite reassessment direto — estado pre-hardening).
drop policy if exists care_plan_events_insert_clinical_notes on public.care_plan_events;
create policy care_plan_events_insert_clinical_notes on public.care_plan_events
for insert to authenticated
with check (
  auth.uid() is not null
  and professional_id = auth.uid()
  and authored_by = auth.uid()
  and event_kind in ('evolution', 'reassessment')
  and event_category in ('clinical_evolution', 'reassessment')
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
