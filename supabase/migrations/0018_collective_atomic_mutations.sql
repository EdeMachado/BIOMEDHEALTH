-- SUP-D01-D: mutacoes coletivas atomicas (campanhas e planos de acao).
-- Escopo:
-- - UNIQUE campaign_audiences (uma audiencia por campanha) com preflight
-- - RPCs SECURITY INVOKER create/update/delete para campaigns e action_plans
-- - selected_units + audiencia na mesma transacao; RLS como autoridade final
-- Fora de escopo:
-- - SUP-D02 / criteria populacionais / agregacoes
-- - service_role / SECURITY DEFINER nas RPCs
-- - alteracao de objetos da 0017

begin;

-- ---------------------------------------------------------------------------
-- 0) Pre-condicoes
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.campaigns') is null
     or to_regclass('public.campaign_audiences') is null
     or to_regclass('public.action_plans') is null
     or to_regclass('public.campaign_unit_applicabilities') is null
     or to_regclass('public.action_plan_unit_applicabilities') is null then
    raise exception 'SUP-D01-D: pre-condicao ausente (requer migration 0017).';
  end if;
  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'SUP-D01-D: pre-condicao ausente: app_auth.has_active_org_link(uuid)';
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'campaign_audiences_one_per_campaign'
  ) then
    raise exception 'SUP-D01-D: constraint campaign_audiences_one_per_campaign ja existe; abortando.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Preflight audiencia singular + UNIQUE
-- ---------------------------------------------------------------------------
do $$
declare
  v_dup uuid;
begin
  select ca.campaign_id into v_dup
  from public.campaign_audiences ca
  group by ca.campaign_id
  having count(*) > 1
  limit 1;

  if v_dup is not null then
    raise exception
      'SUP-D01-D: preflight abortado: campaign_id % possui mais de uma audiencia; nao ha merge/delete automatico.',
      v_dup;
  end if;
end $$;

alter table public.campaign_audiences
  add constraint campaign_audiences_one_per_campaign unique (campaign_id);

-- ---------------------------------------------------------------------------
-- 2) Helpers internos (SECURITY INVOKER; grant minimo a authenticated)
-- ---------------------------------------------------------------------------

