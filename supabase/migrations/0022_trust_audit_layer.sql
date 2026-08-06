-- WP-04.2 Trust & Audit Layer
-- - Append-only hardening for audit_events (no client INSERT/UPDATE/DELETE).
-- - Harden register_audit_event: correlation marker, result enum, PHI pattern reject,
--   actor from auth.uid(), org link required, server timestamp via created_at.
-- - Additive correlation_id column (filled from reason when present).
-- Does NOT edit migrations 0001-0021. Does NOT delete historical events.

begin;

-- ---------------------------------------------------------------------------
-- 1) Schema: structured correlation_id (nullable for pre-0022 rows)
-- ---------------------------------------------------------------------------
alter table public.audit_events
  add column if not exists correlation_id text;

comment on column public.audit_events.correlation_id is
  'Correlation id extracted from sanitized reason (corr=...). Nullable for legacy rows.';

-- ---------------------------------------------------------------------------
-- 2) Grants: authenticated may SELECT only; never INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------
revoke all on table public.audit_events from public, anon;
revoke insert, update, delete, truncate on table public.audit_events from authenticated;
grant select on table public.audit_events to authenticated;

-- ---------------------------------------------------------------------------
-- 3) RLS: force + explicit deny UPDATE/DELETE (no INSERT policy = deny)
-- ---------------------------------------------------------------------------
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

drop policy if exists audit_events_deny_update on public.audit_events;
drop policy if exists audit_events_deny_delete on public.audit_events;

create policy audit_events_deny_update
on public.audit_events
for update
to authenticated
using (false)
with check (false);

create policy audit_events_deny_delete
on public.audit_events
for delete
to authenticated
using (false);

-- Keep existing SELECT policy audit_events_select_auditor (from 0020).

-- ---------------------------------------------------------------------------
-- 4) Hardened register_audit_event (same signature — client compatible)
-- ---------------------------------------------------------------------------
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
  v_action text;
  v_entity text;
  v_origin text;
  v_result text;
  v_reason text;
  v_corr text;
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

  v_result := trim(p_result);
  if v_result not in ('sucesso', 'falha', 'negado') then
    raise exception 'register_audit_event: resultado invalido' using errcode = '22023';
  end if;

  v_action := trim(p_action);
  v_entity := trim(p_entity);
  v_origin := trim(p_origin);
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if length(v_action) > 80 or length(v_entity) > 80 or length(v_origin) > 40 then
    raise exception 'register_audit_event: parametro excede limite' using errcode = '22023';
  end if;

  if v_action !~ '^[a-z0-9_]+$' then
    raise exception 'register_audit_event: action invalida' using errcode = '22023';
  end if;

  -- Correlation required for WP-04.2+ (compat: min 4 chars keeps WP-04.1 fixture).
  if v_reason is null or v_reason !~ '(^|\|)corr=[A-Za-z0-9_-]{4,64}(\||$)' then
    raise exception 'register_audit_event: correlationId obrigatorio'
      using errcode = '22023';
  end if;

  v_corr := substring(v_reason from '(?:^|\|)corr=([A-Za-z0-9_-]{4,64})(?:\||$)');

  if v_reason ~* '(diagnost|anota[cç][aã]o|prontu[aá]rio|cpf|senha|password|token|jwt|bearer|stack|select |insert |update |delete )' then
    raise exception 'register_audit_event: metadata sensivel rejeitada'
      using errcode = '22023';
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
    correlation_id,
    status,
    version
  )
  values (
    p_organization_id,
    auth.uid(),
    trim(p_actor_role),
    v_action,
    v_entity,
    nullif(trim(coalesce(p_entity_id, '')), ''),
    v_origin,
    v_result,
    left(v_reason, 500),
    v_corr,
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
