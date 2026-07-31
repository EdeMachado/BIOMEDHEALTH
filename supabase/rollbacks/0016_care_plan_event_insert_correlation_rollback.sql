-- Rollback manual SUP-C03 correlacao INSERT (0016).
-- Restaura exatamente a policy pos-0015 (com referências nao qualificadas / tautologias).
-- Nao reverte REVOKEs da 0015 nem remove objetos 0014/0015.
--
-- Nota: a policy restaurada contem o shadowing conhecido da 0014/0015;
-- o rollback existe apenas para reversibilidade deterministica.

begin;

do $$
begin
  if to_regclass('public.care_plan_events') is null then
    raise exception 'Rollback 0016 bloqueado: tabela public.care_plan_events ausente.';
  end if;
end $$;

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
