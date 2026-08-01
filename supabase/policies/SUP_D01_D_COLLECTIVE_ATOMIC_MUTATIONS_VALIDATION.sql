-- Validacao executavel SUP-D01-D (migration 0018).
-- Premissa: migrations 0001..0018 + harness auth.uid()/authenticated + auth.users.
-- Escopo: RPCs atomicas, audiencia singular, transicoes de escopo, auth/RLS, B1.
-- Fora: agregacoes/suppressed (D02), UI, repositories.

begin;

do $$
declare
  v_org_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_org_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_unit_a1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
  v_unit_a2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02';
  v_unit_b1 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01';
  v_gestor uuid := '11111111-1111-1111-1111-111111111101';
  v_sst_unit uuid := '11111111-1111-1111-1111-111111111102';
  v_sst_other uuid := '11111111-1111-1111-1111-111111111103';
  v_auditor uuid := '11111111-1111-1111-1111-111111111104';
  v_admin_bio uuid := '11111111-1111-1111-1111-111111111105';
  v_medico uuid := '11111111-1111-1111-1111-111111111106';
  v_gestor_b uuid := '22222222-2222-2222-2222-222222222201';
  v_role_gestor uuid;
  v_role_sst uuid;
  v_role_auditor uuid;
  v_role_admin_bio uuid;
  v_role_medico uuid;
  v_uo uuid;
  v_json jsonb;
  v_id uuid;
  v_id2 uuid;
  v_plan uuid;
  v_version int;
  v_count int;
  v_failed boolean;
  v_label text;
  v_msg text;
  v_state text;
