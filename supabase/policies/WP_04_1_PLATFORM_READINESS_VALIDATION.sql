-- WP-04.1 Platform Readiness validation (structural + behavioral A–L).
-- Prefer local disposable DB after `supabase db reset` (seed installs roles).
-- Fixtures are cleaned; residual count must be 0.

-- G) Helpers críticos com search_path seguro
do $$
declare
  insecure integer;
begin
  select count(*)
    into insecure
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef
    and (
      (n.nspname = 'app_auth' and p.proname in (
        'unit_belongs_to_organization',
        'has_org_wide_collective_role',
        'has_unit_collective_role',
        'can_select_campaign',
        'can_write_campaign',
        'can_select_action_plan',
        'can_write_action_plan'
      ))
      or (n.nspname = 'public' and p.proname in (
        'enforce_campaign_organization_immutable',
        'enforce_action_plan_organization_immutable',
        'enforce_campaign_unit_belongs_to_org',
        'enforce_action_plan_unit_belongs_to_org',
        'enforce_campaign_unit_applicability_row',
        'enforce_action_plan_unit_applicability_row',
        'enforce_campaign_applicability_cardinality',
        'enforce_action_plan_applicability_cardinality',
        'enforce_campaign_audience_inherits_org'
      ))
    )
    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=pg_catalog, public%';

  if insecure <> 0 then
    raise exception 'WP-04.1 G failed: % helper(s) without secure search_path', insecure;
  end if;
end;
$$;

-- H/I) EXECUTE grants
do $$
begin
  if has_function_privilege('anon', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE')
     or has_function_privilege('public', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'WP-04.1 H failed: register_audit_event executable by PUBLIC/anon';
  end if;

  if not has_function_privilege('authenticated', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'WP-04.1 I failed: authenticated missing register_audit_event EXECUTE';
  end if;

  if has_function_privilege('authenticated', 'app_auth.unit_belongs_to_organization(uuid, uuid)', 'EXECUTE') then
    raise exception 'WP-04.1 H failed: unit_belongs_to_organization executable by authenticated';
  end if;
end;
$$;

-- JWT policies must be gone; modern policies present
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and policyname in ('own_data_assessments', 'professional_assignment_scope')
  ) then
    raise exception 'WP-04.1 failed: JWT-era residual policies still present';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assessments' and policyname = 'assessments_select_owner'
  ) then
    raise exception 'WP-04.1 failed: assessments_select_owner missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assessments' and policyname = 'assessments_select_clinical_linked'
  ) then
    raise exception 'WP-04.1 failed: assessments_select_clinical_linked missing';
  end if;
end;
$$;

-- Behavioral A–F, J–L
do $$
declare
  org1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa31';
  org2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa32';
  owner_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb31';
  peer_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb32';
  pro_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb33';
  pro_unlinked uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb34';
  admin_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb35';
  cross_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb36';
  assessment1 uuid := 'cccccccc-cccc-cccc-cccc-cccccccccc31';
  assignment1 uuid := 'dddddddd-dddd-dddd-dddd-dddddddddd31';
  role_medico uuid;
  role_admin uuid;
  uo_owner uuid := 'ffffffff-ffff-ffff-ffff-fffffffffff1';
  uo_peer uuid := 'ffffffff-ffff-ffff-ffff-fffffffffff2';
  uo_pro uuid := 'ffffffff-ffff-ffff-ffff-fffffffffff3';
  uo_unlinked uuid := 'ffffffff-ffff-ffff-ffff-fffffffffff4';
  uo_admin uuid := 'ffffffff-ffff-ffff-ffff-fffffffffff5';
  uo_cross uuid := 'ffffffff-ffff-ffff-ffff-fffffffffff6';
  visible integer;
  audit_id uuid;
  denied boolean;
  reason_text text;
