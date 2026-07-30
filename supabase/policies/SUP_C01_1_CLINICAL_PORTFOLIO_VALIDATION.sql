-- Validacao executavel SUP-C01.1 em Postgres descartavel.
-- Premissa: migrations 0001..0011 + harness auth.uid()/authenticated + auth.users.

begin;

do $$
declare
  v_org_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_org_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_user_a uuid := '11111111-1111-1111-1111-111111111111';
  v_user_b uuid := '22222222-2222-2222-2222-222222222222';
  v_pro_a uuid := '12121212-1212-1212-1212-121212121212';
  v_pro_a2 uuid := '15151515-1515-1515-1515-151515151515';
  v_pro_b uuid := '13131313-1313-1313-1313-131313131313';
  v_mgr uuid := '14141414-1414-1414-1414-141414141414';
  v_role_usuario uuid;
  v_role_medico uuid;
  v_role_prof uuid;
  v_role_gestor uuid;
  v_uo_user uuid;
  v_uo_pro uuid;
  v_uo_pro2 uuid;
  v_uo_mgr uuid;
  v_count int;
  v_rows int;
  v_hj uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_ver uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
  v_uj uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_user_a, 'user.a@example.com', '{"full_name":"Paciente A"}'::jsonb),
    (v_user_b, 'user.b@example.com', '{"full_name":"Paciente B"}'::jsonb),
    (v_pro_a, 'pro.a@example.com', '{"full_name":"Medico A"}'::jsonb),
    (v_pro_a2, 'prof.a@example.com', '{"full_name":"Prof Saude A"}'::jsonb),
    (v_pro_b, 'pro.b@example.com', '{"full_name":"Medico B"}'::jsonb),
    (v_mgr, 'mgr@example.com', '{"full_name":"Gestor"}'::jsonb)
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
    ('profissional_saude', 'Profissional', 'ativo'),
    ('gestor_institucional', 'Gestor', 'ativo')
  on conflict (code) do nothing;

  select id into v_role_usuario from public.roles where code = 'usuario';
  select id into v_role_medico from public.roles where code = 'medico';
  select id into v_role_prof from public.roles where code = 'profissional_saude';
  select id into v_role_gestor from public.roles where code = 'gestor_institucional';

  insert into public.user_organizations (organization_id, user_id, status)
  values
    (v_org_a, v_user_a, 'ativo'),
    (v_org_a, v_pro_a, 'ativo'),
    (v_org_a, v_pro_a2, 'ativo'),
    (v_org_a, v_mgr, 'ativo'),
    (v_org_b, v_user_b, 'ativo'),
    (v_org_b, v_pro_b, 'ativo')
  on conflict (organization_id, user_id) do nothing;

  select id into v_uo_user from public.user_organizations where organization_id = v_org_a and user_id = v_user_a;
  select id into v_uo_pro from public.user_organizations where organization_id = v_org_a and user_id = v_pro_a;
  select id into v_uo_pro2 from public.user_organizations where organization_id = v_org_a and user_id = v_pro_a2;
  select id into v_uo_mgr from public.user_organizations where organization_id = v_org_a and user_id = v_mgr;

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  values
    (v_org_a, v_uo_user, v_role_usuario, 'ativo'),
    (v_org_a, v_uo_pro, v_role_medico, 'ativo'),
    (v_org_a, v_uo_pro2, v_role_prof, 'ativo'),
    (v_org_a, v_uo_mgr, v_role_gestor, 'ativo')
  on conflict do nothing;

  insert into public.user_organizations (organization_id, user_id, status)
  select v_org_b, v_pro_b, 'ativo'
  where not exists (
    select 1 from public.user_organizations where organization_id = v_org_b and user_id = v_pro_b
  );
  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  select v_org_b, uo.id, v_role_medico, 'ativo'
  from public.user_organizations uo
  where uo.organization_id = v_org_b and uo.user_id = v_pro_b
    and not exists (
      select 1 from public.user_roles ur
      where ur.user_organization_id = uo.id and ur.role_id = v_role_medico
    );

  delete from public.professional_assignments
  where organization_id in (v_org_a, v_org_b);

  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values
    (v_org_a, v_pro_a, v_user_a, 'acompanhamento', 'ativo'),
    (v_org_a, v_pro_a2, v_user_a, 'acompanhamento', 'ativo');

  -- medico vinculado ve paciente
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  if public.can_list_linked_clinical_portfolio() is not true then
    raise exception 'VALIDACAO 0011 FALHOU: medico deveria listar carteira';
  end if;
  select count(*) into v_count from public.list_linked_clinical_patients();
  if v_count <> 1 then
    raise exception 'VALIDACAO 0011 FALHOU: medico deveria ver 1 paciente, viu %', v_count;
  end if;
  if not exists (
    select 1 from public.list_linked_clinical_patients()
    where patient_user_id = v_user_a and organization_id = v_org_a and display_name = 'Paciente A'
  ) then
    raise exception 'VALIDACAO 0011 FALHOU: dados minimos do paciente incorretos';
  end if;
  execute 'reset role';

  -- profissional_saude vinculado ve paciente
  perform set_config('request.jwt.claim.sub', v_pro_a2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a2::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.list_linked_clinical_patients();
  if v_count <> 1 then
    raise exception 'VALIDACAO 0011 FALHOU: profissional_saude deveria ver 1 paciente';
  end if;
  execute 'reset role';

  -- sem vinculo
  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';
  if public.can_list_linked_clinical_portfolio() is not true then
    raise exception 'VALIDACAO 0011 FALHOU: medico org B deveria poder listar (papel clinico)';
  end if;
  select count(*) into v_count from public.list_linked_clinical_patients();
  if v_count <> 0 then
    raise exception 'VALIDACAO 0011 FALHOU: carteira vazia autorizada esperada para pro B';
  end if;
  -- cross-tenant: paciente org A nao aparece
  if exists (select 1 from public.list_linked_clinical_patients() where patient_user_id = v_user_a) then
    raise exception 'VALIDACAO 0011 FALHOU: cross-tenant vazou paciente A';
  end if;
  execute 'reset role';

  -- vinculo inativo
  update public.professional_assignments
     set status = 'inativo'
   where professional_id = v_pro_a and user_id = v_user_a;
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.list_linked_clinical_patients();
  if v_count <> 0 then
    raise exception 'VALIDACAO 0011 FALHOU: vinculo inativo nao deveria listar';
  end if;
  execute 'reset role';
  update public.professional_assignments
     set status = 'ativo'
   where professional_id = v_pro_a and user_id = v_user_a;

  -- profissional nao ve carteira de outro (pro_a2 nao ve assignment exclusivo se removido)
  delete from public.professional_assignments where professional_id = v_pro_a2;
  perform set_config('request.jwt.claim.sub', v_pro_a2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a2::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.list_linked_clinical_patients();
  if v_count <> 0 then
    raise exception 'VALIDACAO 0011 FALHOU: profissional sem assignment proprio nao deveria ver carteira alheia';
  end if;
  execute 'reset role';
  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values (v_org_a, v_pro_a2, v_user_a, 'acompanhamento', 'ativo');

  -- gestor sem papel clinico
  perform set_config('request.jwt.claim.sub', v_mgr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr::text)::text, true);
  execute 'set local role authenticated';
  if public.can_list_linked_clinical_portfolio() then
    raise exception 'VALIDACAO 0011 FALHOU: gestor nao deveria listar carteira';
  end if;
  select count(*) into v_count from public.list_linked_clinical_patients();
  if v_count <> 0 then
    raise exception 'VALIDACAO 0011 FALHOU: gestor obteve linhas nominais';
  end if;
  execute 'reset role';

  -- usuario comum
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a::text)::text, true);
  execute 'set local role authenticated';
  if public.can_list_linked_clinical_portfolio() then
    raise exception 'VALIDACAO 0011 FALHOU: usuario comum nao deveria listar carteira';
  end if;
  select count(*) into v_count from public.list_linked_clinical_patients();
  if v_count <> 0 then
    raise exception 'VALIDACAO 0011 FALHOU: usuario comum obteve carteira';
  end if;
  execute 'reset role';

  -- catalogo inserido como superuser; titular cria jornada sob authenticated
  insert into public.health_journeys (
    id, organization_id, name, description, target_audience, duration_weeks, technical_owner, status
  ) values (v_hj, v_org_a, 'Jornada A', 'd', 'a', 8, 't', 'ativo')
  on conflict (id) do nothing;
  insert into public.journey_versions (id, organization_id, journey_id, code, status, version)
  values (v_ver, v_org_a, v_hj, 'a-v1', 'ativo', 1)
  on conflict (id) do nothing;

  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a::text)::text, true);
  execute 'set local role authenticated';
  v_uj := (public.create_or_get_active_user_journey(v_org_a, v_ver, 'ativo')).id;
  execute 'reset role';

  -- escrita clinica continua bloqueada
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.user_journeys (
      organization_id, user_id, journey_version_id, status
    ) values (v_org_a, v_user_a, v_ver, 'ativo');
    raise exception 'VALIDACAO 0011 FALHOU: insert clinico deveria falhar';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  begin
    update public.user_journeys set status = 'concluida', completed_at = now() where id = v_uj;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'VALIDACAO 0011 FALHOU: update clinico deveria ser bloqueado';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  begin
    delete from public.user_journeys where id = v_uj;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'VALIDACAO 0011 FALHOU: delete clinico deveria ser bloqueado';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- 0010 leitura clinica continua
  if public.can_access_linked_patient_journey(v_org_a, v_user_a) is not true then
    raise exception 'VALIDACAO 0011 FALHOU: leitura 0010 quebrada';
  end if;
  select count(*) into v_count from public.user_journeys where id = v_uj;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0011 FALHOU: select clinico 0010 quebrado';
  end if;
  execute 'reset role';

  raise notice 'VALIDACAO 0011 OK';
end $$;

commit;
