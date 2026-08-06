-- Rollback for 0022_trust_audit_layer.sql
-- Restores register_audit_event to the 0020 body (pre-correlation/PHI checks).
-- Drops explicit deny UPDATE/DELETE policies.
-- Does NOT delete historical audit_events rows.
-- Leaves correlation_id column in place (additive; avoids data loss).
--
-- RISKS REOPENED:
--   - RPC accepts reasons without correlation marker
--   - RPC does not reject PHI-like patterns in reason
--   - Append-only relies only on missing grants/policies (less explicit)
-- Does NOT widen table grants beyond 0020 (SELECT for authenticated).

begin;

drop policy if exists audit_events_deny_update on public.audit_events;
drop policy if exists audit_events_deny_delete on public.audit_events;

-- Keep FORCE RLS (safe); grants remain SELECT-only as in 0020.
revoke insert, update, delete, truncate on table public.audit_events from authenticated;
grant select on table public.audit_events to authenticated;

create or replace function public.register_audit_event(
  p_organization_id uuid,
  p_actor_role text,
  p_action text,
  p_entity text,
  p_entity_id text,
  p_origin text,
  p_result text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'register_audit_event: sessao ausente' using errcode = '42501';
  end if;

  if p_organization_id is null
     or coalesce(trim(p_actor_role), '') = ''
     or coalesce(trim(p_action), '') = ''
     or coalesce(trim(p_entity), '') = ''
     or coalesce(trim(p_origin), '') = ''
     or coalesce(trim(p_result), '') = '' then
    raise exception 'register_audit_event: parametros obrigatorios ausentes'
      using errcode = '22023';
  end if;

  if not app_auth.has_active_org_link(p_organization_id) then
    raise exception 'register_audit_event: vinculo organizacional ausente'
      using errcode = '42501';
  end if;

  if p_result not in ('sucesso', 'falha', 'negado') then
    raise exception 'register_audit_event: resultado invalido' using errcode = '22023';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_role,
    action,
    entity,
    entity_id,
    origin,
    result,
    reason,
    status,
    version
  )
  values (
    p_organization_id,
    auth.uid(),
    trim(p_actor_role),
    trim(p_action),
    trim(p_entity),
    nullif(trim(coalesce(p_entity_id, '')), ''),
    trim(p_origin),
    trim(p_result),
    nullif(trim(coalesce(p_reason, '')), ''),
    'ativo',
    1
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.register_audit_event(uuid, text, text, text, text, text, text, text) from public;
revoke all on function public.register_audit_event(uuid, text, text, text, text, text, text, text) from anon;
grant execute on function public.register_audit_event(uuid, text, text, text, text, text, text, text) to authenticated;

commit;
