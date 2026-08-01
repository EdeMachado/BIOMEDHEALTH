-- Rollback manual SUP-D01-D (0018).
-- Remove RPCs/helpers e UNIQUE de audiencia introduzidos pela 0018.
-- Nao toca objetos da 0017.

begin;

drop function if exists public.collective_delete_action_plan_atomic(uuid, uuid);
drop function if exists public.collective_update_action_plan_atomic(jsonb);
drop function if exists public.collective_create_action_plan_atomic(jsonb);
drop function if exists public.collective_delete_campaign_atomic(uuid, uuid);
drop function if exists public.collective_update_campaign_atomic(jsonb);
drop function if exists public.collective_create_campaign_atomic(jsonb);

drop function if exists public.collective_insert_action_plan_units(uuid, uuid[]);
drop function if exists public.collective_insert_campaign_units(uuid, uuid[]);
drop function if exists public.collective_action_plan_to_jsonb(uuid);
drop function if exists public.collective_campaign_to_jsonb(uuid);
drop function if exists public.collective_assert_audience_payload(jsonb);
drop function if exists public.collective_validate_scope_combo(text, uuid, text);
drop function if exists public.collective_assert_unit_ids(uuid, jsonb, boolean);
drop function if exists public.collective_assert_active_membership(uuid);
drop function if exists public.collective_assert_session();
drop function if exists public.collective_raise(text);

alter table public.campaign_audiences
  drop constraint if exists campaign_audiences_one_per_campaign;

commit;
