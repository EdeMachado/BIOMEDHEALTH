-- Validacao executavel SUP-C03 em Postgres descartavel.
-- Premissa: migrations 0001..0014 + harness auth.uid()/authenticated + auth.users.

begin;

do $$
declare
  v_org_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_org_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_pro_a uuid := '12121212-1212-1212-1212-121212121212';
  v_pro_b uuid := '13131313-1313-1313-1313-131313131313';
  v_mgr_inst uuid := '14141414-1414-1414-1414-141414141414';
  v_mgr_clin uuid := '15151515-1515-1515-1515-151515151515';
  v_mgr_clin_b uuid := '17171717-1717-1717-1717-171717171717';
  v_asst uuid := '16161616-1616-1616-1616-161616161616';
  v_role_usuario uuid;
  v_role_medico uuid;
  v_role_gestor_inst uuid;
  v_role_gestor_clin uuid;
  v_uo_user uuid;
  v_uo_pro uuid;
  v_uo_mgr_inst uuid;
  v_uo_mgr_clin uuid;
  v_uo_mgr_clin_b uuid;
  v_uo_asst uuid;
  v_uo_pro_b_membership uuid;
  v_count int;
  v_rows int;
  v_plan uuid;
  v_plan2 uuid;
  v_plan3 uuid;
  v_action uuid;
  v_record_a uuid;
  v_record_b uuid;
  v_version_before int;
  v_reassess jsonb;
  v_has_update boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_user_a, 'user.a@example.com', '{"full_name":"Paciente A"}'::jsonb),
    (v_user_b, 'user.b@example.com', '{"full_name":"Paciente B"}'::jsonb),
    (v_pro_a, 'pro.a@example.com', '{"full_name":"Medico A"}'::jsonb),
    (v_pro_b, 'pro.b@example.com', '{"full_name":"Medico B"}'::jsonb),
    (v_mgr_inst, 'mgr.inst@example.com', '{"full_name":"Gestor Inst"}'::jsonb),
    (v_mgr_clin, 'mgr.clin@example.com', '{"full_name":"Gestor Clin"}'::jsonb),
    (v_mgr_clin_b, 'mgr.clin.b@example.com', '{"full_name":"Gestor Clin B"}'::jsonb),
    (v_asst, 'asst@example.com', '{"full_name":"Assistente"}'::jsonb)
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
    ('gestor_institucional', 'Gestor institucional', 'ativo'),
    ('gestor_clinico', 'Gestor clinico', 'ativo')
  on conflict (code) do nothing;

  select id into v_role_usuario from public.roles where code = 'usuario';
  select id into v_role_medico from public.roles where code = 'medico';
  select id into v_role_gestor_inst from public.roles where code = 'gestor_institucional';
  select id into v_role_gestor_clin from public.roles where code = 'gestor_clinico';

  insert into public.user_organizations (organization_id, user_id, status)
  values
    (v_org_a, v_user_a, 'ativo'),
    (v_org_a, v_pro_a, 'ativo'),
    (v_org_a, v_mgr_inst, 'ativo'),
    (v_org_a, v_mgr_clin, 'ativo'),
    (v_org_a, v_asst, 'ativo'),
    (v_org_b, v_user_b, 'ativo'),
    (v_org_b, v_pro_b, 'ativo'),
    (v_org_b, v_pro_a, 'ativo'),
    (v_org_b, v_mgr_clin_b, 'ativo')
  on conflict (organization_id, user_id) do nothing;

  select id into v_uo_user from public.user_organizations where organization_id = v_org_a and user_id = v_user_a;
  select id into v_uo_pro from public.user_organizations where organization_id = v_org_a and user_id = v_pro_a;
  select id into v_uo_mgr_inst from public.user_organizations where organization_id = v_org_a and user_id = v_mgr_inst;
  select id into v_uo_mgr_clin from public.user_organizations where organization_id = v_org_a and user_id = v_mgr_clin;
  select id into v_uo_asst from public.user_organizations where organization_id = v_org_a and user_id = v_asst;
  select id into v_uo_pro_b_membership from public.user_organizations where organization_id = v_org_b and user_id = v_pro_a;
  select id into v_uo_mgr_clin_b from public.user_organizations where organization_id = v_org_b and user_id = v_mgr_clin_b;

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  values
    (v_org_a, v_uo_user, v_role_usuario, 'ativo'),
    (v_org_a, v_uo_pro, v_role_medico, 'ativo'),
    (v_org_a, v_uo_mgr_inst, v_role_gestor_inst, 'ativo'),
    (v_org_a, v_uo_mgr_clin, v_role_gestor_clin, 'ativo'),
    (v_org_a, v_uo_asst, v_role_usuario, 'ativo'),
    (v_org_b, v_uo_pro_b_membership, v_role_medico, 'ativo'),
    (v_org_b, v_uo_mgr_clin_b, v_role_gestor_clin, 'ativo')
  on conflict do nothing;

  delete from public.care_plan_events where organization_id in (v_org_a, v_org_b);
  delete from public.care_plan_actions where organization_id in (v_org_a, v_org_b);
  delete from public.care_plans where organization_id in (v_org_a, v_org_b);
  delete from public.clinical_record_versions where organization_id in (v_org_a, v_org_b);
  delete from public.clinical_records where organization_id in (v_org_a, v_org_b);
  delete from public.professional_assignments where organization_id in (v_org_a, v_org_b);

  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values
    (v_org_a, v_pro_a, v_user_a, 'acompanhamento', 'ativo'),
    (v_org_b, v_pro_a, v_user_b, 'multi-org', 'ativo'),
    (v_org_a, v_asst, v_user_a, 'sem-papel-clinico', 'ativo');

  -- fichas para teste de clinical_record_id
  insert into public.clinical_records (
    organization_id, user_id, professional_id, summary, status, version,
    record_status, schema_version, sections, revision_number, authored_by
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Ficha A', 'ativo', 1,
    'rascunho', 'clinical_record.v1', '{}'::jsonb, 1, v_pro_a
  ) returning id into v_record_a;

  insert into public.clinical_records (
    organization_id, user_id, professional_id, summary, status, version,
    record_status, schema_version, sections, revision_number, authored_by
  ) values (
    v_org_b, v_user_b, v_pro_a, 'Ficha B', 'ativo', 1,
    'rascunho', 'clinical_record.v1', '{}'::jsonb, 1, v_pro_a
  ) returning id into v_record_b;

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  if public.can_manage_clinical_care_plan(v_org_a) is not true then
    raise exception 'VALIDACAO 0014 FALHOU: pro_a deveria gerir plano';
  end if;

  -- clinical_record_id nulo aceito
  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version, clinical_record_id
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Plano sono', 'ativo', 1,
    'planejado', 'Melhorar higiene do sono', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1', null
  ) returning id into v_plan;

  -- clinical_record_id valido aceito
  update public.care_plans
     set clinical_record_id = v_record_a,
         version = 2,
         updated_by = v_pro_a,
         updated_at = now()
   where id = v_plan;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0014 FALHOU: clinical_record_id valido rejeitado';
  end if;

  -- clinical_record_id de outra org rejeitado
  begin
    update public.care_plans
       set clinical_record_id = v_record_b,
           version = 3,
           updated_by = v_pro_a
     where id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: clinical_record_id cross-org aceito';
  exception
    when foreign_key_violation then null;
    when others then
      if sqlstate = '23503' then null; else raise; end if;
  end;

  -- clinical_record_id de outro paciente (mesma org) rejeitado
  execute 'reset role';
  insert into public.user_organizations (organization_id, user_id, status)
  values (v_org_a, v_user_b, 'ativo')
  on conflict (organization_id, user_id) do nothing;

  insert into public.clinical_records (
    organization_id, user_id, professional_id, summary, status, version,
    record_status, schema_version, sections, revision_number, authored_by
  ) values (
    v_org_a, v_user_b, v_pro_a, 'Ficha outro paciente', 'ativo', 1,
    'rascunho', 'clinical_record.v1', '{}'::jsonb, 1, v_pro_a
  ) returning id into v_record_b;

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  begin
    update public.care_plans
       set clinical_record_id = v_record_b,
           version = 3,
           updated_by = v_pro_a
     where id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: clinical_record_id de outro paciente aceito';
  exception
    when foreign_key_violation then null;
    when others then
      if sqlstate = '23503' then null; else raise; end if;
  end;

  -- plano planejado nao pode receber status=inativo (CHECK; grant tambem bloqueia)
  begin
    execute format(
      'update public.care_plans set status = %L, version = version + 1, updated_by = %L where id = %L',
      'inativo', v_pro_a, v_plan
    );
    raise exception 'VALIDACAO 0014 FALHOU: planejado aceitou status=inativo';
  exception
    when insufficient_privilege then null;
    when check_violation then null;
    when others then
      if sqlstate in ('42501', '23514') then null; else raise; end if;
  end;

  select count(*) into v_count from public.care_plan_events where care_plan_id = v_plan and event_kind = 'create';
  if v_count < 1 then
    raise exception 'VALIDACAO 0014 FALHOU: evento create ausente';
  end if;

  insert into public.care_plan_actions (
    organization_id, care_plan_id, user_id, professional_id, action_text, due_date,
    status, version, specific_objective, frequency, action_status, display_order,
    notes, created_by, updated_by
  ) values (
    v_org_a, v_plan, v_user_a, v_pro_a, 'Desligar telas 1h antes', current_date + 7,
    'ativo', 1, 'Reduzir estimulacao noturna', 'diaria', 'pendente', 1,
    '', v_pro_a, v_pro_a
  ) returning id into v_action;

  update public.care_plan_actions
     set action_status = 'em_andamento',
         version = 2,
         updated_by = v_pro_a,
         updated_at = now()
   where id = v_action;

  insert into public.care_plan_events (
    care_plan_id, organization_id, user_id, professional_id,
    event_kind, event_category, payload, note, authored_by
  ) values (
    v_plan, v_org_a, v_user_a, v_pro_a,
    'evolution', 'clinical_evolution', '{"text":"Paciente aderente"}'::jsonb, 'Evolucao', v_pro_a
  );

  -- reavaliacao atomica valida
  select version into v_version_before from public.care_plans where id = v_plan;
  v_reassess := public.reassess_clinical_care_plan(v_plan, v_version_before, 'Reavaliacao OK', current_date + 30);
  if (v_reassess -> 'event' ->> 'event_kind') is distinct from 'reassessment' then
    raise exception 'VALIDACAO 0014 FALHOU: reavaliacao nao criou evento';
  end if;
  select count(*) into v_count from public.care_plan_events
   where care_plan_id = v_plan and event_kind = 'reassessment';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0014 FALHOU: reavaliacao deveria criar exatamente 1 evento';
  end if;
  select version into v_count from public.care_plans where id = v_plan;
  if v_count <> v_version_before + 1 then
    raise exception 'VALIDACAO 0014 FALHOU: reavaliacao nao incrementou version';
  end if;

  -- conflito de versao na reavaliacao
  begin
    perform public.reassess_clinical_care_plan(v_plan, 999, 'stale', null);
    raise exception 'VALIDACAO 0014 FALHOU: conflito de versao deveria falhar';
  exception
    when serialization_failure then null;
    when others then
      if sqlstate in ('40001', 'P0001') or sqlerrm ilike '%conflito de versao%' then null; else raise; end if;
  end;
  select version into v_count from public.care_plans where id = v_plan;
  if v_count <> v_version_before + 1 then
    raise exception 'VALIDACAO 0014 FALHOU: conflito de versao alterou o plano';
  end if;
  select count(*) into v_count from public.care_plan_events
   where care_plan_id = v_plan and event_kind = 'reassessment';
  if v_count <> 1 then
    raise exception 'VALIDACAO 0014 FALHOU: conflito de versao criou evento extra';
  end if;

  -- falha na insercao do evento desfaz integralmente o update do plano
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
    perform public.reassess_clinical_care_plan(v_plan, v_version_before, '__FORCE_FAIL__', current_date + 60);
    raise exception 'VALIDACAO 0014 FALHOU: falha forçada no evento deveria abortar RPC';
  exception
    when others then
      if sqlerrm ilike '%forced event insert failure%' then null; else raise; end if;
  end;
  select version into v_count from public.care_plans where id = v_plan;
  if v_count <> v_version_before then
    raise exception 'VALIDACAO 0014 FALHOU: falha no evento nao reverteu version do plano';
  end if;
  select count(*) into v_count from public.care_plan_events
   where care_plan_id = v_plan and note = '__FORCE_FAIL__';
  if v_count <> 0 then
    raise exception 'VALIDACAO 0014 FALHOU: evento forçado falhou mas ficou persistido';
  end if;
  execute 'reset role';
  drop trigger if exists trg_tmp_fail_reassess_event on public.care_plan_events;
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  select version into v_version_before from public.care_plans where id = v_plan;
  update public.care_plans
     set plan_status = 'em_andamento',
         version = version + 1,
         updated_by = v_pro_a,
         updated_at = now()
   where id = v_plan;

  -- em_andamento nao pode receber status=inativo
  begin
    execute format(
      'update public.care_plans set status = %L, version = version + 1, updated_by = %L where id = %L',
      'inativo', v_pro_a, v_plan
    );
    raise exception 'VALIDACAO 0014 FALHOU: em_andamento aceitou status=inativo';
  exception
    when insufficient_privilege then null;
    when check_violation then null;
    when others then
      if sqlstate in ('42501', '23514') then null; else raise; end if;
  end;

  -- bypass via status=inativo nao libera segundo plano aberto
  -- (mesmo como table owner via SECURITY DEFINER nao aplicavel aqui; simula com role postgres reset)
  execute 'reset role';
  begin
    update public.care_plans set status = 'inativo' where id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: owner conseguiu marcar aberto como inativo';
  exception
    when check_violation then null;
    when others then
      if sqlstate = '23514' then null; else raise; end if;
  end;

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
    raise exception 'VALIDACAO 0014 FALHOU: unique open deveria falhar';
  exception
    when unique_violation then null;
    when others then
      if sqlstate = '23505' then null; else raise; end if;
  end;

  -- concluir permite novo plano
  select version into v_version_before from public.care_plans where id = v_plan;
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
    'planejado', 'Manter rotina', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1'
  ) returning id into v_plan2;

  -- suspender plano2 exige motivo
  begin
    update public.care_plans
       set plan_status = 'suspenso',
           closed_at = now(),
           closed_by = v_pro_a,
           suspension_reason = null,
           version = 2,
           updated_by = v_pro_a
     where id = v_plan2;
    raise exception 'VALIDACAO 0014 FALHOU: suspensao sem motivo deveria falhar';
  exception
    when check_violation then null;
    when insufficient_privilege then null;
    when others then
      if sqlstate in ('23514', '42501') then null; else raise; end if;
  end;

  update public.care_plans
     set plan_status = 'suspenso',
         closed_at = now(),
         closed_by = v_pro_a,
         suspension_reason = 'Baixa adesao temporaria',
         version = 2,
         updated_by = v_pro_a,
         updated_at = now()
   where id = v_plan2;

  -- plano suspenso permite novo plano
  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Plano 3', 'ativo', 1,
    'planejado', 'Retomada', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1'
  ) returning id into v_plan3;

  -- unicidade de plano aberto independe do lifecycle status
  if not exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and indexname = 'care_plans_one_open_unique_idx'
       and indexdef ilike '%planejado%'
       and indexdef ilike '%em_andamento%'
       and replace(lower(indexdef), 'plan_status', '') not like '%status%'
  ) then
    raise exception 'VALIDACAO 0014 FALHOU: indice unico ainda depende de lifecycle status';
  end if;

  -- grants: status nao deve estar em update privileges
  select exists (
    select 1
      from information_schema.column_privileges
     where grantee = 'authenticated'
       and table_schema = 'public'
       and table_name = 'care_plans'
       and column_name = 'status'
       and privilege_type = 'UPDATE'
  ) into v_has_update;
  if v_has_update then
    raise exception 'VALIDACAO 0014 FALHOU: UPDATE em status ainda concedido';
  end if;

  select exists (
    select 1
      from information_schema.column_privileges
     where grantee = 'authenticated'
       and table_schema = 'public'
       and table_name = 'care_plans'
       and column_name = 'last_reassessed_at'
       and privilege_type = 'UPDATE'
  ) into v_has_update;
  if v_has_update then
    raise exception 'VALIDACAO 0014 FALHOU: UPDATE em last_reassessed_at ainda concedido';
  end if;

  -- DELETE negado
  begin
    delete from public.care_plans where id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: DELETE deveria ser negado';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- eventos append-only: UPDATE/DELETE negados
  begin
    update public.care_plan_events set note = 'hack' where care_plan_id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: UPDATE em events deveria ser negado';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  begin
    delete from public.care_plan_events where care_plan_id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: DELETE em events deveria ser negado';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- pro_b nao ve plano de A
  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.care_plans where id = v_plan;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0014 FALHOU: pro_b listou plano de pro_a';
  end if;
  execute 'reset role';

  -- gestor clinico mesma org: SELECT autorizado
  perform set_config('request.jwt.claim.sub', v_mgr_clin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr_clin::text)::text, true);
  execute 'set local role authenticated';
  if public.can_supervise_clinical_care_plan(v_org_a) is not true then
    raise exception 'VALIDACAO 0014 FALHOU: gestor_clinico deveria supervisionar';
  end if;
  select count(*) into v_count from public.care_plans where organization_id = v_org_a;
  if v_count < 1 then
    raise exception 'VALIDACAO 0014 FALHOU: gestor_clinico nao leu planos da org';
  end if;
  select count(*) into v_count from public.care_plan_actions where organization_id = v_org_a;
  if v_count < 1 then
    raise exception 'VALIDACAO 0014 FALHOU: gestor_clinico nao leu acoes';
  end if;
  select count(*) into v_count from public.care_plan_events where organization_id = v_org_a;
  if v_count < 1 then
    raise exception 'VALIDACAO 0014 FALHOU: gestor_clinico nao leu historico';
  end if;
  begin
    insert into public.care_plans (
      organization_id, user_id, professional_id, title, status, version,
      plan_status, general_objective, starts_on, clinical_notes,
      created_by, updated_by, schema_version
    ) values (
      v_org_a, v_user_a, v_mgr_clin, 'gestor', 'ativo', 1,
      'planejado', 'x', current_date, '',
      v_mgr_clin, v_mgr_clin, 'care_plan.v1'
    );
    raise exception 'VALIDACAO 0014 FALHOU: gestor_clinico inseriu plano';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  begin
    update public.care_plans set title = 'hack', version = version + 1, updated_by = v_mgr_clin
     where id = v_plan3;
    raise exception 'VALIDACAO 0014 FALHOU: gestor_clinico atualizou plano';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate in ('42501', 'P0001') then null; else raise; end if;
  end;
  begin
    delete from public.care_plans where id = v_plan3;
    raise exception 'VALIDACAO 0014 FALHOU: gestor_clinico deletou plano';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- gestor clinico outra org nao consulta
  perform set_config('request.jwt.claim.sub', v_mgr_clin_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr_clin_b::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.care_plans where organization_id = v_org_a;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0014 FALHOU: gestor_clinico cross-org leu planos';
  end if;
  execute 'reset role';

  -- gestor institucional sem SELECT clinico
  perform set_config('request.jwt.claim.sub', v_mgr_inst::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr_inst::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.care_plans where organization_id = v_org_a;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0014 FALHOU: gestor institucional listou planos';
  end if;
  execute 'reset role';

  -- assistente sem papel clinico
  perform set_config('request.jwt.claim.sub', v_asst::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_asst::text)::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.care_plans (
      organization_id, user_id, professional_id, title, status, version,
      plan_status, general_objective, starts_on, clinical_notes,
      created_by, updated_by, schema_version
    ) values (
      v_org_a, v_user_a, v_asst, 'asst', 'ativo', 1,
      'planejado', 'x', current_date, '',
      v_asst, v_asst, 'care_plan.v1'
    );
    raise exception 'VALIDACAO 0014 FALHOU: assistente inseriu plano';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  raise notice 'VALIDACAO 0014 OK';
end $$;

commit;
