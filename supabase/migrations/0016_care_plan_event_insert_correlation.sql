-- SUP-C03 follow-up: correlaciona care_plan_events ao care_plans na policy INSERT.
-- Corrige shadowing no EXISTS herdado da 0014/0015, onde organization_id/user_id/
-- professional_id nao qualificados resolviam para colunas de p (tautologias).
--
-- Contrato de professional_id (inalterado):
-- evento.professional_id = auth.uid() = plano.professional_id
-- (mesmo dono do plano; repository e RPC ja exigem essa identidade).
--
-- Preserva hardening 0015: so evolution/clinical_evolution; reassessment via RPC;
-- REVOKEs dos helpers internos intactos.

begin;

do $$
begin
  if to_regclass('public.care_plan_events') is null then
    raise exception 'SUP-C03-CORR: tabela public.care_plan_events ausente (requer 0014).';
  end if;
  if to_regprocedure('app_auth.has_active_clinical_assignment(uuid,uuid)') is null then
    raise exception 'SUP-C03-CORR: app_auth.has_active_clinical_assignment ausente.';
  end if;
  if to_regprocedure('public.reassess_clinical_care_plan(uuid,integer,text,date)') is null then
    raise exception 'SUP-C03-CORR: RPC reassess_clinical_care_plan ausente (requer 0014).';
  end if;
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.care_plan_events'::regclass
       and polname = 'care_plan_events_insert_clinical_notes'
  ) then
    raise exception 'SUP-C03-CORR: policy care_plan_events_insert_clinical_notes ausente (requer 0015).';
  end if;
end $$;

drop policy if exists care_plan_events_insert_clinical_notes on public.care_plan_events;
create policy care_plan_events_insert_clinical_notes on public.care_plan_events
for insert to authenticated
with check (
  auth.uid() is not null
  and care_plan_events.professional_id = auth.uid()
  and care_plan_events.authored_by = auth.uid()
  and care_plan_events.event_kind = 'evolution'
  and care_plan_events.event_category = 'clinical_evolution'
  and app_auth.has_active_clinical_assignment(
    care_plan_events.organization_id,
    care_plan_events.user_id
  )
  and exists (
    select 1
      from public.care_plans p
     where p.id = care_plan_events.care_plan_id
       and p.organization_id = care_plan_events.organization_id
       and p.user_id = care_plan_events.user_id
       and p.professional_id = care_plan_events.professional_id
       and p.plan_status in ('planejado', 'em_andamento')
  )
);

commit;
