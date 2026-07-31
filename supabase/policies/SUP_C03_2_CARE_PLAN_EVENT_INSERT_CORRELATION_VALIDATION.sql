-- Validacao executavel da correlacao INSERT care_plan_events (migration 0016).
-- Premissa: migrations 0001..0016 + harness auth.uid()/authenticated + auth.users.
-- Isolada de seeds C01/C02/C03/0015.

begin;

do $$
declare
  v_org_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_org_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_pro_a uuid := '12121212-1212-1212-1212-121212121212';
  v_pro_b uuid := '13131313-1313-1313-1313-131313131313';
  v_mgr_clin uuid := '15151515-1515-1515-1515-151515151515';
  v_mgr_clin_b uuid := '17171717-1717-1717-1717-171717171717';
  v_role_usuario uuid;
  v_role_medico uuid;
  v_role_gestor_clin uuid;
  v_uo_user uuid;
  v_uo_pro uuid;
  v_uo_mgr_clin uuid;
  v_uo_mgr_clin_b uuid;
  v_uo_pro_b uuid;
  v_uo_pro_a_b uuid;
  v_uo_user_a_b uuid;
  v_count int;
  v_plan uuid;
  v_plan_b uuid;
  v_plan2 uuid;
  v_version_before int;
  v_reassess jsonb;
  v_with_check text;
  v_insert_policies int;
  v_fns text[] := array[
    'app_auth.append_care_plan_event(uuid,uuid,uuid,uuid,uuid,text,text,jsonb,text,integer,integer,uuid)',
    'app_auth.snapshot_care_plan_event()',
    'app_auth.snapshot_care_plan_action_event()',
    'app_auth.guard_care_plan_mutability()',
    'app_auth.guard_care_plan_action_mutability()'
  ];
  v_fn text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_user_a, 'user.a@example.com', '{"full_name":"Paciente A"}'::jsonb),
    (v_user_b, 'user.b@example.com', '{"full_name":"Paciente B"}'::jsonb),
    (v_pro_a, 'pro.a@example.com', '{"full_name":"Medico A"}'::jsonb),
    (v_pro_b, 'pro.b@example.com', '{"full_name":"Medico B"}'::jsonb),
    (v_mgr_clin, 'mgr.clin@example.com', '{"full_name":"Gestor Clin"}'::jsonb),
    (v_mgr_clin_b, 'mgr.clin.b@example.com', '{"full_name":"Gestor Clin B"}'::jsonb)
  on conflict (id) do update
    set email = excluded.email,
        raw_user_meta_data = excluded.raw_user_meta_data;

  insert into public.organizations (id, name, status)
  values (v_org_a, 'Org A', 'ativo'), (v_org_b, 'Org B', 'ativo')
  on conflict (id) do nothing;

  insert into public.roles (code, description, status)
  values
    ('usuario', 'Usuario', 'ativo'),
    ('medico', 'Medico', 'ativo'),
    ('gestor_clinico', 'Gestor clinico', 'ativo')
  on conflict (code) do nothing;

  select id into v_role_usuario from public.roles where code = 'usuario';
  select id into v_role_medico from public.roles where code = 'medico';
  select id into v_role_gestor_clin from public.roles where code = 'gestor_clinico';

  insert into public.user_organizations (organization_id, user_id, status)
  values
    (v_org_a, v_user_a, 'ativo'),
    (v_org_a, v_pro_a, 'ativo'),
    (v_org_a, v_mgr_clin, 'ativo'),
    (v_org_b, v_user_b, 'ativo'),
    (v_org_b, v_pro_b, 'ativo'),
    (v_org_b, v_mgr_clin_b, 'ativo'),
    (v_org_b, v_pro_a, 'ativo'),
    (v_org_b, v_user_a, 'ativo')
  on conflict (organization_id, user_id) do nothing;

  select id into v_uo_user from public.user_organizations where organization_id = v_org_a and user_id = v_user_a;
  select id into v_uo_pro from public.user_organizations where organization_id = v_org_a and user_id = v_pro_a;
  select id into v_uo_mgr_clin from public.user_organizations where organization_id = v_org_a and user_id = v_mgr_clin;
  select id into v_uo_pro_b from public.user_organizations where organization_id = v_org_b and user_id = v_pro_b;
  select id into v_uo_mgr_clin_b from public.user_organizations where organization_id = v_org_b and user_id = v_mgr_clin_b;
  select id into v_uo_pro_a_b from public.user_organizations where organization_id = v_org_b and user_id = v_pro_a;
  select id into v_uo_user_a_b from public.user_organizations where organization_id = v_org_b and user_id = v_user_a;

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  values
    (v_org_a, v_uo_user, v_role_usuario, 'ativo'),
    (v_org_a, v_uo_pro, v_role_medico, 'ativo'),
    (v_org_a, v_uo_mgr_clin, v_role_gestor_clin, 'ativo'),
    (v_org_b, v_uo_pro_b, v_role_medico, 'ativo'),
    (v_org_b, v_uo_mgr_clin_b, v_role_gestor_clin, 'ativo'),
    (v_org_b, v_uo_pro_a_b, v_role_medico, 'ativo'),
    (v_org_b, v_uo_user_a_b, v_role_usuario, 'ativo')
  on conflict do nothing;

  delete from public.care_plan_events where organization_id in (v_org_a, v_org_b);
  delete from public.care_plan_actions where organization_id in (v_org_a, v_org_b);
  delete from public.care_plans where organization_id in (v_org_a, v_org_b);
  delete from public.professional_assignments where organization_id in (v_org_a, v_org_b);

  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values
    (v_org_a, v_pro_a, v_user_a, 'acompanhamento', 'ativo'),
    (v_org_a, v_pro_a, v_user_b, 'mesmo-org-outro-paciente', 'ativo'),
    (v_org_b, v_pro_b, v_user_b, 'acompanhamento', 'ativo'),
    (v_org_b, v_pro_a, v_user_a, 'multi-org', 'ativo'),
    (v_org_b, v_pro_a, v_user_b, 'multi-org-b', 'ativo');

  -- 1) unica policy INSERT permissiva
  select count(*) into v_insert_policies
    from pg_policy
   where polrelid = 'public.care_plan_events'::regclass
     and polcmd = 'a'
     and polroles::text like '%' || (select oid from pg_roles where rolname = 'authenticated')::text || '%';
  -- polroles vazio significa PUBLIC/all roles; contar policies INSERT
  select count(*) into v_insert_policies
    from pg_policy
   where polrelid = 'public.care_plan_events'::regclass
     and polcmd = 'a';
  if v_insert_policies <> 1 then
    raise exception 'VALIDACAO 0016 FALHOU: esperado 1 policy INSERT, encontrado %', v_insert_policies;
  end if;

  -- 28) catalogo: correlacao explicita, sem tautologia
  select pg_get_expr(polwithcheck, polrelid) into v_with_check
    from pg_policy
   where polrelid = 'public.care_plan_events'::regclass
     and polname = 'care_plan_events_insert_clinical_notes';
  if v_with_check is null then
    raise exception 'VALIDACAO 0016 FALHOU: policy INSERT ausente';
  end if;
  if v_with_check not ilike '%care_plan_events.organization_id%'
     or v_with_check not ilike '%care_plan_events.user_id%'
     or v_with_check not ilike '%care_plan_events.professional_id%'
     or v_with_check not ilike '%care_plan_events.care_plan_id%' then
    raise exception 'VALIDACAO 0016 FALHOU: correlacao explicita ausente no catalogo';
  end if;
  if v_with_check like '%p.organization_id = p.organization_id%'
     or v_with_check like '%p.user_id = p.user_id%'
     or v_with_check like '%p.professional_id = p.professional_id%' then
    raise exception 'VALIDACAO 0016 FALHOU: tautologia ainda presente no catalogo';
  end if;
  -- 2-3) kinds
  if v_with_check not ilike '%evolution%'
     or v_with_check ilike '%reassessment%' then
    raise exception 'VALIDACAO 0016 FALHOU: kinds da policy incorretos';
  end if;

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Plano A', 'ativo', 1,
    'planejado', 'Obj A', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1'
  ) returning id into v_plan;

  -- 26) trigger create
  select count(*) into v_count
    from public.care_plan_events
   where care_plan_id = v_plan and event_kind = 'create';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0016 FALHOU: trigger create nao operou';
  end if;

  -- 4) INSERT valido coerente
  insert into public.care_plan_events (
    care_plan_id, organization_id, user_id, professional_id,
    event_kind, event_category, payload, note, authored_by
  ) values (
    v_plan, v_org_a, v_user_a, v_pro_a,
    'evolution', 'clinical_evolution', '{"text":"OK"}'::jsonb, 'OK', v_pro_a
  );

  -- 5) organization_id diverge do plano (assignment multi-org existe; EXISTS deve bloquear)
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_b, v_user_a, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'org diverge', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: org divergente aceita';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 6) user_id diverge do plano
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_b, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'user diverge', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: user divergente aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 7-8) care_plan_id de outro usuario / outra org
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';
  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version
  ) values (
    v_org_b, v_user_b, v_pro_b, 'Plano B', 'ativo', 1,
    'planejado', 'Obj B', current_date, '',
    v_pro_b, v_pro_b, 'care_plan.v1'
  ) returning id into v_plan_b;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  -- 7) plano de outro usuario (mesmo pro em org B possui plano? usar plan_b com user B / org A fields)
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan_b, v_org_a, v_user_a, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'plan outro user', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: care_plan_id de outro usuario aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 8) care_plan_id de outra organizacao (campos do evento alinhados a org B / user A / pro A)
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan_b, v_org_b, v_user_a, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'plan outra org', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: care_plan_id de outra org aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 9) professional_id diverge do ator autorizado
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_b,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'pro diverge', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: professional_id divergente aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 10) sem assignment ativo
  execute 'reset role';
  update public.professional_assignments
     set status = 'inativo'
   where organization_id = v_org_a
     and professional_id = v_pro_a
     and user_id = v_user_a;
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'sem assignment', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: insert sem assignment aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';
  update public.professional_assignments
     set status = 'ativo'
   where organization_id = v_org_a
     and professional_id = v_pro_a
     and user_id = v_user_a;

  -- 11) assignment de outra organizacao nao libera plano da org A
  -- (pro_a tem assignment org B / user A; evento coerente com plano A mas... assignment check
  --  usa organization_id do evento = org A; ja coberto. Forca evento org A com assignment so em B:)
  execute 'reset role';
  update public.professional_assignments
     set status = 'inativo'
   where organization_id = v_org_a and professional_id = v_pro_a and user_id = v_user_a;
  -- leave org B assignment ativo
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'assignment outra org', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: assignment cross-org liberou insert';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';
  update public.professional_assignments
     set status = 'ativo'
   where organization_id = v_org_a and professional_id = v_pro_a and user_id = v_user_a;

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  -- 12) plano encerrado nao recebe evolucao
  update public.care_plans
     set plan_status = 'concluido',
         closed_at = now(),
         closed_by = v_pro_a,
         version = version + 1,
         updated_by = v_pro_a,
         updated_at = now()
   where id = v_plan;
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'plano fechado', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: evolucao em plano concluido aceita';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- novo plano aberto para demais testes
  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Plano A2', 'ativo', 1,
    'planejado', 'Obj A2', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1'
  ) returning id into v_plan2;

  -- 13) reassessment direto
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan2, v_org_a, v_user_a, v_pro_a,
      'reassessment', 'reassessment', '{}'::jsonb, 'bypass', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: reassessment direto aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 14) estrutural
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan2, v_org_a, v_user_a, v_pro_a,
      'create', 'structural', '{}'::jsonb, 'estrutural', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: estrutural aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 15) status
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan2, v_org_a, v_user_a, v_pro_a,
      'plan_status', 'status_change', '{}'::jsonb, 'status', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: status_change aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 16) snapshot/interno
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan2, v_org_a, v_user_a, v_pro_a,
      'plan_update', 'structural', '{}'::jsonb, 'interno', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: plan_update aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 17-18) UPDATE/DELETE
  begin
    update public.care_plan_events set note = 'hack' where care_plan_id = v_plan2;
    raise exception 'VALIDACAO 0016 FALHOU: UPDATE permitido';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  begin
    delete from public.care_plan_events where care_plan_id = v_plan2;
    raise exception 'VALIDACAO 0016 FALHOU: DELETE permitido';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- 19) gestor SELECT
  perform set_config('request.jwt.claim.sub', v_mgr_clin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr_clin::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.care_plans where id = v_plan2;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0016 FALHOU: gestor nao leu plano';
  end if;
  execute 'reset role';

  -- 20) cross-org
  perform set_config('request.jwt.claim.sub', v_mgr_clin_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr_clin_b::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.care_plans where id = v_plan2;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0016 FALHOU: gestor B leu plano A';
  end if;
  execute 'reset role';

  -- 21-22) RPC reassessment
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  select version into v_version_before from public.care_plans where id = v_plan2;
  v_reassess := public.reassess_clinical_care_plan(
    v_plan2, v_version_before, 'RPC OK', current_date + 15
  );
  if (v_reassess -> 'event' ->> 'event_kind') is distinct from 'reassessment' then
    raise exception 'VALIDACAO 0016 FALHOU: RPC sem evento reassessment';
  end if;
  select count(*) into v_count
    from public.care_plan_events
   where care_plan_id = v_plan2 and event_kind = 'reassessment';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0016 FALHOU: RPC nao criou exatamente 1 reassessment';
  end if;

  -- 23) conflito versao
  select version into v_version_before from public.care_plans where id = v_plan2;
  begin
    perform public.reassess_clinical_care_plan(v_plan2, 999999, 'stale', null);
    raise exception 'VALIDACAO 0016 FALHOU: conflito deveria falhar';
  exception
    when serialization_failure then null;
    when others then
      if sqlstate in ('40001', 'P0001') or sqlerrm ilike '%conflito de versao%' then null; else raise; end if;
  end;
  if (select version from public.care_plans where id = v_plan2) <> v_version_before then
    raise exception 'VALIDACAO 0016 FALHOU: conflito alterou plano';
  end if;
  select count(*) into v_count
    from public.care_plan_events
   where care_plan_id = v_plan2 and event_kind = 'reassessment';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0016 FALHOU: conflito criou evento';
  end if;

  -- 24) falha evento -> rollback RPC
  execute 'reset role';
  create or replace function pg_temp.fail_reassess_event()
  returns trigger language plpgsql as $t$
  begin
    if new.event_kind = 'reassessment' and new.note = '__FORCE_FAIL__' then
      raise exception 'forced event insert failure';
    end if;
    return new;
  end;
  $t$;
  drop trigger if exists trg_tmp_fail_reassess_event on public.care_plan_events;
  create trigger trg_tmp_fail_reassess_event
  before insert on public.care_plan_events
  for each row execute function pg_temp.fail_reassess_event();
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  select version into v_version_before from public.care_plans where id = v_plan2;
  begin
    perform public.reassess_clinical_care_plan(v_plan2, v_version_before, '__FORCE_FAIL__', null);
    raise exception 'VALIDACAO 0016 FALHOU: falha forçada nao abortou';
  exception
    when others then
      if sqlerrm ilike '%forced event insert failure%' then null; else raise; end if;
  end;
  if (select version from public.care_plans where id = v_plan2) <> v_version_before then
    raise exception 'VALIDACAO 0016 FALHOU: falha nao reverteu plano';
  end if;
  execute 'reset role';
  drop trigger if exists trg_tmp_fail_reassess_event on public.care_plan_events;

  -- 25) helpers sem EXECUTE
  foreach v_fn in array v_fns loop
    if has_function_privilege('public', v_fn, 'EXECUTE')
       or has_function_privilege('authenticated', v_fn, 'EXECUTE')
       or (exists (select 1 from pg_roles where rolname = 'anon')
           and has_function_privilege('anon', v_fn, 'EXECUTE')) then
      raise exception 'VALIDACAO 0016 FALHOU: EXECUTE indevido em %', v_fn;
    end if;
  end loop;

  -- 27) lifecycle/unicidade
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.care_plans (
      organization_id, user_id, professional_id, title, status, version,
      plan_status, general_objective, starts_on, clinical_notes,
      created_by, updated_by, schema_version
    ) values (
      v_org_a, v_user_a, v_pro_a, 'Dup', 'ativo', 1,
      'planejado', 'Dup', current_date, '',
      v_pro_a, v_pro_a, 'care_plan.v1'
    );
    raise exception 'VALIDACAO 0016 FALHOU: segundo plano aberto aceito';
  exception
    when unique_violation then null;
    when others then
      if sqlstate = '23505' then null; else raise; end if;
  end;

  begin
    execute format(
      'update public.care_plans set status = %L, version = version + 1, updated_by = %L where id = %L',
      'inativo', v_pro_a, v_plan2
    );
    raise exception 'VALIDACAO 0016 FALHOU: status=inativo em plano aberto aceito';
  exception
    when insufficient_privilege then null;
    when check_violation then null;
    when others then
      if sqlstate in ('42501', '23514') then null; else raise; end if;
  end;

  -- 29) cenario da tautologia antiga: org do evento diverge, assignment na org do evento existe
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan2, v_org_b, v_user_a, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'tautologia antiga', v_pro_a
    );
    raise exception 'VALIDACAO 0016 FALHOU: cenario tautologico ainda aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  execute 'reset role';
  raise notice 'VALIDACAO 0016 OK';
end $$;

commit;