begin
  -- ---------------------------------------------------------------------------
  -- Estrutura
  -- ---------------------------------------------------------------------------
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_audiences_one_per_campaign'
  ) then
    raise exception 'STRUCT: campaign_audiences_one_per_campaign ausente';
  end if;
  if to_regprocedure('public.collective_create_campaign_atomic(jsonb)') is null then
    raise exception 'STRUCT: collective_create_campaign_atomic ausente';
  end if;
  if to_regprocedure('public.collective_update_campaign_atomic(jsonb)') is null then
    raise exception 'STRUCT: collective_update_campaign_atomic ausente';
  end if;
  if to_regprocedure('public.collective_delete_campaign_atomic(uuid,uuid)') is null then
    raise exception 'STRUCT: collective_delete_campaign_atomic ausente';
  end if;
  if to_regprocedure('public.collective_create_action_plan_atomic(jsonb)') is null then
    raise exception 'STRUCT: collective_create_action_plan_atomic ausente';
  end if;
  if to_regprocedure('public.collective_update_action_plan_atomic(jsonb)') is null then
    raise exception 'STRUCT: collective_update_action_plan_atomic ausente';
  end if;
  if to_regprocedure('public.collective_delete_action_plan_atomic(uuid,uuid)') is null then
    raise exception 'STRUCT: collective_delete_action_plan_atomic ausente';
  end if;

  -- ---------------------------------------------------------------------------
  -- Seed minimo (mesmos UUIDs D01-B)
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_gestor, 'gestor.a@example.com', '{}'::jsonb),
    (v_sst_unit, 'sst.a1@example.com', '{}'::jsonb),
    (v_sst_other, 'sst.a2@example.com', '{}'::jsonb),
    (v_auditor, 'auditor.a@example.com', '{}'::jsonb),
    (v_admin_bio, 'admin.bio@example.com', '{}'::jsonb),
    (v_medico, 'medico.a@example.com', '{}'::jsonb),
    (v_gestor_b, 'gestor.b@example.com', '{}'::jsonb)
  on conflict (id) do update set email = excluded.email;

  insert into public.organizations (id, name, status)
  values (v_org_a, 'Org A', 'ativo'), (v_org_b, 'Org B', 'ativo')
  on conflict (id) do nothing;

  insert into public.organization_units (id, organization_id, name, status)
  values
    (v_unit_a1, v_org_a, 'Unit A1', 'ativo'),
    (v_unit_a2, v_org_a, 'Unit A2', 'ativo'),
    (v_unit_b1, v_org_b, 'Unit B1', 'ativo')
  on conflict (id) do nothing;

  insert into public.roles (code, description, status)
  values
    ('gestor_institucional', 'Gestor', 'ativo'),
    ('sst', 'SST', 'ativo'),
    ('auditor', 'Auditor', 'ativo'),
    ('admin_biomed', 'Admin Biomed', 'ativo'),
    ('medico', 'Medico', 'ativo')
  on conflict (code) do nothing;

  select id into v_role_gestor from public.roles where code = 'gestor_institucional';
  select id into v_role_sst from public.roles where code = 'sst';
  select id into v_role_auditor from public.roles where code = 'auditor';
  select id into v_role_admin_bio from public.roles where code = 'admin_biomed';
  select id into v_role_medico from public.roles where code = 'medico';

  insert into public.user_organizations (organization_id, user_id, status)
  values
    (v_org_a, v_gestor, 'ativo'),
    (v_org_a, v_sst_unit, 'ativo'),
    (v_org_a, v_sst_other, 'ativo'),
    (v_org_a, v_auditor, 'ativo'),
    (v_org_a, v_admin_bio, 'ativo'),
    (v_org_a, v_medico, 'ativo'),
    (v_org_b, v_gestor_b, 'ativo')
  on conflict (organization_id, user_id) do update set status = 'ativo';

  select id into v_uo from public.user_organizations where organization_id = v_org_a and user_id = v_gestor;
  insert into public.user_roles (organization_id, user_organization_id, role_id, unit_id, status)
  values (v_org_a, v_uo, v_role_gestor, null, 'ativo')
  on conflict do nothing;

  select id into v_uo from public.user_organizations where organization_id = v_org_a and user_id = v_sst_unit;
  insert into public.user_roles (organization_id, user_organization_id, role_id, unit_id, status)
  values (v_org_a, v_uo, v_role_sst, v_unit_a1, 'ativo')
  on conflict do nothing;

  select id into v_uo from public.user_organizations where organization_id = v_org_a and user_id = v_sst_other;
  insert into public.user_roles (organization_id, user_organization_id, role_id, unit_id, status)
  values (v_org_a, v_uo, v_role_sst, v_unit_a2, 'ativo')
  on conflict do nothing;

  select id into v_uo from public.user_organizations where organization_id = v_org_a and user_id = v_auditor;
  insert into public.user_roles (organization_id, user_organization_id, role_id, unit_id, status)
  values (v_org_a, v_uo, v_role_auditor, null, 'ativo')
  on conflict do nothing;

  select id into v_uo from public.user_organizations where organization_id = v_org_a and user_id = v_admin_bio;
  insert into public.user_roles (organization_id, user_organization_id, role_id, unit_id, status)
  values (v_org_a, v_uo, v_role_admin_bio, null, 'ativo')
  on conflict do nothing;

  select id into v_uo from public.user_organizations where organization_id = v_org_a and user_id = v_medico;
  insert into public.user_roles (organization_id, user_organization_id, role_id, unit_id, status)
  values (v_org_a, v_uo, v_role_medico, null, 'ativo')
  on conflict do nothing;

  select id into v_uo from public.user_organizations where organization_id = v_org_b and user_id = v_gestor_b;
  insert into public.user_roles (organization_id, user_organization_id, role_id, unit_id, status)
  values (v_org_b, v_uo, v_role_gestor, null, 'ativo')
  on conflict do nothing;

  -- ---------------------------------------------------------------------------
  -- Sessao gestor A
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';

  -- Create all_units
  v_json := public.collective_create_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'title', 'D01D all',
    'description', 'd',
    'channel', 'email',
    'starts_at', current_date,
    'ends_at', current_date + 10,
    'scope_type', 'organization',
    'unit_id', null,
    'unit_applicability', 'all_units',
    'audience', jsonb_build_object('audience_label', 'Colabs')
  ));
  v_id := (v_json ->> 'id')::uuid;
  if v_json ->> 'unit_applicability' <> 'all_units' then
    raise exception 'CREATE: all_units falhou';
  end if;
  if v_json -> 'audience' ->> 'audience_label' <> 'Colabs' then
    raise exception 'CREATE: audiencia ausente';
  end if;
  if jsonb_array_length(v_json -> 'unit_ids') <> 0 then
    raise exception 'CREATE: all_units nao deve ter unit_ids';
  end if;

  -- Create unit
  v_json := public.collective_create_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'title', 'D01D unit',
    'description', 'd',
    'channel', 'email',
    'starts_at', current_date,
    'ends_at', current_date + 10,
    'scope_type', 'unit',
    'unit_id', v_unit_a1,
    'unit_applicability', null
  ));
  if v_json ->> 'scope_type' <> 'unit' or (v_json ->> 'unit_id')::uuid <> v_unit_a1 then
    raise exception 'CREATE: unit falhou';
  end if;
  v_id2 := (v_json ->> 'id')::uuid;

  -- Create selected_units
  v_json := public.collective_create_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'title', 'D01D selected',
    'description', 'd',
    'channel', 'email',
    'starts_at', current_date,
    'ends_at', current_date + 10,
    'scope_type', 'organization',
    'unit_id', null,
    'unit_applicability', 'selected_units',
    'unit_ids', jsonb_build_array(v_unit_a1, v_unit_a2)
  ));
  if jsonb_array_length(v_json -> 'unit_ids') <> 2 then
    raise exception 'CREATE: selected_units falhou (unit_ids)';
  end if;
  v_id := (v_json ->> 'id')::uuid;
  v_version := (v_json ->> 'version')::int;

  -- ---------------------------------------------------------------------------
  -- Transicoes de escopo (sobre v_id selected)
  -- ---------------------------------------------------------------------------
  -- selected -> all_units
  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'scope_type', 'organization',
    'unit_id', null,
    'unit_applicability', 'all_units'
  ));
  v_version := (v_json ->> 'version')::int;
  if v_json ->> 'unit_applicability' <> 'all_units' or jsonb_array_length(v_json -> 'unit_ids') <> 0 then
    raise exception 'TRANS: selected->all_units falhou';
  end if;
  select count(*) into v_count from public.campaign_unit_applicabilities where campaign_id = v_id;
  if v_count <> 0 then
    raise exception 'TRANS: residual applicability apos selected->all';
  end if;

  -- all_units -> unit
  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'scope_type', 'unit',
    'unit_id', v_unit_a1,
    'unit_applicability', null
  ));
  v_version := (v_json ->> 'version')::int;
  if v_json ->> 'scope_type' <> 'unit' then
    raise exception 'TRANS: all->unit falhou';
  end if;

  -- unit -> selected_units
  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'scope_type', 'organization',
    'unit_id', null,
    'unit_applicability', 'selected_units',
    'unit_ids', jsonb_build_array(v_unit_a1)
  ));
  v_version := (v_json ->> 'version')::int;
  if jsonb_array_length(v_json -> 'unit_ids') <> 1 then
    raise exception 'TRANS: unit->selected falhou';
  end if;

  -- selected -> selected (replace list)
  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'scope_type', 'organization',
    'unit_id', null,
    'unit_applicability', 'selected_units',
    'unit_ids', jsonb_build_array(v_unit_a2)
  ));
  v_version := (v_json ->> 'version')::int;
  if jsonb_array_length(v_json -> 'unit_ids') <> 1
     or (v_json -> 'unit_ids' ->> 0)::uuid <> v_unit_a2 then
    raise exception 'TRANS: replace unit list falhou';
  end if;

  -- selected -> unit
  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'scope_type', 'unit',
    'unit_id', v_unit_a2,
    'unit_applicability', null
  ));
  v_version := (v_json ->> 'version')::int;
  if v_json ->> 'scope_type' <> 'unit' then
    raise exception 'TRANS: selected->unit falhou';
  end if;

  -- unit -> all_units
  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'scope_type', 'organization',
    'unit_id', null,
    'unit_applicability', 'all_units'
  ));
  v_version := (v_json ->> 'version')::int;
  if v_json ->> 'unit_applicability' <> 'all_units' then
    raise exception 'TRANS: unit->all falhou';
  end if;

  -- all_units -> selected_units
  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'scope_type', 'organization',
    'unit_id', null,
    'unit_applicability', 'selected_units',
    'unit_ids', jsonb_build_array(v_unit_a1, v_unit_a2)
  ));
  v_version := (v_json ->> 'version')::int;
  if jsonb_array_length(v_json -> 'unit_ids') <> 2 then
    raise exception 'TRANS: all->selected falhou';
  end if;

  -- ---------------------------------------------------------------------------
  -- Audiencia: update / null remove / omit preserve
  -- ---------------------------------------------------------------------------
  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'audience', jsonb_build_object('audience_label', 'Grupo X')
  ));
  v_version := (v_json ->> 'version')::int;
  if v_json -> 'audience' ->> 'audience_label' <> 'Grupo X' then
    raise exception 'AUD: upsert falhou';
  end if;

  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'title', 'D01D selected renamed'
  ));
  v_version := (v_json ->> 'version')::int;
  if v_json -> 'audience' ->> 'audience_label' <> 'Grupo X' then
    raise exception 'AUD: omit nao preservou';
  end if;

  v_json := public.collective_update_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'campaign_id', v_id,
    'expected_version', v_version,
    'audience', null
  ));
  v_version := (v_json ->> 'version')::int;
  if v_json -> 'audience' is not null and jsonb_typeof(v_json -> 'audience') <> 'null' then
    raise exception 'AUD: null nao removeu';
  end if;
  select count(*) into v_count from public.campaign_audiences where campaign_id = v_id;
  if v_count <> 0 then
    raise exception 'AUD: residual apos null';
  end if;

  -- criteria nao vazio
  begin
    v_failed := false;
    perform public.collective_update_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'campaign_id', v_id,
      'expected_version', v_version,
      'audience', jsonb_build_object(
        'audience_label', 'Bad',
        'criteria', jsonb_build_object('age', 30)
      )
    ));
  exception when others then
    v_failed := (sqlerrm like '%COLLECTIVE:INVALID_INPUT%');
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'AUD: criteria nao vazio deveria falhar';
  end if;

  -- ---------------------------------------------------------------------------
  -- Conflito de versao
  -- ---------------------------------------------------------------------------
  begin
    v_failed := false;
    perform public.collective_update_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'campaign_id', v_id,
      'expected_version', v_version - 1,
      'title', 'conflict'
    ));
  exception when others then
    v_failed := (sqlerrm like '%COLLECTIVE:CONFLICT%');
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'VERSION: conflito deveria falhar';
  end if;

  -- ---------------------------------------------------------------------------
  -- Rejeicoes de entrada
  -- ---------------------------------------------------------------------------
  begin
    v_failed := false;
    perform public.collective_create_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'title', 'empty sel',
      'description', 'd',
      'channel', 'email',
      'starts_at', current_date,
      'ends_at', current_date + 1,
      'scope_type', 'organization',
      'unit_applicability', 'selected_units',
      'unit_ids', '[]'::jsonb
    ));
  exception when others then
    v_failed := (sqlerrm like '%COLLECTIVE:INVALID_INPUT%');
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'NEG: lista vazia deveria falhar';
  end if;

  begin
    v_failed := false;
    perform public.collective_create_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'title', 'dup units',
      'description', 'd',
      'channel', 'email',
      'starts_at', current_date,
      'ends_at', current_date + 1,
      'scope_type', 'organization',
      'unit_applicability', 'selected_units',
      'unit_ids', jsonb_build_array(v_unit_a1, v_unit_a1)
    ));
  exception when others then
    v_failed := (sqlerrm like '%COLLECTIVE:INVALID_INPUT%');
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'NEG: duplicata deveria falhar';
  end if;

  begin
    v_failed := false;
    perform public.collective_create_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'title', 'foreign unit',
      'description', 'd',
      'channel', 'email',
      'starts_at', current_date,
      'ends_at', current_date + 1,
      'scope_type', 'organization',
      'unit_applicability', 'selected_units',
      'unit_ids', jsonb_build_array(v_unit_a1, v_unit_b1)
    ));
  exception when others then
    v_failed := (sqlerrm like '%COLLECTIVE:INVALID_INPUT%');
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'NEG: unidade estrangeira deveria falhar';
  end if;

  -- Falha intermediaria: sem residual
  select count(*) into v_count from public.campaigns where title = 'foreign unit';
  if v_count <> 0 then
    raise exception 'ATOMIC: residual apos falha intermediaria';
  end if;

  -- ---------------------------------------------------------------------------
  -- Sem sessao
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role authenticated';
  begin
    v_failed := false;
    perform public.collective_create_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'title', 'no sess',
      'description', 'd',
      'channel', 'email',
      'starts_at', current_date,
      'ends_at', current_date + 1,
      'scope_type', 'organization',
      'unit_applicability', 'all_units'
    ));
  exception when others then
    v_failed := (sqlerrm like '%COLLECTIVE:NO_SESSION%');
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'AUTH: no session deveria falhar';
  end if;

  -- ---------------------------------------------------------------------------
  -- Membership inativo
  -- ---------------------------------------------------------------------------
  reset role;
  update public.user_organizations
     set status = 'inativo'
   where organization_id = v_org_a and user_id = v_gestor;

  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';
  begin
    v_failed := false;
    perform public.collective_create_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'title', 'inactive',
      'description', 'd',
      'channel', 'email',
      'starts_at', current_date,
      'ends_at', current_date + 1,
      'scope_type', 'organization',
      'unit_applicability', 'all_units'
    ));
  exception when others then
    v_failed := (sqlerrm like '%COLLECTIVE:NO_ACTIVE_MEMBERSHIP%');
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'AUTH: membership inativo deveria falhar';
  end if;

  reset role;
  update public.user_organizations
     set status = 'ativo'
   where organization_id = v_org_a and user_id = v_gestor;

  -- ---------------------------------------------------------------------------
  -- Cross-tenant
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';
  begin
    v_failed := false;
    perform public.collective_create_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_b,
      'title', 'cross',
      'description', 'd',
      'channel', 'email',
      'starts_at', current_date,
      'ends_at', current_date + 1,
      'scope_type', 'organization',
      'unit_applicability', 'all_units'
    ));
  exception when others then
    v_failed := (
      sqlerrm like '%COLLECTIVE:NO_ACTIVE_MEMBERSHIP%'
      or sqlerrm like '%COLLECTIVE:AUTHORIZATION_DENIED%'
      or sqlerrm like '%COLLECTIVE:NOT_FOUND%'
    );
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'AUTH: cross-tenant create deveria falhar';
  end if;

  begin
    v_failed := false;
    perform public.collective_update_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_b,
      'campaign_id', v_id,
      'expected_version', 1,
      'title', 'hack'
    ));
  exception when others then
    v_failed := (
      sqlerrm like '%COLLECTIVE:NO_ACTIVE_MEMBERSHIP%'
      or sqlerrm like '%COLLECTIVE:NOT_FOUND%'
    );
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'AUTH: cross-tenant update deveria falhar';
  end if;

  -- ---------------------------------------------------------------------------
  -- Auditor sem escrita
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', v_auditor::text, true);
  execute 'set local role authenticated';
  begin
    v_failed := false;
    perform public.collective_create_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'title', 'auditor write',
      'description', 'd',
      'channel', 'email',
      'starts_at', current_date,
      'ends_at', current_date + 1,
      'scope_type', 'organization',
      'unit_applicability', 'all_units'
    ));
  exception when others then
    v_failed := (
      sqlerrm like '%COLLECTIVE:AUTHORIZATION_DENIED%'
      or sqlstate = '42501'
    );
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'AUTH: auditor nao deve criar';
  end if;

  -- ---------------------------------------------------------------------------
  -- anon/public sem EXECUTE
  -- ---------------------------------------------------------------------------
  reset role;
  if has_function_privilege('public', 'public.collective_create_campaign_atomic(jsonb)', 'execute') then
    raise exception 'GRANT: PUBLIC nao deve EXECUTE create_campaign';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if has_function_privilege('anon', 'public.collective_create_campaign_atomic(jsonb)', 'execute') then
      raise exception 'GRANT: anon nao deve EXECUTE create_campaign';
    end if;
    if has_function_privilege('anon', 'public.collective_delete_campaign_atomic(uuid,uuid)', 'execute') then
      raise exception 'GRANT: anon nao deve EXECUTE delete_campaign';
    end if;
  end if;
  if not has_function_privilege('authenticated', 'public.collective_create_campaign_atomic(jsonb)', 'execute') then
    raise exception 'GRANT: authenticated DEVE EXECUTE create_campaign';
  end if;

  -- ---------------------------------------------------------------------------
  -- B1: unit_belongs_to_organization ainda inacessivel
  -- ---------------------------------------------------------------------------
  if has_function_privilege(
    'authenticated',
    'app_auth.unit_belongs_to_organization(uuid,uuid)',
    'execute'
  ) then
    raise exception 'B1: authenticated nao deve ter EXECUTE em unit_belongs_to_organization';
  end if;
  if has_function_privilege(
    'public',
    'app_auth.unit_belongs_to_organization(uuid,uuid)',
    'execute'
  ) then
    raise exception 'B1: PUBLIC nao deve ter EXECUTE em unit_belongs_to_organization';
  end if;

  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';
  begin
    v_failed := false;
    execute format(
      'select app_auth.unit_belongs_to_organization(%L::uuid, %L::uuid)',
      v_unit_a1, v_org_a
    );
  exception when insufficient_privilege then
    v_failed := true;
  when others then
    if sqlstate = '42501' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'B1: chamada direta unit_belongs deveria ser negada';
  end if;

  -- ---------------------------------------------------------------------------
  -- Action plans (simetrico sem audiencia)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';

  v_json := public.collective_create_action_plan_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'origin_indicator', 'ind',
    'issue_description', 'issue',
    'action_text', 'act',
    'owner_name', 'Owner',
    'due_date', current_date + 20,
    'priority', 'alta',
    'action_status', 'em_andamento',
    'scope_type', 'organization',
    'unit_applicability', 'selected_units',
    'unit_ids', jsonb_build_array(v_unit_a1)
  ));
  v_plan := (v_json ->> 'id')::uuid;
  v_version := (v_json ->> 'version')::int;
  if jsonb_array_length(v_json -> 'unit_ids') <> 1 then
    raise exception 'PLAN: create selected falhou';
  end if;

  v_json := public.collective_update_action_plan_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'action_plan_id', v_plan,
    'expected_version', v_version,
    'scope_type', 'organization',
    'unit_applicability', 'all_units',
    'unit_id', null
  ));
  v_version := (v_json ->> 'version')::int;
  if v_json ->> 'unit_applicability' <> 'all_units' then
    raise exception 'PLAN: selected->all falhou';
  end if;

  v_json := public.collective_update_action_plan_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'action_plan_id', v_plan,
    'expected_version', v_version,
    'scope_type', 'unit',
    'unit_id', v_unit_a1,
    'unit_applicability', null
  ));
  v_version := (v_json ->> 'version')::int;

  v_json := public.collective_update_action_plan_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'action_plan_id', v_plan,
    'expected_version', v_version,
    'scope_type', 'organization',
    'unit_applicability', 'selected_units',
    'unit_ids', jsonb_build_array(v_unit_a1, v_unit_a2)
  ));
  v_version := (v_json ->> 'version')::int;

  v_json := public.collective_delete_action_plan_atomic(v_org_a, v_plan);
  if (v_json ->> 'id')::uuid <> v_plan then
    raise exception 'PLAN: delete retorno invalido';
  end if;
  select count(*) into v_count from public.action_plan_unit_applicabilities where action_plan_id = v_plan;
  if v_count <> 0 then
    raise exception 'PLAN: orphan applicability apos delete';
  end if;
  select count(*) into v_count from public.action_plans where id = v_plan;
  if v_count <> 0 then
    raise exception 'PLAN: pai residual apos delete';
  end if;

  -- ---------------------------------------------------------------------------
  -- Delete campanha: sem orfaos de audiencia/applicability
  -- ---------------------------------------------------------------------------
  v_json := public.collective_create_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'title', 'D01D delete me',
    'description', 'd',
    'channel', 'email',
    'starts_at', current_date,
    'ends_at', current_date + 5,
    'scope_type', 'organization',
    'unit_applicability', 'selected_units',
    'unit_ids', jsonb_build_array(v_unit_a1),
    'audience', jsonb_build_object('audience_label', 'Temp')
  ));
  v_id := (v_json ->> 'id')::uuid;

  v_json := public.collective_delete_campaign_atomic(v_org_a, v_id);
  if (v_json ->> 'id')::uuid <> v_id then
    raise exception 'DEL: retorno invalido';
  end if;
  select count(*) into v_count from public.campaign_audiences where campaign_id = v_id;
  if v_count <> 0 then
    raise exception 'DEL: audiencia orfa';
  end if;
  select count(*) into v_count from public.campaign_unit_applicabilities where campaign_id = v_id;
  if v_count <> 0 then
    raise exception 'DEL: applicability orfa';
  end if;
  select count(*) into v_count from public.campaigns where id = v_id;
  if v_count <> 0 then
    raise exception 'DEL: campanha residual';
  end if;

  -- SST unit-scoped: pode criar unit propria; nao organization
  reset role;
  perform set_config('request.jwt.claim.sub', v_sst_unit::text, true);
  execute 'set local role authenticated';

  v_json := public.collective_create_campaign_atomic(jsonb_build_object(
    'organization_id', v_org_a,
    'title', 'sst ok',
    'description', 'd',
    'channel', 'email',
    'starts_at', current_date,
    'ends_at', current_date + 1,
    'scope_type', 'unit',
    'unit_id', v_unit_a1,
    'unit_applicability', null
  ));
  if (v_json ->> 'unit_id')::uuid <> v_unit_a1 then
    raise exception 'SST: create unit propria falhou';
  end if;

  begin
    v_failed := false;
    perform public.collective_create_campaign_atomic(jsonb_build_object(
      'organization_id', v_org_a,
      'title', 'sst bad unit',
      'description', 'd',
      'channel', 'email',
      'starts_at', current_date,
      'ends_at', current_date + 1,
      'scope_type', 'unit',
      'unit_id', v_unit_a2,
      'unit_applicability', null
    ));
  exception when others then
    v_failed := (
      sqlerrm like '%COLLECTIVE:AUTHORIZATION_DENIED%'
      or sqlstate = '42501'
    );
    if not v_failed then raise; end if;
  end;
  if not v_failed then
    raise exception 'SST: cross-unit deveria falhar';
  end if;

  raise notice 'SUP-D01-D VALIDATION: ALL PASS';
end $$;

rollback;