begin
  delete from public.audit_events where organization_id in (org1, org2);
  delete from public.professional_assignments where id = assignment1;
  delete from public.user_roles where user_organization_id in (uo_owner, uo_peer, uo_pro, uo_unlinked, uo_admin, uo_cross);
  delete from public.user_organizations where id in (uo_owner, uo_peer, uo_pro, uo_unlinked, uo_admin, uo_cross);
  delete from public.assessments where id = assessment1;
  delete from public.organizations where id in (org1, org2);

  insert into public.organizations (id, name, status)
  values (org1, 'TMP Org1 0021', 'ativo'), (org2, 'TMP Org2 0021', 'ativo');

  insert into public.roles (code, description, status)
  values
    ('medico', 'Medico', 'ativo'),
    ('admin_cliente', 'Administrador do cliente', 'ativo')
  on conflict (code) do nothing;

  select id into role_medico from public.roles where code = 'medico' limit 1;
  select id into role_admin from public.roles where code = 'admin_cliente' limit 1;
  if role_medico is null or role_admin is null then
    raise exception 'WP-04.1 setup failed: roles medico/admin_cliente unavailable';
  end if;

  insert into public.user_organizations (id, organization_id, user_id, status)
  values
    (uo_owner, org1, owner_id, 'ativo'),
    (uo_peer, org1, peer_id, 'ativo'),
    (uo_pro, org1, pro_id, 'ativo'),
    (uo_unlinked, org1, pro_unlinked, 'ativo'),
    (uo_admin, org1, admin_id, 'ativo'),
    (uo_cross, org2, cross_id, 'ativo');

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  values
    (org1, uo_pro, role_medico, 'ativo'),
    (org1, uo_unlinked, role_medico, 'ativo'),
    (org1, uo_admin, role_admin, 'ativo');

  insert into public.assessments (id, organization_id, user_id, status)
  values (assessment1, org1, owner_id, 'ativo');

  insert into public.professional_assignments (
    id, organization_id, professional_id, user_id, assignment_reason, status
  )
  values (assignment1, org1, pro_id, owner_id, 'wp041 validation', 'ativo');

  -- A) owner sees own assessment
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into visible from public.assessments where id = assessment1;
  reset role;
  if visible <> 1 then
    raise exception 'WP-04.1 A failed: owner should see own assessment (got %)', visible;
  end if;

  -- B) peer same org cannot see
  perform set_config('request.jwt.claim.sub', peer_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', peer_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into visible from public.assessments where id = assessment1;
  reset role;
  if visible <> 0 then
    raise exception 'WP-04.1 B failed: peer must not see assessment (got %)', visible;
  end if;

  -- C) professional without assignment cannot see
  perform set_config('request.jwt.claim.sub', pro_unlinked::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pro_unlinked, 'role', 'authenticated', 'app.role', 'medico')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into visible from public.assessments where id = assessment1;
  reset role;
  if visible <> 0 then
    raise exception 'WP-04.1 C failed: unlinked professional must not see assessment (got %)', visible;
  end if;

  -- D) professional with assignment can see
  perform set_config('request.jwt.claim.sub', pro_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', pro_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into visible from public.assessments where id = assessment1;
  reset role;
  if visible <> 1 then
    raise exception 'WP-04.1 D failed: linked professional should see assessment (got %)', visible;
  end if;

  -- E) institutional admin role alone cannot see assessment
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated', 'app.role', 'admin_cliente')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into visible from public.assessments where id = assessment1;
  reset role;
  if visible <> 0 then
    raise exception 'WP-04.1 E failed: institutional admin must not see assessment (got %)', visible;
  end if;

  -- F) cross-org denied
  perform set_config('request.jwt.claim.sub', cross_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', cross_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select count(*) into visible from public.assessments where id = assessment1;
  reset role;
  if visible <> 0 then
    raise exception 'WP-04.1 F failed: cross-org must not see assessment (got %)', visible;
  end if;

  -- J) authorized audit event accepted
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select public.register_audit_event(
    org1, 'usuario', 'consent_accepted', 'consent', assessment1::text, 'hml', 'sucesso',
    'code=consent_accepted|corr=wp041'
  ) into audit_id;
  reset role;
  if audit_id is null then
    raise exception 'WP-04.1 J failed: register_audit_event returned null';
  end if;

  select reason into reason_text from public.audit_events where id = audit_id;
  if reason_text ~* '(diagnost|anota|prontuario|cpf|senha|password)' then
    raise exception 'WP-04.1 K failed: sensitive marker in audit reason: %', reason_text;
  end if;
  if position('code=consent_accepted' in coalesce(reason_text, '')) = 0 then
    raise exception 'WP-04.1 K failed: expected sanitized code in reason';
  end if;

  denied := false;
  perform set_config('request.jwt.claim.sub', cross_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', cross_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    perform public.register_audit_event(
      org1, 'usuario', 'consent_accepted', 'consent', null, 'hml', 'sucesso', 'code=x'
    );
  exception
    when insufficient_privilege then
      denied := true;
    when others then
      if sqlstate = '42501' then
        denied := true;
      else
        raise;
      end if;
  end;
  reset role;
  if not denied then
    raise exception 'WP-04.1 J failed: cross-org audit write should be denied';
  end if;

  -- L) cleanup
  delete from public.audit_events where organization_id in (org1, org2);
  delete from public.professional_assignments where id = assignment1;
  delete from public.user_roles where user_organization_id in (uo_owner, uo_peer, uo_pro, uo_unlinked, uo_admin, uo_cross);
  delete from public.user_organizations where id in (uo_owner, uo_peer, uo_pro, uo_unlinked, uo_admin, uo_cross);
  delete from public.assessments where id = assessment1;
  delete from public.organizations where id in (org1, org2);

  if exists (select 1 from public.organizations where id in (org1, org2))
     or exists (select 1 from public.assessments where id = assessment1)
     or exists (select 1 from public.professional_assignments where id = assignment1) then
    raise exception 'WP-04.1 L failed: residual fixtures remain';
  end if;

  raise notice 'WP-04.1 validation PASS (A–L)';
end;
$$;
