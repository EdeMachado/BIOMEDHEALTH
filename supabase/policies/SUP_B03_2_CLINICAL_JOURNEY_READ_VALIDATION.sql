-- Validacao executavel SUP-B03.2 em Postgres descartavel.
-- Premissa: migrations 0001..0010 + harness auth.uid()/authenticated.

begin;

do $$
declare
  v_org_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_org_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_pro_a uuid := '12121212-1212-1212-1212-121212121212';
  v_pro_b uuid := '13131313-1313-1313-1313-131313131313';
  v_mgr uuid := '14141414-1414-1414-1414-141414141414';
  v_role_usuario uuid;
  v_role_medico uuid;
  v_role_gestor uuid;
  v_uo_pro uuid;
  v_uo_mgr uuid;
  v_uo_user uuid;
  v_hj uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_ver uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
  v_step uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5';
  v_act uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7';
  v_uj uuid;
  v_rows int;
  v_count int;
begin
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
    (v_org_b, v_pro_b, 'ativo')
  on conflict (organization_id, user_id) do nothing;

  select id into v_uo_user from public.user_organizations where organization_id = v_org_a and user_id = v_user_a;
  select id into v_uo_pro from public.user_organizations where organization_id = v_org_a and user_id = v_pro_a;
  select id into v_uo_mgr from public.user_organizations where organization_id = v_org_a and user_id = v_mgr;

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  values
    (v_org_a, v_uo_user, v_role_usuario, 'ativo'),
    (v_org_a, v_uo_pro, v_role_medico, 'ativo'),
    (v_org_a, v_uo_mgr, v_role_gestor, 'ativo')
  on conflict do nothing;

  delete from public.professional_assignments
  where organization_id = v_org_a and professional_id = v_pro_a and user_id = v_user_a;

  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values (v_org_a, v_pro_a, v_user_a, 'acompanhamento', 'ativo');

  insert into public.health_journeys (
    id, organization_id, name, description, target_audience, duration_weeks, technical_owner, status
  ) values (v_hj, v_org_a, 'Jornada A', 'd', 'a', 8, 't', 'ativo')
  on conflict (id) do nothing;

  insert into public.journey_versions (id, organization_id, journey_id, code, status, version)
  values (v_ver, v_org_a, v_hj, 'a-v1', 'ativo', 1)
  on conflict (id) do nothing;

  insert into public.journey_steps (id, organization_id, journey_version_id, title, step_order, status)
  values (v_step, v_org_a, v_ver, 'S1', 1, 'ativo')
  on conflict (id) do nothing;

  insert into public.journey_activities (id, organization_id, journey_step_id, title, periodicity, status)
  values (v_act, v_org_a, v_step, 'Atividade', 'Diaria', 'ativo')
  on conflict (id) do nothing;

  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a::text)::text, true);
  execute 'set local role authenticated';
  v_uj := (public.create_or_get_active_user_journey(v_org_a, v_ver, 'ativo')).id;
  insert into public.user_activity_progress (
    organization_id, user_journey_id, journey_activity_id, progress_percent, status
  ) values (v_org_a, v_uj, v_act, 40, 'em_andamento')
  on conflict (user_journey_id, journey_activity_id) do update
    set progress_percent = 40, status = 'em_andamento';
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  if public.can_access_linked_patient_journey(v_org_a, v_user_a) is not true then
    raise exception 'VALIDACAO 0010 FALHOU: profissional vinculado deveria acessar';
  end if;
  select count(*) into v_count from public.user_journeys where id = v_uj;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0010 FALHOU: leitura clinica de jornada falhou';
  end if;
  select count(*) into v_count from public.user_activity_progress where user_journey_id = v_uj;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0010 FALHOU: leitura clinica de progresso falhou';
  end if;

  update public.user_activity_progress set progress_percent = 99 where user_journey_id = v_uj;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDACAO 0010 FALHOU: profissional nao deveria atualizar progresso';
  end if;
  update public.user_journeys set status = 'concluida', completed_at = now() where id = v_uj;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDACAO 0010 FALHOU: profissional nao deveria concluir jornada';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', v_mgr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr::text)::text, true);
  execute 'set local role authenticated';
  if public.can_access_linked_patient_journey(v_org_a, v_user_a) then
    raise exception 'VALIDACAO 0010 FALHOU: gestor nao deveria ter acesso clinico';
  end if;
  select count(*) into v_count from public.user_journeys where id = v_uj;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0010 FALHOU: gestor leu jornada nominal';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';
  if public.can_access_linked_patient_journey(v_org_a, v_user_a) then
    raise exception 'VALIDACAO 0010 FALHOU: cross-tenant deveria negar';
  end if;
  select count(*) into v_count from public.user_journeys where organization_id = v_org_a;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0010 FALHOU: profissional org B leu org A';
  end if;
  execute 'reset role';

  -- vinculo inativo
  update public.professional_assignments
     set status = 'inativo'
   where organization_id = v_org_a and professional_id = v_pro_a and user_id = v_user_a;
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  if public.can_access_linked_patient_journey(v_org_a, v_user_a) then
    raise exception 'VALIDACAO 0010 FALHOU: vinculo inativo deveria negar';
  end if;
  execute 'reset role';
  update public.professional_assignments
     set status = 'ativo'
   where organization_id = v_org_a and professional_id = v_pro_a and user_id = v_user_a;

  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a::text)::text, true);
  execute 'set local role authenticated';
  update public.user_activity_progress
     set progress_percent = 100, status = 'concluida', version = version + 1
   where user_journey_id = v_uj;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0010 FALHOU: titular deveria atualizar progresso ativo';
  end if;
  update public.user_journeys
     set completed_at = now(), status = 'concluida', version = version + 1
   where id = v_uj;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0010 FALHOU: titular deveria concluir jornada';
  end if;
  update public.user_activity_progress set progress_percent = 50 where user_journey_id = v_uj;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDACAO 0010 FALHOU: imutabilidade 0009 quebrada';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.user_journeys where id = v_uj and completed_at is not null;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0010 FALHOU: leitura historica clinica falhou';
  end if;
  execute 'reset role';

  raise notice 'VALIDACAO 0010 OK';
end $$;

commit;
