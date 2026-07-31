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
  v_mgr uuid := '14141414-1414-1414-1414-141414141414';
  v_asst uuid := '16161616-1616-1616-1616-161616161616';
  v_role_usuario uuid;
  v_role_medico uuid;
  v_role_gestor uuid;
  v_uo_user uuid;
  v_uo_pro uuid;
  v_uo_mgr uuid;
  v_uo_asst uuid;
  v_uo_pro_b_membership uuid;
  v_count int;
  v_rows int;
  v_plan uuid;
  v_plan2 uuid;
  v_action uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_user_a, 'user.a@example.com', '{"full_name":"Paciente A"}'::jsonb),
    (v_user_b, 'user.b@example.com', '{"full_name":"Paciente B"}'::jsonb),
    (v_pro_a, 'pro.a@example.com', '{"full_name":"Medico A"}'::jsonb),
    (v_pro_b, 'pro.b@example.com', '{"full_name":"Medico B"}'::jsonb),
    (v_mgr, 'mgr@example.com', '{"full_name":"Gestor"}'::jsonb),
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
    ('gestor_institucional', 'Gestor', 'ativo')
  on conflict (code) do nothing;

  select id into v_role_usuario from public.roles where code = 'usuario';
  select id into v_role_medico from public.roles where code = 'medico';
  select id into v_role_gestor from public.roles where code = 'gestor_institucional';

  insert into public.user_organizations (organization_id, user_id, status)
  values
    (v_org_a, v_user_a, 'ativo'),
    (v_org_a, v_pro_a, 'ativo'),
    (v_org_a, v_mgr, 'ativo'),
    (v_org_a, v_asst, 'ativo'),
    (v_org_b, v_user_b, 'ativo'),
    (v_org_b, v_pro_b, 'ativo'),
    (v_org_b, v_pro_a, 'ativo')
  on conflict (organization_id, user_id) do nothing;

  select id into v_uo_user from public.user_organizations where organization_id = v_org_a and user_id = v_user_a;
  select id into v_uo_pro from public.user_organizations where organization_id = v_org_a and user_id = v_pro_a;
  select id into v_uo_mgr from public.user_organizations where organization_id = v_org_a and user_id = v_mgr;
  select id into v_uo_asst from public.user_organizations where organization_id = v_org_a and user_id = v_asst;
  select id into v_uo_pro_b_membership
    from public.user_organizations
   where organization_id = v_org_b and user_id = v_pro_a;

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  values
    (v_org_a, v_uo_user, v_role_usuario, 'ativo'),
    (v_org_a, v_uo_pro, v_role_medico, 'ativo'),
    (v_org_a, v_uo_mgr, v_role_gestor, 'ativo'),
    (v_org_a, v_uo_asst, v_role_usuario, 'ativo'),
    (v_org_b, v_uo_pro_b_membership, v_role_medico, 'ativo')
  on conflict do nothing;

  delete from public.care_plan_events where organization_id in (v_org_a, v_org_b);
  delete from public.care_plan_actions where organization_id in (v_org_a, v_org_b);
  delete from public.care_plans where organization_id in (v_org_a, v_org_b);
  delete from public.professional_assignments where organization_id in (v_org_a, v_org_b);

  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values
    (v_org_a, v_pro_a, v_user_a, 'acompanhamento', 'ativo'),
    (v_org_b, v_pro_a, v_user_b, 'multi-org', 'ativo'),
    (v_org_a, v_asst, v_user_a, 'sem-papel-clinico', 'ativo');

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  if public.can_manage_clinical_care_plan(v_org_a) is not true then
    raise exception 'VALIDACAO 0014 FALHOU: pro_a deveria gerir plano';
  end if;

  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Plano sono', 'ativo', 1,
    'planejado', 'Melhorar higiene do sono', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1'
  ) returning id into v_plan;

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
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0014 FALHOU: update acao falhou';
  end if;

  insert into public.care_plan_events (
    care_plan_id, organization_id, user_id, professional_id,
    event_kind, event_category, payload, note, authored_by
  ) values (
    v_plan, v_org_a, v_user_a, v_pro_a,
    'evolution', 'clinical_evolution', '{"text":"Paciente aderente"}'::jsonb, 'Evolucao', v_pro_a
  );

  insert into public.care_plan_events (
    care_plan_id, organization_id, user_id, professional_id,
    event_kind, event_category, payload, note, authored_by
  ) values (
    v_plan, v_org_a, v_user_a, v_pro_a,
    'reassessment', 'reassessment', '{"text":"Reavaliar em 30d"}'::jsonb, 'Reavaliacao', v_pro_a
  );

  update public.care_plans
     set plan_status = 'em_andamento',
         version = 2,
         updated_by = v_pro_a,
         updated_at = now()
   where id = v_plan;

  -- segundo plano aberto deve falhar
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

  -- concluir
  update public.care_plans
     set plan_status = 'concluido',
         closed_at = now(),
         closed_by = v_pro_a,
         version = 3,
         updated_by = v_pro_a,
         updated_at = now()
   where id = v_plan;

  -- imutavel apos conclusao
  begin
    update public.care_plans
       set general_objective = 'hack',
           version = 4,
           updated_by = v_pro_a
     where id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: plano concluido foi alterado';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate in ('42501', 'P0001') then null; else raise; end if;
  end;

  -- novo plano apos encerramento
  insert into public.care_plans (
    organization_id, user_id, professional_id, title, status, version,
    plan_status, general_objective, starts_on, clinical_notes,
    created_by, updated_by, schema_version
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Plano 2', 'ativo', 1,
    'planejado', 'Manter rotina', current_date, '',
    v_pro_a, v_pro_a, 'care_plan.v1'
  ) returning id into v_plan2;

  select count(*) into v_count from public.care_plans where user_id = v_user_a and professional_id = v_pro_a;
  if v_count <> 2 then
    raise exception 'VALIDACAO 0014 FALHOU: historico de planos incompleto';
  end if;

  -- suspender plano2 exige motivo (RLS WITH CHECK e/ou CHECK constraint)
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

  -- DELETE negado
  begin
    delete from public.care_plans where id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: DELETE deveria ser negado';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- UPDATE evento historico negado (sem grant)
  begin
    update public.care_plan_events set note = 'hack' where care_plan_id = v_plan;
    raise exception 'VALIDACAO 0014 FALHOU: UPDATE em events deveria ser negado';
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
  begin
    insert into public.care_plans (
      organization_id, user_id, professional_id, title, status, version,
      plan_status, general_objective, starts_on, clinical_notes,
      created_by, updated_by, schema_version
    ) values (
      v_org_a, v_user_a, v_pro_a, 'forge', 'ativo', 1,
      'planejado', 'forge', current_date, '',
      v_pro_a, v_pro_a, 'care_plan.v1'
    );
    raise exception 'VALIDACAO 0014 FALHOU: professional_id forjado inseriu';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- gestor negado
  perform set_config('request.jwt.claim.sub', v_mgr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.care_plans where organization_id = v_org_a;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0014 FALHOU: gestor listou planos';
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
