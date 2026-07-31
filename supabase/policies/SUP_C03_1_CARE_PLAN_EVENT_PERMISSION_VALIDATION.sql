-- Validacao executavel do hardening residual SUP-C03 (migration 0015).
-- Premissa: migrations 0001..0015 + harness auth.uid()/authenticated + auth.users.
-- Isolada: nao depende de seeds de C01/C02/C03 anteriores no mesmo banco.

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
  v_count int;
  v_plan uuid;
  v_plan2 uuid;
  v_action uuid;
  v_version_before int;
  v_last_reassessed_before timestamptz;
  v_reassess jsonb;
  v_owner name;
  v_has_exec boolean;
  v_fn text;
  v_fns text[] := array[
    'app_auth.append_care_plan_event(uuid,uuid,uuid,uuid,uuid,text,text,jsonb,text,integer,integer,uuid)',
    'app_auth.snapshot_care_plan_event()',
    'app_auth.snapshot_care_plan_action_event()',
    'app_auth.guard_care_plan_mutability()',
    'app_auth.guard_care_plan_action_mutability()'
  ];
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
    (v_org_b, v_mgr_clin_b, 'ativo')
  on conflict (organization_id, user_id) do nothing;

  select id into v_uo_user from public.user_organizations where organization_id = v_org_a and user_id = v_user_a;
  select id into v_uo_pro from public.user_organizations where organization_id = v_org_a and user_id = v_pro_a;
  select id into v_uo_mgr_clin from public.user_organizations where organization_id = v_org_a and user_id = v_mgr_clin;
  select id into v_uo_pro_b from public.user_organizations where organization_id = v_org_b and user_id = v_pro_b;
  select id into v_uo_mgr_clin_b from public.user_organizations where organization_id = v_org_b and user_id = v_mgr_clin_b;

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  values
    (v_org_a, v_uo_user, v_role_usuario, 'ativo'),
    (v_org_a, v_uo_pro, v_role_medico, 'ativo'),
    (v_org_a, v_uo_mgr_clin, v_role_gestor_clin, 'ativo'),
    (v_org_b, v_uo_pro_b, v_role_medico, 'ativo'),
    (v_org_b, v_uo_mgr_clin_b, v_role_gestor_clin, 'ativo')
  on conflict do nothing;

  delete from public.care_plan_events where organization_id in (v_org_a, v_org_b);
  delete from public.care_plan_actions where organization_id in (v_org_a, v_org_b);
  delete from public.care_plans where organization_id in (v_org_a, v_org_b);
  delete from public.professional_assignments where organization_id in (v_org_a, v_org_b);

  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values
    (v_org_a, v_pro_a, v_user_a, 'acompanhamento', 'ativo'),
    (v_org_b, v_pro_b, v_user_b, 'acompanhamento', 'ativo');

  -- 1-3) PUBLIC/anon/authenticated sem EXECUTE nos helpers internos
  foreach v_fn in array v_fns loop
    if has_function_privilege('public', v_fn, 'EXECUTE') then
      raise exception 'VALIDACAO 0015 FALHOU: PUBLIC tem EXECUTE em %', v_fn;
    end if;
    if exists (select 1 from pg_roles where rolname = 'anon')
       and has_function_privilege('anon', v_fn, 'EXECUTE') then
      raise exception 'VALIDACAO 0015 FALHOU: anon tem EXECUTE em %', v_fn;
    end if;
    if has_function_privilege('authenticated', v_fn, 'EXECUTE') then
      raise exception 'VALIDACAO 0015 FALHOU: authenticated tem EXECUTE em %', v_fn;
    end if;
  end loop;

  -- 4) owner mantem capacidade tecnica
  select pg_get_userbyid(p.proowner) into v_owner
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app_auth'
     and p.proname = 'append_care_plan_event';
  if v_owner is null then
    raise exception 'VALIDACAO 0015 FALHOU: owner de append_care_plan_event ausente';
  end if;
  if not has_function_privilege(v_owner, v_fns[1], 'EXECUTE') then
    raise exception 'VALIDACAO 0015 FALHOU: owner perdeu EXECUTE em append_care_plan_event';
  end if;

  -- 5) chamada direta authenticated rejeitada
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  begin
    perform app_auth.append_care_plan_event(
      '00000000-0000-0000-0000-000000000001'::uuid,
      null, v_org_a, v_user_a, v_pro_a,
      'evolution', 'clinical_evolution', '{}'::jsonb, 'x', null, null, v_pro_a
    );
    raise exception 'VALIDACAO 0015 FALHOU: authenticated executou append_care_plan_event';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- 6) chamada direta anon rejeitada (se papel existir)
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'set local role anon';
    begin
      perform app_auth.append_care_plan_event(
        '00000000-0000-0000-0000-000000000001'::uuid,
        null, v_org_a, v_user_a, v_pro_a,
        'evolution', 'clinical_evolution', '{}'::jsonb, 'x', null, null, v_pro_a
      );
      raise exception 'VALIDACAO 0015 FALHOU: anon executou append_care_plan_event';
    exception
      when insufficient_privilege then null;
      when others then
        if sqlstate = '42501' then null; else raise; end if;
    end;
    execute 'reset role';
  end if;

  -- 7) triggers continuam chamando helpers (evento create via insert do plano)
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Plano H', 'ativo', 1,
    'planejado', 'Objetivo H', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1'
  ) returning id into v_plan;

  select count(*) into v_count
    from public.care_plan_events
   where care_plan_id = v_plan and event_kind = 'create';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0015 FALHOU: trigger snapshot nao criou evento create';
  end if;

  -- 8) evolution valida permitida
  insert into public.care_plan_events (
    care_plan_id, organization_id, user_id, professional_id,
    event_kind, event_category, payload, note, authored_by
  ) values (
    v_plan, v_org_a, v_user_a, v_pro_a,
    'evolution', 'clinical_evolution', '{"text":"Evolucao OK"}'::jsonb, 'Evolucao OK', v_pro_a
  );

  -- 9) par evolution + clinical_evolution (contrato vigente) ja validado acima;
  --    event_kind='clinical_evolution' nao e kind direto permitido
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_a,
      'clinical_evolution', 'clinical_evolution', '{}'::jsonb, 'kind invalido', v_pro_a
    );
    raise exception 'VALIDACAO 0015 FALHOU: event_kind clinical_evolution direto aceito';
  exception
    when check_violation then null;
    when insufficient_privilege then null;
    when others then
      if sqlstate in ('23514', '42501') then null; else raise; end if;
  end;

  -- 10) INSERT direto reassessment rejeitado
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_a,
      'reassessment', 'reassessment', '{"text":"bypass"}'::jsonb, 'bypass', v_pro_a
    );
    raise exception 'VALIDACAO 0015 FALHOU: INSERT direto reassessment aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 11) estrutural rejeitado
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_a,
      'create', 'structural', '{}'::jsonb, 'estrutural', v_pro_a
    );
    raise exception 'VALIDACAO 0015 FALHOU: INSERT estrutural aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 12) status_change rejeitado
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_a,
      'plan_status', 'status_change', '{}'::jsonb, 'status', v_pro_a
    );
    raise exception 'VALIDACAO 0015 FALHOU: INSERT status_change aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 13) snapshot/kind interno rejeitado
  begin
    insert into public.care_plan_events (
      care_plan_id, organization_id, user_id, professional_id,
      event_kind, event_category, payload, note, authored_by
    ) values (
      v_plan, v_org_a, v_user_a, v_pro_a,
      'plan_update', 'structural', '{}'::jsonb, 'snapshot', v_pro_a
    );
    raise exception 'VALIDACAO 0015 FALHOU: INSERT plan_update aceito';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 14-15) RPC reassessment valida: plano + exatamente 1 evento
  select version, last_reassessed_at
    into v_version_before, v_last_reassessed_before
    from public.care_plans where id = v_plan;

  v_reassess := public.reassess_clinical_care_plan(
    v_plan, v_version_before, 'Reavaliacao RPC OK', current_date + 30
  );
  if (v_reassess -> 'event' ->> 'event_kind') is distinct from 'reassessment' then
    raise exception 'VALIDACAO 0015 FALHOU: RPC nao retornou evento reassessment';
  end if;
  select count(*) into v_count
    from public.care_plan_events
   where care_plan_id = v_plan and event_kind = 'reassessment';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0015 FALHOU: RPC deveria criar exatamente 1 reassessment';
  end if;
  select version into v_count from public.care_plans where id = v_plan;
  if v_count <> v_version_before + 1 then
    raise exception 'VALIDACAO 0015 FALHOU: RPC nao incrementou version';
  end if;
  if (select last_reassessed_at from public.care_plans where id = v_plan) is not distinct from v_last_reassessed_before then
    raise exception 'VALIDACAO 0015 FALHOU: RPC nao atualizou last_reassessed_at';
  end if;

  -- 16) conflito de versao
  select version into v_version_before from public.care_plans where id = v_plan;
  begin
    perform public.reassess_clinical_care_plan(v_plan, 999999, 'stale', null);
    raise exception 'VALIDACAO 0015 FALHOU: conflito de versao deveria falhar';
  exception
    when serialization_failure then null;
    when others then
      if sqlstate in ('40001', 'P0001') or sqlerrm ilike '%conflito de versao%' then null; else raise; end if;
  end;
  if (select version from public.care_plans where id = v_plan) <> v_version_before then
    raise exception 'VALIDACAO 0015 FALHOU: conflito alterou version';
  end if;
  select count(*) into v_count
    from public.care_plan_events
   where care_plan_id = v_plan and event_kind = 'reassessment';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0015 FALHOU: conflito criou evento extra';
  end if;

  -- 17) falha no insert do evento desfaz UPDATE
  execute 'reset role';
  create or replace function pg_temp.fail_reassess_event()
  returns trigger
  language plpgsql
  as $t$
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
  select version into v_version_before from public.care_plans where id = v_plan;
  begin
    perform public.reassess_clinical_care_plan(v_plan, v_version_before, '__FORCE_FAIL__', null);
    raise exception 'VALIDACAO 0015 FALHOU: falha forçada deveria abortar RPC';
  exception
    when others then
      if sqlerrm ilike '%forced event insert failure%' then null; else raise; end if;
  end;
  if (select version from public.care_plans where id = v_plan) <> v_version_before then
    raise exception 'VALIDACAO 0015 FALHOU: falha no evento nao reverteu plano';
  end if;
  execute 'reset role';
  drop trigger if exists trg_tmp_fail_reassess_event on public.care_plan_events;

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  -- 18-19) UPDATE/DELETE events proibidos
  begin
    update public.care_plan_events set note = 'hack' where care_plan_id = v_plan;
    raise exception 'VALIDACAO 0015 FALHOU: UPDATE em events permitido';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  begin
    delete from public.care_plan_events where care_plan_id = v_plan;
    raise exception 'VALIDACAO 0015 FALHOU: DELETE em events permitido';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- 20) gestor_clinico SELECT somente
  perform set_config('request.jwt.claim.sub', v_mgr_clin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr_clin::text)::text, true);
  execute 'set local role authenticated';
  if public.can_supervise_clinical_care_plan(v_org_a) is not true then
    raise exception 'VALIDACAO 0015 FALHOU: gestor deveria supervisionar org A';
  end if;
  select count(*) into v_count from public.care_plans where id = v_plan;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0015 FALHOU: gestor nao leu plano da propria org';
  end if;
  begin
    update public.care_plans
       set title = 'hack', version = version + 1, updated_by = v_mgr_clin
     where id = v_plan;
    raise exception 'VALIDACAO 0015 FALHOU: gestor atualizou plano';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' or sqlerrm ilike '%0 rows%' then null;
      else
        -- RLS pode silenciar update (0 rows) sem exception
        null;
      end if;
  end;
  if (select title from public.care_plans where id = v_plan) = 'hack' then
    raise exception 'VALIDACAO 0015 FALHOU: titulo alterado pelo gestor';
  end if;
  execute 'reset role';

  -- 21) sem leitura/escrita cross-org
  perform set_config('request.jwt.claim.sub', v_mgr_clin_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr_clin_b::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.care_plans where id = v_plan;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0015 FALHOU: gestor B leu plano da org A';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.care_plans where id = v_plan;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0015 FALHOU: pro_b leu plano da org A';
  end if;
  execute 'reset role';

  -- 22) grants minimos: status/last_reassessed_at sem UPDATE; events sem UPDATE/DELETE
  select exists (
    select 1 from information_schema.column_privileges
     where grantee = 'authenticated' and table_schema = 'public' and table_name = 'care_plans'
       and column_name = 'status' and privilege_type = 'UPDATE'
  ) into v_has_exec;
  if v_has_exec then
    raise exception 'VALIDACAO 0015 FALHOU: UPDATE em status ainda concedido';
  end if;
  select exists (
    select 1 from information_schema.table_privileges
     where grantee = 'authenticated' and table_schema = 'public' and table_name = 'care_plan_events'
       and privilege_type in ('UPDATE', 'DELETE')
  ) into v_has_exec;
  if v_has_exec then
    raise exception 'VALIDACAO 0015 FALHOU: UPDATE/DELETE em events concedido';
  end if;

  -- 24) unicidade/lifecycle do PR #10 permanecem
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  begin
    execute format(
      'update public.care_plans set status = %L, version = version + 1, updated_by = %L where id = %L',
      'inativo', v_pro_a, v_plan
    );
    raise exception 'VALIDACAO 0015 FALHOU: plano aberto aceitou status=inativo';
  exception
    when insufficient_privilege then null;
    when check_violation then null;
    when others then
      if sqlstate in ('42501', '23514') then null; else raise; end if;
  end;

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
    raise exception 'VALIDACAO 0015 FALHOU: segundo plano aberto aceito';
  exception
    when unique_violation then null;
    when others then
      if sqlstate = '23505' then null; else raise; end if;
  end;

  -- concluir permite novo plano
  update public.care_plans
     set plan_status = 'concluido',
         closed_at = now(),
         closed_by = v_pro_a,
         version = version + 1,
         updated_by = v_pro_a,
         updated_at = now()
   where id = v_plan;

  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Plano 2', 'ativo', 1,
    'planejado', 'Retomada', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1'
  ) returning id into v_plan2;

  -- trigger de acao ainda funciona apos revoke
  insert into public.care_plan_actions (
    organization_id, care_plan_id, user_id, professional_id, action_text, due_date,
    status, version, specific_objective, frequency, action_status, display_order,
    notes, created_by, updated_by
  ) values (
    v_org_a, v_plan2, v_user_a, v_pro_a, 'Acao H', current_date + 7,
    'ativo', 1, 'Obj acao', 'diaria', 'pendente', 1,
    '', v_pro_a, v_pro_a
  ) returning id into v_action;

  select count(*) into v_count
    from public.care_plan_events
   where care_plan_id = v_plan2 and event_kind = 'action_create';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0015 FALHOU: trigger de acao nao gerou evento';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname = 'care_plans_one_open_unique_idx'
       and indexdef ilike '%planejado%'
       and replace(lower(indexdef), 'plan_status', '') not like '%status%'
  ) then
    raise exception 'VALIDACAO 0015 FALHOU: indice unico aberto regressou';
  end if;

  execute 'reset role';
  raise notice 'VALIDACAO 0015 OK';
end $$;

commit;
