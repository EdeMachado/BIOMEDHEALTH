-- Validacao executavel SUP-D01-B (migration 0017).
-- Premissa: migrations 0001..0017 + harness auth.uid()/authenticated + auth.users.
-- Escopo: constraints, FKs, unit→organization, RLS membership, ausencia de acesso nominal.
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
  v_camp uuid;
  v_camp_sel uuid;
  v_camp_unit uuid;
  v_camp_b uuid;
  v_count int;
  v_ok boolean;
  v_failed boolean;
  v_state text;
  v_msg text;
begin
  -- ---------------------------------------------------------------------------
  -- Estrutura
  -- ---------------------------------------------------------------------------
  if to_regclass('public.campaign_unit_applicabilities') is null then
    raise exception 'STRUCT: campaign_unit_applicabilities ausente';
  end if;
  if to_regclass('public.action_plan_unit_applicabilities') is null then
    raise exception 'STRUCT: action_plan_unit_applicabilities ausente';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'campaigns' and column_name = 'scope_type'
  ) then
    raise exception 'STRUCT: campaigns.scope_type ausente';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaigns' and policyname = 'campaigns_select_collective'
  ) then
    raise exception 'STRUCT: policy campaigns_select_collective ausente';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'campaigns' and policyname = 'manager_campaigns_same_org'
  ) then
    raise exception 'STRUCT: policy JWT legado manager_campaigns_same_org ainda presente';
  end if;
  if not (
    select relrowsecurity from pg_class
    where oid = 'public.campaign_audiences'::regclass
  ) then
    raise exception 'STRUCT: RLS nao habilitado em campaign_audiences';
  end if;

  -- ---------------------------------------------------------------------------
  -- Seed minimo
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
  on conflict (organization_id, user_id) do nothing;

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

  -- Bypass RLS for seed as table owner (superuser harness)
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'postgres', true);

  -- ---------------------------------------------------------------------------
  -- Constraints positivas (como owner)
  -- ---------------------------------------------------------------------------
  insert into public.campaigns (
    id, organization_id, title, description, channel, starts_at, ends_at, campaign_status,
    scope_type, unit_id, unit_applicability
  ) values (
    'cccccccc-cccc-cccc-cccc-cccccccccc01', v_org_a, 'All units', 'd', 'email', current_date, current_date + 30, 'ativa',
    'organization', null, 'all_units'
  );
  v_camp := 'cccccccc-cccc-cccc-cccc-cccccccccc01';

  insert into public.campaigns (
    id, organization_id, title, description, channel, starts_at, ends_at, campaign_status,
    scope_type, unit_id, unit_applicability
  ) values (
    'cccccccc-cccc-cccc-cccc-cccccccccc02', v_org_a, 'Selected', 'd', 'email', current_date, current_date + 30, 'ativa',
    'organization', null, 'selected_units'
  );
  v_camp_sel := 'cccccccc-cccc-cccc-cccc-cccccccccc02';

  insert into public.campaign_unit_applicabilities (campaign_id, unit_id)
  values (v_camp_sel, v_unit_a1), (v_camp_sel, v_unit_a2);
  execute 'set constraints all immediate';

  insert into public.campaigns (
    id, organization_id, title, description, channel, starts_at, ends_at, campaign_status,
    scope_type, unit_id, unit_applicability
  ) values (
    'cccccccc-cccc-cccc-cccc-cccccccccc03', v_org_a, 'Unit scope', 'd', 'email', current_date, current_date + 30, 'ativa',
    'unit', v_unit_a1, null
  );
  v_camp_unit := 'cccccccc-cccc-cccc-cccc-cccccccccc03';

  insert into public.campaign_audiences (organization_id, campaign_id, audience_label)
  values (v_org_a, v_camp, 'Colaboradores');

  insert into public.campaigns (
    id, organization_id, title, description, channel, starts_at, ends_at, campaign_status,
    scope_type, unit_id, unit_applicability
  ) values (
    'cccccccc-cccc-cccc-cccc-cccccccccc0b', v_org_b, 'Org B camp', 'd', 'email', current_date, current_date + 30, 'ativa',
    'organization', null, 'all_units'
  );
  v_camp_b := 'cccccccc-cccc-cccc-cccc-cccccccccc0b';

  -- ---------------------------------------------------------------------------
  -- Constraints negativas
  -- ---------------------------------------------------------------------------
  -- organization + unit_id
  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_a, 'bad', 'd', 'email', current_date, current_date + 1, 'ativa',
      'organization', v_unit_a1, 'all_units'
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'NEG: organization+unit_id deveria falhar';
  end if;

  -- unit sem unit_id
  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_a, 'bad', 'd', 'email', current_date, current_date + 1, 'ativa',
      'unit', null, null
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'NEG: unit sem unit_id deveria falhar';
  end if;

  -- discriminante invalido
  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_a, 'bad', 'd', 'email', current_date, current_date + 1, 'ativa',
      'multi_unit', null, 'all_units'
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'NEG: scope_type invalido deveria falhar';
  end if;

  -- unit de outra org
  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_a, 'bad', 'd', 'email', current_date, current_date + 1, 'ativa',
      'unit', v_unit_b1, null
    );
  exception when check_violation then
    v_failed := true;
  when others then
    if sqlstate = '23514' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'NEG: unit cross-org deveria falhar';
  end if;

  -- all_units com associacao
  begin
    v_failed := false;
    insert into public.campaign_unit_applicabilities (campaign_id, unit_id)
    values (v_camp, v_unit_a1);
  exception when check_violation then
    v_failed := true;
  when others then
    if sqlstate = '23514' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'NEG: all_units com associacao deveria falhar';
  end if;

  -- selected_units sem associacao (deferred → forçar immediate)
  begin
    v_failed := false;
    insert into public.campaigns (
      id, organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      'cccccccc-cccc-cccc-cccc-cccccccccc99', v_org_a, 'empty sel', 'd', 'email', current_date, current_date + 1, 'ativa',
      'organization', null, 'selected_units'
    );
    execute 'set constraints all immediate';
  exception when check_violation then
    v_failed := true;
  when others then
    if sqlstate = '23514' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'NEG: selected_units vazio deveria falhar no commit/statement';
  end if;

  -- duplicata associacao
  begin
    v_failed := false;
    insert into public.campaign_unit_applicabilities (campaign_id, unit_id)
    values (v_camp_sel, v_unit_a1);
  exception when unique_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'NEG: duplicata (campaign_id, unit_id) deveria falhar';
  end if;

  -- audiencia com org divergente
  begin
    v_failed := false;
    insert into public.campaign_audiences (organization_id, campaign_id, audience_label)
    values (v_org_b, v_camp, 'Hack');
  exception when check_violation then
    v_failed := true;
  when others then
    if sqlstate = '23514' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'NEG: audiencia cross-org deveria falhar';
  end if;

  -- organization_id imutavel
  begin
    v_failed := false;
    update public.campaigns set organization_id = v_org_b where id = v_camp;
  exception when check_violation then
    v_failed := true;
  when others then
    if sqlstate = '23514' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'NEG: alterar organization_id deveria falhar';
  end if;

  -- ---------------------------------------------------------------------------
  -- RLS
  -- ---------------------------------------------------------------------------
  -- Gestor org A: ve campanhas A, nao B
  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';

  select count(*) into v_count from public.campaigns where organization_id = v_org_a;
  if v_count < 3 then
    raise exception 'RLS: gestor deveria ver campanhas org A (got %)', v_count;
  end if;

  select count(*) into v_count from public.campaigns where organization_id = v_org_b;
  if v_count <> 0 then
    raise exception 'RLS: gestor A nao deve ver campanhas org B';
  end if;

  -- SST unit A1: ve all_units, selected (A1), unit A1; nao unit A2-only (nao existe); selected inclui A1
  reset role;
  perform set_config('request.jwt.claim.sub', v_sst_unit::text, true);
  execute 'set local role authenticated';

  select exists(select 1 from public.campaigns where id = v_camp) into v_ok;
  if not v_ok then
    raise exception 'RLS: sst A1 deve ver all_units';
  end if;
  select exists(select 1 from public.campaigns where id = v_camp_sel) into v_ok;
  if not v_ok then
    raise exception 'RLS: sst A1 deve ver selected com A1';
  end if;
  select exists(select 1 from public.campaigns where id = v_camp_unit) into v_ok;
  if not v_ok then
    raise exception 'RLS: sst A1 deve ver campanha unit A1';
  end if;

  -- SST unit A2: ve all_units e selected (A2 presente); nao ve unit A1
  reset role;
  perform set_config('request.jwt.claim.sub', v_sst_other::text, true);
  execute 'set local role authenticated';

  select exists(select 1 from public.campaigns where id = v_camp) into v_ok;
  if not v_ok then
    raise exception 'RLS: sst A2 deve ver all_units';
  end if;
  select exists(select 1 from public.campaigns where id = v_camp_sel) into v_ok;
  if not v_ok then
    raise exception 'RLS: sst A2 deve ver selected com A2';
  end if;
  select exists(select 1 from public.campaigns where id = v_camp_unit) into v_ok;
  if v_ok then
    raise exception 'RLS: sst A2 NAO deve ver campanha unit A1';
  end if;

  -- Auditor: leitura sim, escrita nao
  reset role;
  perform set_config('request.jwt.claim.sub', v_auditor::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.campaigns where id = v_camp;
  if v_count <> 1 then
    raise exception 'RLS: auditor deve ler';
  end if;
  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_a, 'auditor write', 'd', 'email', current_date, current_date + 1, 'ativa',
      'organization', null, 'all_units'
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
    raise exception 'RLS: auditor nao deve inserir';
  end if;

  -- Medico: sem acesso coletivo gerencial
  reset role;
  perform set_config('request.jwt.claim.sub', v_medico::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.campaigns where organization_id = v_org_a;
  if v_count <> 0 then
    raise exception 'RLS: medico nao deve ver campanhas coletivas';
  end if;

  -- admin_biomed: acesso coletivo, sem criar program_participations / nominal via este bloco
  reset role;
  perform set_config('request.jwt.claim.sub', v_admin_bio::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.campaigns where id = v_camp;
  if v_count <> 1 then
    raise exception 'RLS: admin_biomed deve ler metadados coletivos';
  end if;

  -- Cross-tenant insert
  reset role;
  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';
  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_b, 'cross', 'd', 'email', current_date, current_date + 1, 'ativa',
      'organization', null, 'all_units'
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
    raise exception 'RLS: insert cross-tenant deveria falhar';
  end if;

  -- SST unit: escrita apenas em unit propria
  reset role;
  perform set_config('request.jwt.claim.sub', v_sst_unit::text, true);
  execute 'set local role authenticated';
  insert into public.campaigns (
    organization_id, title, description, channel, starts_at, ends_at, campaign_status,
    scope_type, unit_id, unit_applicability
  ) values (
    v_org_a, 'sst unit ok', 'd', 'email', current_date, current_date + 1, 'ativa',
    'unit', v_unit_a1, null
  );

  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_a, 'sst unit bad', 'd', 'email', current_date, current_date + 1, 'ativa',
      'unit', v_unit_a2, null
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
    raise exception 'RLS: sst A1 nao deve criar campanha unit A2';
  end if;

  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_a, 'sst org bad', 'd', 'email', current_date, current_date + 1, 'ativa',
      'organization', null, 'all_units'
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
    raise exception 'RLS: sst unit-scoped nao deve criar campanha organization';
  end if;

  -- Confirmacao: sem tabela program_participations introduzida
  if to_regclass('public.program_participations') is not null then
    raise exception 'SCOPE: program_participations nao deve existir neste bloco';
  end if;

  -- ---------------------------------------------------------------------------
  -- B1: unit_belongs_to_organization nao e oraculo cross-tenant
  -- ---------------------------------------------------------------------------
  if has_function_privilege(
    'public',
    'app_auth.unit_belongs_to_organization(uuid,uuid)',
    'execute'
  ) then
    raise exception 'B1: PUBLIC nao deve ter EXECUTE em unit_belongs_to_organization';
  end if;

  if has_function_privilege(
    'authenticated',
    'app_auth.unit_belongs_to_organization(uuid,uuid)',
    'execute'
  ) then
    raise exception 'B1: authenticated nao deve ter EXECUTE em unit_belongs_to_organization';
  end if;

  if has_function_privilege(
    'authenticated',
    'app_auth.has_org_wide_collective_role(uuid,text[])',
    'execute'
  ) then
    raise exception 'B1: authenticated nao deve ter EXECUTE em has_org_wide_collective_role';
  end if;

  if has_function_privilege(
    'authenticated',
    'app_auth.has_unit_collective_role(uuid,uuid,text[])',
    'execute'
  ) then
    raise exception 'B1: authenticated nao deve ter EXECUTE em has_unit_collective_role';
  end if;

  if not has_function_privilege(
    'authenticated',
    'app_auth.can_select_campaign(uuid,text,uuid,text,uuid)',
    'execute'
  ) then
    raise exception 'B1: authenticated DEVE ter EXECUTE em can_select_campaign (RLS)';
  end if;

  if has_function_privilege(
    'public',
    'app_auth.can_select_campaign(uuid,text,uuid,text,uuid)',
    'execute'
  ) then
    raise exception 'B1: PUBLIC nao deve ter EXECUTE em can_select_campaign';
  end if;

  -- Sem membership: chamada direta a unit_belongs deve ser permission denied (nunca true/false)
  reset role;
  perform set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
  execute 'set local role authenticated';
  begin
    v_failed := false;
    execute format(
      'select app_auth.unit_belongs_to_organization(%L::uuid, %L::uuid)',
      v_unit_a1,
      v_org_a
    );
  exception when insufficient_privilege then
    v_failed := true;
  when others then
    if sqlstate = '42501' then
      v_failed := true;
    else
      raise exception 'B1: esperava permission denied no par correto; got % %', sqlstate, sqlerrm;
    end if;
  end;
  if not v_failed then
    raise exception 'B1: authenticated sem membership nao deve executar unit_belongs (par correto)';
  end if;

  begin
    v_failed := false;
    execute format(
      'select app_auth.unit_belongs_to_organization(%L::uuid, %L::uuid)',
      v_unit_b1,
      v_org_a
    );
  exception when insufficient_privilege then
    v_failed := true;
  when others then
    if sqlstate = '42501' then
      v_failed := true;
    else
      raise exception 'B1: esperava permission denied no par estrangeiro; got % %', sqlstate, sqlerrm;
    end if;
  end;
  if not v_failed then
    raise exception 'B1: authenticated sem membership nao deve executar unit_belongs (par estrangeiro)';
  end if;

  -- Com membership (gestor): ainda sem EXECUTE direto em unit_belongs
  reset role;
  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';
  begin
    v_failed := false;
    execute format(
      'select app_auth.unit_belongs_to_organization(%L::uuid, %L::uuid)',
      v_unit_a1,
      v_org_a
    );
  exception when insufficient_privilege then
    v_failed := true;
  when others then
    if sqlstate = '42501' then
      v_failed := true;
    else
      raise exception 'B1: gestor com membership ainda nao deve executar unit_belongs; got % %', sqlstate, sqlerrm;
    end if;
  end;
  if not v_failed then
    raise exception 'B1: authenticated COM membership nao deve executar unit_belongs diretamente';
  end if;

  -- Helpers RLS expostos: sem membership => false (sem revelar topologia unit↔org)
  reset role;
  perform set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
  execute 'set local role authenticated';
  execute format(
    'select app_auth.can_select_campaign(%L::uuid, %L, null::uuid, %L, %L::uuid)',
    v_org_a,
    'organization',
    'all_units',
    v_camp
  ) into v_ok;
  if v_ok then
    raise exception 'B1: can_select_campaign sem membership deve ser false';
  end if;
  execute format(
    'select app_auth.can_write_campaign(%L::uuid, %L, null::uuid)',
    v_org_a,
    'organization'
  ) into v_ok;
  if v_ok then
    raise exception 'B1: can_write_campaign sem membership deve ser false';
  end if;

  -- Papel autorizado: can_select true; can_write true para gestor
  reset role;
  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';
  execute format(
    'select app_auth.can_select_campaign(%L::uuid, %L, null::uuid, %L, %L::uuid)',
    v_org_a,
    'organization',
    'all_units',
    v_camp
  ) into v_ok;
  if not v_ok then
    raise exception 'B1: gestor deve can_select campanha org A';
  end if;
  execute format(
    'select app_auth.can_select_campaign(%L::uuid, %L, null::uuid, %L, %L::uuid)',
    v_org_b,
    'organization',
    'all_units',
    v_camp_b
  ) into v_ok;
  if v_ok then
    raise exception 'B1: gestor A nao deve can_select campanha org B';
  end if;

  -- anon: sem EXECUTE em unit_belongs (se papel existir)
  reset role;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if has_function_privilege('anon', 'app_auth.unit_belongs_to_organization(uuid,uuid)', 'execute') then
      raise exception 'B1: anon nao deve ter EXECUTE em unit_belongs_to_organization';
    end if;
  end if;

  -- Triggers ainda protegem unit→organization (INSERT invalido como owner)
  reset role;
  begin
    v_failed := false;
    insert into public.campaigns (
      organization_id, title, description, channel, starts_at, ends_at, campaign_status,
      scope_type, unit_id, unit_applicability
    ) values (
      v_org_a, 'cross unit after B1', 'd', 'email', current_date, current_date + 1, 'ativa',
      'unit', v_unit_b1, null
    );
  exception when check_violation then
    v_failed := true;
  when others then
    if sqlstate = '23514' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'B1: trigger unit→organization regressou apos hardening de grants';
  end if;

  -- INSERT valido permanece (gestor via RLS)
  reset role;
  perform set_config('request.jwt.claim.sub', v_gestor::text, true);
  execute 'set local role authenticated';
  insert into public.campaigns (
    organization_id, title, description, channel, starts_at, ends_at, campaign_status,
    scope_type, unit_id, unit_applicability
  ) values (
    v_org_a, 'post-B1 ok', 'd', 'email', current_date, current_date + 1, 'ativa',
    'organization', null, 'all_units'
  );

  raise notice 'SUP-D01-B VALIDATION: ALL PASS (incl. B1 nao-sondagem)';
end $$;

rollback;