create or replace function public.collective_raise(p_code text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
begin
  raise exception '%', p_code using errcode = 'P0001';
end;
$$;

create or replace function public.collective_assert_session()
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform public.collective_raise('COLLECTIVE:NO_SESSION');
  end if;
  return v_uid;
end;
$$;

create or replace function public.collective_assert_active_membership(p_organization_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, auth
as $$
begin
  if p_organization_id is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;
  if not app_auth.has_active_org_link(p_organization_id) then
    perform public.collective_raise('COLLECTIVE:NO_ACTIVE_MEMBERSHIP');
  end if;
end;
$$;

-- Valida unit_ids: array, sem duplicata, nao vazio quando exigido; unit ∈ org via RLS.
create or replace function public.collective_assert_unit_ids(
  p_organization_id uuid,
  p_unit_ids jsonb,
  p_require_nonempty boolean
)
returns uuid[]
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_arr uuid[] := array[]::uuid[];
  v_elem text;
  v_uid uuid;
  v_raw_count int;
  v_distinct_count int;
begin
  if p_unit_ids is null or jsonb_typeof(p_unit_ids) = 'null' then
    if p_require_nonempty then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end if;
    return v_arr;
  end if;

  if jsonb_typeof(p_unit_ids) <> 'array' then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  select count(*)::int,
         count(distinct value)::int
    into v_raw_count, v_distinct_count
  from jsonb_array_elements_text(p_unit_ids);

  if v_raw_count <> v_distinct_count then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  if p_require_nonempty and v_raw_count < 1 then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  if (not p_require_nonempty) and v_raw_count > 0 then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  for v_elem in
    select value from jsonb_array_elements_text(p_unit_ids)
  loop
    begin
      v_uid := v_elem::uuid;
    exception when others then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end;

    if not exists (
      select 1
      from public.organization_units ou
      where ou.id = v_uid
        and ou.organization_id = p_organization_id
        and ou.status = 'ativo'
    ) then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end if;

    v_arr := array_append(v_arr, v_uid);
  end loop;

  return v_arr;
end;
$$;

create or replace function public.collective_validate_scope_combo(
  p_scope_type text,
  p_unit_id uuid,
  p_unit_applicability text
)
returns void
language plpgsql
immutable
security invoker
set search_path = pg_catalog, public, auth
as $$
begin
  if p_scope_type = 'organization'
     and p_unit_id is null
     and p_unit_applicability in ('all_units', 'selected_units') then
    return;
  end if;
  if p_scope_type = 'unit'
     and p_unit_id is not null
     and p_unit_applicability is null then
    return;
  end if;
  perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
end;
$$;

-- criteria nao vazio: recusa tipada (SUP-D02).
create or replace function public.collective_assert_audience_payload(p_audience jsonb)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_label text;
  v_criteria jsonb;
begin
  if p_audience is null or jsonb_typeof(p_audience) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_audience) <> 'object' then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  if p_audience ? 'criteria' then
    v_criteria := p_audience -> 'criteria';
    if v_criteria is not null
       and jsonb_typeof(v_criteria) = 'object'
       and v_criteria <> '{}'::jsonb then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end if;
    if v_criteria is not null and jsonb_typeof(v_criteria) not in ('object', 'null') then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end if;
  end if;

  v_label := nullif(btrim(coalesce(p_audience ->> 'audience_label', '')), '');
  if v_label is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;
  return v_label;
end;
$$;

create or replace function public.collective_campaign_to_jsonb(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_c public.campaigns%rowtype;
  v_unit_ids jsonb;
  v_audience jsonb;
begin
  select * into v_c from public.campaigns where id = p_campaign_id;
  if not found then
    perform public.collective_raise('COLLECTIVE:NOT_FOUND');
  end if;

  select coalesce(jsonb_agg(cua.unit_id order by cua.unit_id), '[]'::jsonb)
    into v_unit_ids
  from public.campaign_unit_applicabilities cua
  where cua.campaign_id = p_campaign_id;

  select case
           when ca.id is null then null
           else jsonb_build_object('id', ca.id, 'audience_label', ca.audience_label)
         end
    into v_audience
  from public.campaign_audiences ca
  where ca.campaign_id = p_campaign_id;

  return jsonb_build_object(
    'id', v_c.id,
    'organization_id', v_c.organization_id,
    'title', v_c.title,
    'description', v_c.description,
    'channel', v_c.channel,
    'starts_at', v_c.starts_at,
    'ends_at', v_c.ends_at,
    'campaign_status', v_c.campaign_status,
    'status', v_c.status,
    'version', v_c.version,
    'scope_type', v_c.scope_type,
    'unit_id', v_c.unit_id,
    'unit_applicability', v_c.unit_applicability,
    'unit_ids', v_unit_ids,
    'audience', v_audience,
    'created_at', v_c.created_at,
    'updated_at', v_c.updated_at
  );
end;
$$;

create or replace function public.collective_action_plan_to_jsonb(p_action_plan_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_p public.action_plans%rowtype;
  v_unit_ids jsonb;
begin
  select * into v_p from public.action_plans where id = p_action_plan_id;
  if not found then
    perform public.collective_raise('COLLECTIVE:NOT_FOUND');
  end if;

  select coalesce(jsonb_agg(apua.unit_id order by apua.unit_id), '[]'::jsonb)
    into v_unit_ids
  from public.action_plan_unit_applicabilities apua
  where apua.action_plan_id = p_action_plan_id;

  return jsonb_build_object(
    'id', v_p.id,
    'organization_id', v_p.organization_id,
    'origin_indicator', v_p.origin_indicator,
    'issue_description', v_p.issue_description,
    'action_text', v_p.action_text,
    'owner_name', v_p.owner_name,
    'due_date', v_p.due_date,
    'priority', v_p.priority,
    'action_status', v_p.action_status,
    'status', v_p.status,
    'version', v_p.version,
    'scope_type', v_p.scope_type,
    'unit_id', v_p.unit_id,
    'unit_applicability', v_p.unit_applicability,
    'unit_ids', v_unit_ids,
    'created_at', v_p.created_at,
    'updated_at', v_p.updated_at
  );
end;
$$;

create or replace function public.collective_insert_campaign_units(
  p_campaign_id uuid,
  p_unit_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid;
begin
  foreach v_uid in array p_unit_ids
  loop
    insert into public.campaign_unit_applicabilities (campaign_id, unit_id)
    values (p_campaign_id, v_uid);
  end loop;
end;
$$;

create or replace function public.collective_insert_action_plan_units(
  p_action_plan_id uuid,
  p_unit_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid;
begin
  foreach v_uid in array p_unit_ids
  loop
    insert into public.action_plan_unit_applicabilities (action_plan_id, unit_id)
    values (p_action_plan_id, v_uid);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Campaign RPCs
-- ---------------------------------------------------------------------------

create or replace function public.collective_create_campaign_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_org uuid;
  v_scope text;
  v_unit uuid;
  v_appl text;
  v_unit_ids uuid[];
  v_audience jsonb;
  v_label text;
  v_id uuid;
  v_title text;
  v_description text;
  v_channel text;
  v_starts date;
  v_ends date;
  v_status text;
begin
  perform public.collective_assert_session();

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  begin
    v_org := (p_payload ->> 'organization_id')::uuid;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;

  perform public.collective_assert_active_membership(v_org);

  v_title := nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  v_description := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  v_channel := nullif(btrim(coalesce(p_payload ->> 'channel', '')), '');
  if v_title is null or v_description is null or v_channel is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  begin
    v_starts := (p_payload ->> 'starts_at')::date;
    v_ends := (p_payload ->> 'ends_at')::date;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;
  if v_starts is null or v_ends is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  v_scope := p_payload ->> 'scope_type';
  v_appl := p_payload ->> 'unit_applicability';
  if v_appl is not null and btrim(v_appl) = '' then
    v_appl := null;
  end if;
  begin
    if p_payload ? 'unit_id' and p_payload ->> 'unit_id' is not null and p_payload ->> 'unit_id' <> '' then
      v_unit := (p_payload ->> 'unit_id')::uuid;
    else
      v_unit := null;
    end if;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;

  perform public.collective_validate_scope_combo(v_scope, v_unit, v_appl);

  if v_scope = 'unit' then
    if not exists (
      select 1 from public.organization_units ou
      where ou.id = v_unit and ou.organization_id = v_org and ou.status = 'ativo'
    ) then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end if;
    v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', false);
  elsif v_appl = 'selected_units' then
    v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', true);
  else
    v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', false);
  end if;

  v_status := coalesce(nullif(btrim(coalesce(p_payload ->> 'campaign_status', '')), ''), 'ativa');

  v_audience := case
    when not (p_payload ? 'audience') then null
    when p_payload -> 'audience' is null then null
    when jsonb_typeof(p_payload -> 'audience') = 'null' then null
    else p_payload -> 'audience'
  end;
  if v_audience is not null then
    v_label := public.collective_assert_audience_payload(v_audience);
  end if;

  begin
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org, v_title, v_description, v_channel, v_starts, v_ends, v_status,
      v_scope, v_unit, v_appl
    )
    returning id into v_id;
  exception
    when insufficient_privilege then
      perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
    when others then
      if sqlstate = '42501' then
        perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
      else
        raise;
      end if;
  end;

  if v_id is null then
    perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
  end if;

  if v_appl = 'selected_units' then
    perform public.collective_insert_campaign_units(v_id, v_unit_ids);
  end if;

  if v_label is not null then
    begin
      insert into public.campaign_audiences (organization_id, campaign_id, audience_label)
      values (v_org, v_id, v_label);
    exception
      when insufficient_privilege then
        perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
      when others then
        if sqlstate = '42501' then
          perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
        else
          raise;
        end if;
    end;
  end if;

  return public.collective_campaign_to_jsonb(v_id);
end;
$$;

create or replace function public.collective_update_campaign_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_org uuid;
  v_id uuid;
  v_expected int;
  v_row public.campaigns%rowtype;
  v_locked public.campaigns%rowtype;
  v_scope text;
  v_unit uuid;
  v_appl text;
  v_unit_ids uuid[];
  v_has_scope boolean;
  v_old_selected boolean;
  v_new_selected boolean;
  v_audience_present boolean;
  v_audience jsonb;
  v_label text;
  v_title text;
  v_description text;
  v_channel text;
  v_starts date;
  v_ends date;
  v_cstatus text;
  v_updated int;
begin
  perform public.collective_assert_session();

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  begin
    v_org := (p_payload ->> 'organization_id')::uuid;
    v_id := (p_payload ->> 'campaign_id')::uuid;
    v_expected := (p_payload ->> 'expected_version')::int;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;

  if v_org is null or v_id is null or v_expected is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  perform public.collective_assert_active_membership(v_org);

  select * into v_row
  from public.campaigns c
  where c.id = v_id and c.organization_id = v_org;

  if not found then
    perform public.collective_raise('COLLECTIVE:NOT_FOUND');
  end if;

  select * into v_locked
  from public.campaigns c
  where c.id = v_id and c.organization_id = v_org
  for update;

  if not found then
    perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
  end if;

  if v_locked.version is distinct from v_expected then
    perform public.collective_raise('COLLECTIVE:CONFLICT');
  end if;

  v_has_scope := (p_payload ? 'scope_type')
    or (p_payload ? 'unit_id')
    or (p_payload ? 'unit_applicability')
    or (p_payload ? 'unit_ids');

  if v_has_scope then
    v_scope := coalesce(p_payload ->> 'scope_type', v_locked.scope_type);
    if p_payload ? 'unit_applicability' then
      v_appl := nullif(btrim(coalesce(p_payload ->> 'unit_applicability', '')), '');
    else
      v_appl := v_locked.unit_applicability;
    end if;
    begin
      if p_payload ? 'unit_id' then
        if p_payload ->> 'unit_id' is null or p_payload ->> 'unit_id' = '' then
          v_unit := null;
        else
          v_unit := (p_payload ->> 'unit_id')::uuid;
        end if;
      else
        v_unit := v_locked.unit_id;
      end if;
    exception when others then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end;

    -- Escopo informado deve ser combo completo coerente
    if p_payload ? 'scope_type' then
      if v_scope = 'organization' then
        v_unit := null;
        if not (p_payload ? 'unit_applicability') then
          perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
        end if;
      elsif v_scope = 'unit' then
        v_appl := null;
        if v_unit is null then
          perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
        end if;
      end if;
    end if;

    perform public.collective_validate_scope_combo(v_scope, v_unit, v_appl);

    if v_scope = 'unit' then
      if not exists (
        select 1 from public.organization_units ou
        where ou.id = v_unit and ou.organization_id = v_org and ou.status = 'ativo'
      ) then
        perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
      end if;
      v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', false);
    elsif v_appl = 'selected_units' then
      v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', true);
    else
      v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', false);
    end if;
  else
    v_scope := v_locked.scope_type;
    v_unit := v_locked.unit_id;
    v_appl := v_locked.unit_applicability;
    v_unit_ids := null;
  end if;

  v_title := case when p_payload ? 'title' then nullif(btrim(coalesce(p_payload ->> 'title', '')), '') else v_locked.title end;
  v_description := case when p_payload ? 'description' then nullif(btrim(coalesce(p_payload ->> 'description', '')), '') else v_locked.description end;
  v_channel := case when p_payload ? 'channel' then nullif(btrim(coalesce(p_payload ->> 'channel', '')), '') else v_locked.channel end;
  if v_title is null or v_description is null or v_channel is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  begin
    v_starts := case when p_payload ? 'starts_at' then (p_payload ->> 'starts_at')::date else v_locked.starts_at end;
    v_ends := case when p_payload ? 'ends_at' then (p_payload ->> 'ends_at')::date else v_locked.ends_at end;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;

  v_cstatus := case
    when p_payload ? 'campaign_status' then nullif(btrim(coalesce(p_payload ->> 'campaign_status', '')), '')
    else v_locked.campaign_status
  end;
  if v_cstatus is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  v_old_selected := (v_locked.scope_type = 'organization' and v_locked.unit_applicability = 'selected_units');
  v_new_selected := (v_scope = 'organization' and v_appl = 'selected_units');

  -- Transicoes: limpar aplicabilidades antes de sair de selected_units;
  -- inserir apos pai compativel ao entrar/substituir.
  if v_has_scope and v_old_selected and not v_new_selected then
    delete from public.campaign_unit_applicabilities where campaign_id = v_id;
  end if;

  if v_has_scope and v_old_selected and v_new_selected then
    delete from public.campaign_unit_applicabilities where campaign_id = v_id;
  end if;

  update public.campaigns c
     set title = v_title,
         description = v_description,
         channel = v_channel,
         starts_at = v_starts,
         ends_at = v_ends,
         campaign_status = v_cstatus,
         scope_type = v_scope,
         unit_id = v_unit,
         unit_applicability = v_appl,
         version = c.version + 1,
         updated_at = now()
   where c.id = v_id
     and c.organization_id = v_org
     and c.version = v_expected;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    -- Visivel no SELECT mas sem escrita RLS, ou conflito de versao concurrente
    if exists (
      select 1 from public.campaigns c
      where c.id = v_id and c.organization_id = v_org and c.version is distinct from v_expected
    ) then
      perform public.collective_raise('COLLECTIVE:CONFLICT');
    end if;
    perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
  end if;

  if v_has_scope and v_new_selected then
    perform public.collective_insert_campaign_units(v_id, v_unit_ids);
  end if;

  v_audience_present := p_payload ? 'audience';
  if v_audience_present then
    v_audience := p_payload -> 'audience';
    if v_audience is null or jsonb_typeof(v_audience) = 'null' then
      delete from public.campaign_audiences where campaign_id = v_id;
    else
      v_label := public.collective_assert_audience_payload(v_audience);
      insert into public.campaign_audiences (organization_id, campaign_id, audience_label)
      values (v_org, v_id, v_label)
      on conflict on constraint campaign_audiences_one_per_campaign
      do update set
        audience_label = excluded.audience_label,
        updated_at = now(),
        version = public.campaign_audiences.version + 1;
    end if;
  end if;

  return public.collective_campaign_to_jsonb(v_id);
end;
$$;

create or replace function public.collective_delete_campaign_atomic(
  p_organization_id uuid,
  p_campaign_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_row public.campaigns%rowtype;
  v_deleted int;
begin
  perform public.collective_assert_session();
  perform public.collective_assert_active_membership(p_organization_id);

  if p_campaign_id is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  select * into v_row
  from public.campaigns c
  where c.id = p_campaign_id and c.organization_id = p_organization_id;

  if not found then
    perform public.collective_raise('COLLECTIVE:NOT_FOUND');
  end if;

  -- Audiencia sem CASCADE: remover antes do pai.
  delete from public.campaign_audiences ca
  where ca.campaign_id = p_campaign_id
    and ca.organization_id = p_organization_id;

  delete from public.campaigns c
  where c.id = p_campaign_id
    and c.organization_id = p_organization_id;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
  end if;

  return jsonb_build_object('id', p_campaign_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Action plan RPCs
-- ---------------------------------------------------------------------------

create or replace function public.collective_create_action_plan_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_org uuid;
  v_scope text;
  v_unit uuid;
  v_appl text;
  v_unit_ids uuid[];
  v_id uuid;
  v_origin text;
  v_issue text;
  v_action text;
  v_owner text;
  v_due date;
  v_priority text;
  v_astatus text;
begin
  perform public.collective_assert_session();

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  begin
    v_org := (p_payload ->> 'organization_id')::uuid;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;

  perform public.collective_assert_active_membership(v_org);

  v_origin := nullif(btrim(coalesce(p_payload ->> 'origin_indicator', '')), '');
  v_issue := nullif(btrim(coalesce(p_payload ->> 'issue_description', '')), '');
  v_action := nullif(btrim(coalesce(p_payload ->> 'action_text', '')), '');
  v_owner := nullif(btrim(coalesce(p_payload ->> 'owner_name', '')), '');
  v_priority := nullif(btrim(coalesce(p_payload ->> 'priority', '')), '');
  v_astatus := coalesce(nullif(btrim(coalesce(p_payload ->> 'action_status', '')), ''), 'em_andamento');

  if v_origin is null or v_issue is null or v_action is null or v_owner is null or v_priority is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  begin
    v_due := (p_payload ->> 'due_date')::date;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;
  if v_due is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  v_scope := p_payload ->> 'scope_type';
  v_appl := p_payload ->> 'unit_applicability';
  if v_appl is not null and btrim(v_appl) = '' then
    v_appl := null;
  end if;
  begin
    if p_payload ? 'unit_id' and p_payload ->> 'unit_id' is not null and p_payload ->> 'unit_id' <> '' then
      v_unit := (p_payload ->> 'unit_id')::uuid;
    else
      v_unit := null;
    end if;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;

  perform public.collective_validate_scope_combo(v_scope, v_unit, v_appl);

  if v_scope = 'unit' then
    if not exists (
      select 1 from public.organization_units ou
      where ou.id = v_unit and ou.organization_id = v_org and ou.status = 'ativo'
    ) then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end if;
    v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', false);
  elsif v_appl = 'selected_units' then
    v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', true);
  else
    v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', false);
  end if;

  begin
    insert into public.action_plans (
      organization_id, origin_indicator, issue_description, action_text, owner_name,
      due_date, priority, action_status, scope_type, unit_id, unit_applicability
    ) values (
      v_org, v_origin, v_issue, v_action, v_owner,
      v_due, v_priority, v_astatus, v_scope, v_unit, v_appl
    )
    returning id into v_id;
  exception
    when insufficient_privilege then
      perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
    when others then
      if sqlstate = '42501' then
        perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
      else
        raise;
      end if;
  end;

  if v_id is null then
    perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
  end if;

  if v_appl = 'selected_units' then
    perform public.collective_insert_action_plan_units(v_id, v_unit_ids);
  end if;

  return public.collective_action_plan_to_jsonb(v_id);
end;
$$;

create or replace function public.collective_update_action_plan_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_org uuid;
  v_id uuid;
  v_expected int;
  v_row public.action_plans%rowtype;
  v_locked public.action_plans%rowtype;
  v_scope text;
  v_unit uuid;
  v_appl text;
  v_unit_ids uuid[];
  v_has_scope boolean;
  v_old_selected boolean;
  v_new_selected boolean;
  v_origin text;
  v_issue text;
  v_action text;
  v_owner text;
  v_due date;
  v_priority text;
  v_astatus text;
  v_updated int;
begin
  perform public.collective_assert_session();

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  begin
    v_org := (p_payload ->> 'organization_id')::uuid;
    v_id := (p_payload ->> 'action_plan_id')::uuid;
    v_expected := (p_payload ->> 'expected_version')::int;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;

  if v_org is null or v_id is null or v_expected is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  perform public.collective_assert_active_membership(v_org);

  select * into v_row
  from public.action_plans p
  where p.id = v_id and p.organization_id = v_org;

  if not found then
    perform public.collective_raise('COLLECTIVE:NOT_FOUND');
  end if;

  select * into v_locked
  from public.action_plans p
  where p.id = v_id and p.organization_id = v_org
  for update;

  if not found then
    perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
  end if;

  if v_locked.version is distinct from v_expected then
    perform public.collective_raise('COLLECTIVE:CONFLICT');
  end if;

  v_has_scope := (p_payload ? 'scope_type')
    or (p_payload ? 'unit_id')
    or (p_payload ? 'unit_applicability')
    or (p_payload ? 'unit_ids');

  if v_has_scope then
    v_scope := coalesce(p_payload ->> 'scope_type', v_locked.scope_type);
    if p_payload ? 'unit_applicability' then
      v_appl := nullif(btrim(coalesce(p_payload ->> 'unit_applicability', '')), '');
    else
      v_appl := v_locked.unit_applicability;
    end if;
    begin
      if p_payload ? 'unit_id' then
        if p_payload ->> 'unit_id' is null or p_payload ->> 'unit_id' = '' then
          v_unit := null;
        else
          v_unit := (p_payload ->> 'unit_id')::uuid;
        end if;
      else
        v_unit := v_locked.unit_id;
      end if;
    exception when others then
      perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
    end;

    if p_payload ? 'scope_type' then
      if v_scope = 'organization' then
        v_unit := null;
        if not (p_payload ? 'unit_applicability') then
          perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
        end if;
      elsif v_scope = 'unit' then
        v_appl := null;
        if v_unit is null then
          perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
        end if;
      end if;
    end if;

    perform public.collective_validate_scope_combo(v_scope, v_unit, v_appl);

    if v_scope = 'unit' then
      if not exists (
        select 1 from public.organization_units ou
        where ou.id = v_unit and ou.organization_id = v_org and ou.status = 'ativo'
      ) then
        perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
      end if;
      v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', false);
    elsif v_appl = 'selected_units' then
      v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', true);
    else
      v_unit_ids := public.collective_assert_unit_ids(v_org, p_payload -> 'unit_ids', false);
    end if;
  else
    v_scope := v_locked.scope_type;
    v_unit := v_locked.unit_id;
    v_appl := v_locked.unit_applicability;
    v_unit_ids := null;
  end if;

  v_origin := case when p_payload ? 'origin_indicator' then nullif(btrim(coalesce(p_payload ->> 'origin_indicator', '')), '') else v_locked.origin_indicator end;
  v_issue := case when p_payload ? 'issue_description' then nullif(btrim(coalesce(p_payload ->> 'issue_description', '')), '') else v_locked.issue_description end;
  v_action := case when p_payload ? 'action_text' then nullif(btrim(coalesce(p_payload ->> 'action_text', '')), '') else v_locked.action_text end;
  v_owner := case when p_payload ? 'owner_name' then nullif(btrim(coalesce(p_payload ->> 'owner_name', '')), '') else v_locked.owner_name end;
  v_priority := case when p_payload ? 'priority' then nullif(btrim(coalesce(p_payload ->> 'priority', '')), '') else v_locked.priority end;
  v_astatus := case when p_payload ? 'action_status' then nullif(btrim(coalesce(p_payload ->> 'action_status', '')), '') else v_locked.action_status end;

  if v_origin is null or v_issue is null or v_action is null or v_owner is null or v_priority is null or v_astatus is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  begin
    v_due := case when p_payload ? 'due_date' then (p_payload ->> 'due_date')::date else v_locked.due_date end;
  exception when others then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end;

  v_old_selected := (v_locked.scope_type = 'organization' and v_locked.unit_applicability = 'selected_units');
  v_new_selected := (v_scope = 'organization' and v_appl = 'selected_units');

  if v_has_scope and v_old_selected and not v_new_selected then
    delete from public.action_plan_unit_applicabilities where action_plan_id = v_id;
  end if;

  if v_has_scope and v_old_selected and v_new_selected then
    delete from public.action_plan_unit_applicabilities where action_plan_id = v_id;
  end if;

  update public.action_plans p
     set origin_indicator = v_origin,
         issue_description = v_issue,
         action_text = v_action,
         owner_name = v_owner,
         due_date = v_due,
         priority = v_priority,
         action_status = v_astatus,
         scope_type = v_scope,
         unit_id = v_unit,
         unit_applicability = v_appl,
         version = p.version + 1,
         updated_at = now()
   where p.id = v_id
     and p.organization_id = v_org
     and p.version = v_expected;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    if exists (
      select 1 from public.action_plans p
      where p.id = v_id and p.organization_id = v_org and p.version is distinct from v_expected
    ) then
      perform public.collective_raise('COLLECTIVE:CONFLICT');
    end if;
    perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
  end if;

  if v_has_scope and v_new_selected then
    perform public.collective_insert_action_plan_units(v_id, v_unit_ids);
  end if;

  return public.collective_action_plan_to_jsonb(v_id);
end;
$$;

create or replace function public.collective_delete_action_plan_atomic(
  p_organization_id uuid,
  p_action_plan_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_row public.action_plans%rowtype;
  v_deleted int;
begin
  perform public.collective_assert_session();
  perform public.collective_assert_active_membership(p_organization_id);

  if p_action_plan_id is null then
    perform public.collective_raise('COLLECTIVE:INVALID_INPUT');
  end if;

  select * into v_row
  from public.action_plans p
  where p.id = p_action_plan_id and p.organization_id = p_organization_id;

  if not found then
    perform public.collective_raise('COLLECTIVE:NOT_FOUND');
  end if;

  delete from public.action_plans p
  where p.id = p_action_plan_id
    and p.organization_id = p_organization_id;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    perform public.collective_raise('COLLECTIVE:AUTHORIZATION_DENIED');
  end if;

  return jsonb_build_object('id', p_action_plan_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Grants: PUBLIC/anon sem EXECUTE; authenticated nas RPCs e helpers INVOKER
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'collective_raise',
        'collective_assert_session',
        'collective_assert_active_membership',
        'collective_assert_unit_ids',
        'collective_validate_scope_combo',
        'collective_assert_audience_payload',
        'collective_campaign_to_jsonb',
        'collective_action_plan_to_jsonb',
        'collective_insert_campaign_units',
        'collective_insert_action_plan_units',
        'collective_create_campaign_atomic',
        'collective_update_campaign_atomic',
        'collective_delete_campaign_atomic',
        'collective_create_action_plan_atomic',
        'collective_update_action_plan_atomic',
        'collective_delete_action_plan_atomic'
      )
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', r.sig);
    end if;
  end loop;
end $$;

commit;
