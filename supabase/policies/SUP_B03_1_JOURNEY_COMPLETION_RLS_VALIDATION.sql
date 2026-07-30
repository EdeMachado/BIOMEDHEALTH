-- Validacao executavel SUP-B03.1 corretivo (0009) em Postgres descartavel.
-- Premissa: migrations 0001..0009 aplicadas + harness auth.uid()/authenticated.
-- Diferente dos testes Vitest com fake client.

begin;

do $$
declare
  v_org_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_org_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_user_a1 uuid := '11111111-1111-1111-1111-111111111111';
  v_user_a2 uuid := '22222222-2222-2222-2222-222222222222';
  v_user_b1 uuid := '33333333-3333-3333-3333-333333333333';
  v_hj_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_hj_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
  v_ver_a1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
  v_ver_a2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4';
  v_ver_b1 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';
  v_step_a1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5';
  v_step_a2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6';
  v_step_b1 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4';
  v_act_a1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7';
  v_act_a1b uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9';
  v_act_a2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8';
  v_act_b1 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5';
  v_uj uuid;
  v_progress_id uuid;
  v_progress_count int;
  v_journey_count int;
  v_rows int;
  v_insert_blocked boolean := false;
  v_version_blocked boolean := false;
begin
  insert into public.organizations (id, name, status)
  values
    (v_org_a, 'Org A', 'ativo'),
    (v_org_b, 'Org B', 'ativo')
  on conflict (id) do nothing;

  insert into public.user_organizations (organization_id, user_id, status)
  values
    (v_org_a, v_user_a1, 'ativo'),
    (v_org_a, v_user_a2, 'ativo'),
    (v_org_b, v_user_b1, 'ativo')
  on conflict (organization_id, user_id) do nothing;

  insert into public.health_journeys (
    id, organization_id, name, description, target_audience, duration_weeks, technical_owner, status
  ) values
    (v_hj_a, v_org_a, 'Jornada A', 'desc', 'adultos', 8, 'team', 'ativo'),
    (v_hj_b, v_org_b, 'Jornada B', 'desc', 'adultos', 8, 'team', 'ativo')
  on conflict (id) do nothing;

  insert into public.journey_versions (id, organization_id, journey_id, code, status, version)
  values
    (v_ver_a1, v_org_a, v_hj_a, 'a-v1', 'ativo', 1),
    (v_ver_a2, v_org_a, v_hj_a, 'a-v2', 'inativo', 2),
    (v_ver_b1, v_org_b, v_hj_b, 'b-v1', 'ativo', 1)
  on conflict (id) do nothing;

  insert into public.journey_steps (id, organization_id, journey_version_id, title, step_order, status)
  values
    (v_step_a1, v_org_a, v_ver_a1, 'Semana 1', 1, 'ativo'),
    (v_step_a2, v_org_a, v_ver_a2, 'Semana 1 hist', 1, 'ativo'),
    (v_step_b1, v_org_b, v_ver_b1, 'Semana 1 B', 1, 'ativo')
  on conflict (id) do nothing;

  insert into public.journey_activities (id, organization_id, journey_step_id, title, periodicity, status)
  values
    (v_act_a1, v_org_a, v_step_a1, 'Atividade A1', 'Diaria', 'ativo'),
    (v_act_a1b, v_org_a, v_step_a1, 'Atividade A1b', 'Diaria', 'ativo'),
    (v_act_a2, v_org_a, v_step_a2, 'Atividade A2 hist', 'Diaria', 'ativo'),
    (v_act_b1, v_org_b, v_step_b1, 'Atividade B1', 'Diaria', 'ativo')
  on conflict (id) do nothing;

  perform set_config('request.jwt.claim.sub', v_user_a1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a1::text)::text, true);
  execute 'set local role authenticated';

  v_uj := (public.create_or_get_active_user_journey(v_org_a, v_ver_a1, 'ativo')).id;

  insert into public.user_activity_progress (
    organization_id, user_journey_id, journey_activity_id, progress_percent, status
  ) values (v_org_a, v_uj, v_act_a1, 40, 'em_andamento')
  returning id into v_progress_id;

  update public.user_activity_progress
     set progress_percent = 100,
         status = 'concluida',
         version = version + 1,
         updated_at = now()
   where id = v_progress_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0009 FALHOU: update de progresso em jornada ativa deveria funcionar';
  end if;

  update public.user_journeys
     set completed_at = now(),
         status = 'concluida',
         version = version + 1,
         updated_at = now()
   where id = v_uj;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0009 FALHOU: conclusao legitima deveria funcionar';
  end if;

  begin
    insert into public.user_activity_progress (
      organization_id, user_journey_id, journey_activity_id, progress_percent, status
    ) values (v_org_a, v_uj, v_act_a1b, 10, 'em_andamento');
  exception
    when insufficient_privilege then
      v_insert_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_insert_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_insert_blocked then
    raise exception 'VALIDACAO 0009 FALHOU: insert pos-conclusao deveria ser bloqueado';
  end if;

  update public.user_activity_progress
     set progress_percent = 50,
         status = 'em_andamento',
         version = version + 1
   where id = v_progress_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDACAO 0009 FALHOU: update pos-conclusao deveria afetar 0 linhas';
  end if;

  update public.user_journeys
     set completed_at = null,
         status = 'ativo',
         version = version + 1
   where id = v_uj;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDACAO 0009 FALHOU: reabertura deveria afetar 0 linhas';
  end if;

  select count(*) into v_progress_count
  from public.user_activity_progress
  where user_journey_id = v_uj;
  if v_progress_count <> 1 then
    raise exception 'VALIDACAO 0009 FALHOU: leitura historica de progresso quebrada (%)', v_progress_count;
  end if;

  select count(*) into v_journey_count
  from public.user_journeys
  where id = v_uj and completed_at is not null;
  if v_journey_count <> 1 then
    raise exception 'VALIDACAO 0009 FALHOU: leitura historica de jornada quebrada';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', v_user_a2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a2::text)::text, true);
  execute 'set local role authenticated';

  select count(*) into v_progress_count
  from public.user_activity_progress
  where user_journey_id = v_uj;
  if v_progress_count <> 0 then
    raise exception 'VALIDACAO 0009 FALHOU: usuario divergente leu progresso alheio';
  end if;

  update public.user_activity_progress
     set progress_percent = 1
   where user_journey_id = v_uj;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'VALIDACAO 0009 FALHOU: usuario divergente atualizou progresso';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', v_user_b1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_b1::text)::text, true);
  execute 'set local role authenticated';

  select count(*) into v_progress_count
  from public.user_activity_progress
  where organization_id = v_org_a;
  if v_progress_count <> 0 then
    raise exception 'VALIDACAO 0009 FALHOU: org divergente leu progresso';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', v_user_a1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a1::text)::text, true);
  execute 'set local role authenticated';

  v_uj := (public.create_or_get_active_user_journey(v_org_a, v_ver_a1, 'ativo')).id;

  begin
    insert into public.user_activity_progress (
      organization_id, user_journey_id, journey_activity_id, progress_percent, status
    ) values (v_org_a, v_uj, v_act_a2, 10, 'em_andamento');
  exception
    when insufficient_privilege then
      v_version_blocked := true;
    when others then
      if sqlstate = '42501' then
        v_version_blocked := true;
      else
        raise;
      end if;
  end;
  if not v_version_blocked then
    raise exception 'VALIDACAO 0009 FALHOU: atividade de outra versao deveria ser rejeitada';
  end if;

  insert into public.user_activity_progress (
    organization_id, user_journey_id, journey_activity_id, progress_percent, status
  ) values (v_org_a, v_uj, v_act_a1, 20, 'em_andamento');

  insert into public.user_activity_progress (
    organization_id, user_journey_id, journey_activity_id, progress_percent, status, version
  ) values (v_org_a, v_uj, v_act_a1, 40, 'em_andamento', 2)
  on conflict (user_journey_id, journey_activity_id)
  do update set progress_percent = excluded.progress_percent,
                status = excluded.status,
                version = public.user_activity_progress.version + 1,
                updated_at = now();

  select count(*) into v_progress_count
  from public.user_activity_progress
  where user_journey_id = v_uj and journey_activity_id = v_act_a1;
  if v_progress_count <> 1 then
    raise exception 'VALIDACAO 0009 FALHOU: idempotencia quebrou (%)', v_progress_count;
  end if;

  execute 'reset role';
  raise notice 'VALIDACAO 0009 OK';
end $$;

commit;
