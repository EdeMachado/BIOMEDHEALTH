-- Validacao executavel SUP-C01.2 em Postgres descartavel.
-- Premissa: migrations 0001..0012 + harness auth.uid()/authenticated + auth.users.

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
  v_appt uuid;
  v_appt_b uuid;
  v_appt_asst uuid;
  v_starts timestamptz := timestamptz '2026-08-01 09:00:00+00';
  v_ends timestamptz := timestamptz '2026-08-01 09:30:00+00';
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_user_a, 'user.a@example.com', '{"full_name":"Paciente A"}'::jsonb),
    (v_user_b, 'user.b@example.com', '{"full_name":"Paciente B"}'::jsonb),
    (v_pro_a, 'pro.a@example.com', '{"full_name":"Medico A"}'::jsonb),
    (v_pro_b, 'pro.b@example.com', '{"full_name":"Medico B"}'::jsonb),
    (v_mgr, 'mgr@example.com', '{"full_name":"Gestor"}'::jsonb),
    (v_asst, 'asst@example.com', '{"full_name":"Assistente sem papel clinico"}'::jsonb)
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
    -- assignment ativo sem papel clinico (apenas usuario)
    (v_org_a, v_uo_asst, v_role_usuario, 'ativo'),
    (v_org_b, v_uo_pro_b_membership, v_role_medico, 'ativo')
  on conflict do nothing;

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  select v_org_b, uo.id, v_role_medico, 'ativo'
  from public.user_organizations uo
  where uo.organization_id = v_org_b and uo.user_id = v_pro_b
    and not exists (
      select 1 from public.user_roles ur
      where ur.user_organization_id = uo.id and ur.role_id = v_role_medico
    );

  insert into public.user_roles (organization_id, user_organization_id, role_id, status)
  select v_org_b, uo.id, v_role_usuario, 'ativo'
  from public.user_organizations uo
  where uo.organization_id = v_org_b and uo.user_id = v_user_b
    and not exists (
      select 1 from public.user_roles ur
      where ur.user_organization_id = uo.id and ur.role_id = v_role_usuario
    );

  delete from public.professional_assignments where organization_id in (v_org_a, v_org_b);
  delete from public.appointments where organization_id in (v_org_a, v_org_b);

  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values
    (v_org_a, v_pro_a, v_user_a, 'acompanhamento', 'ativo'),
    (v_org_b, v_pro_a, v_user_b, 'multi-org', 'ativo'),
    (v_org_a, v_asst, v_user_a, 'assignment-sem-papel-clinico', 'ativo');

  -- escrita autorizada
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  if public.can_manage_clinical_agenda(v_org_a) is not true then
    raise exception 'VALIDACAO 0012 FALHOU: medico deveria gerir agenda org A';
  end if;

  insert into public.appointments (
    organization_id, user_id, professional_id, starts_at, ends_at,
    appointment_status, appointment_type, status
  ) values (
    v_org_a, v_user_a, v_pro_a, v_starts, v_ends,
    'confirmado', 'reavaliacao', 'ativo'
  ) returning id into v_appt;

  select count(*) into v_count from public.appointments where organization_id = v_org_a;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0012 FALHOU: medico deveria ler 1 compromisso, viu %', v_count;
  end if;

  -- atualizacao autorizada
  update public.appointments
     set appointment_status = 'concluido', updated_at = now()
   where id = v_appt;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0012 FALHOU: update autorizado deveria afetar 1 linha';
  end if;

  -- multi-org: agenda org B isolada
  insert into public.appointments (
    organization_id, user_id, professional_id, starts_at, ends_at,
    appointment_status, appointment_type, status
  ) values (
    v_org_b, v_user_b, v_pro_a,
    timestamptz '2026-08-02 11:00:00+00',
    timestamptz '2026-08-02 11:30:00+00',
    'solicitado', 'acompanhamento', 'ativo'
  ) returning id into v_appt_b;

  select count(*) into v_count
    from public.appointments
   where organization_id = v_org_a and id = v_appt_b;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0012 FALHOU: compromisso org B vazou no filtro org A';
  end if;

  -- org arbitraria
  if public.can_manage_clinical_agenda('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) then
    raise exception 'VALIDACAO 0012 FALHOU: org arbitraria nao deveria autorizar';
  end if;

  -- paciente fora da carteira (sem assignment)
  begin
    insert into public.appointments (
      organization_id, user_id, professional_id, starts_at, ends_at,
      appointment_status, appointment_type, status
    ) values (
      v_org_a, v_user_b, v_pro_a,
      timestamptz '2026-08-03 10:00:00+00',
      timestamptz '2026-08-03 10:30:00+00',
      'solicitado', 'preventiva', 'ativo'
    );
    raise exception 'VALIDACAO 0012 FALHOU: paciente fora da carteira deveria falhar';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- professional_id arbitrario (tentativa de escrever como outro)
  begin
    insert into public.appointments (
      organization_id, user_id, professional_id, starts_at, ends_at,
      appointment_status, appointment_type, status
    ) values (
      v_org_a, v_user_a, v_pro_b,
      timestamptz '2026-08-03 12:00:00+00',
      timestamptz '2026-08-03 12:30:00+00',
      'solicitado', 'preventiva', 'ativo'
    );
    raise exception 'VALIDACAO 0012 FALHOU: professional_id arbitrario deveria falhar';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- profissional sem vinculo (pro B na org B sem assignment com user_a)
  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';

  if public.can_manage_clinical_agenda(v_org_b) is not true then
    raise exception 'VALIDACAO 0012 FALHOU: pro B deveria ter papel clinico na org B';
  end if;

  select count(*) into v_count from public.appointments where organization_id = v_org_a;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0012 FALHOU: pro B leu agenda org A';
  end if;

  begin
    insert into public.appointments (
      organization_id, user_id, professional_id, starts_at, ends_at,
      appointment_status, appointment_type, status
    ) values (
      v_org_a, v_user_a, v_pro_b, v_starts + interval '1 day', v_ends + interval '1 day',
      'solicitado', 'acompanhamento', 'ativo'
    );
    raise exception 'VALIDACAO 0012 FALHOU: escrita sem vinculo deveria falhar';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- gestor: leitura/escrita negadas
  perform set_config('request.jwt.claim.sub', v_mgr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr::text)::text, true);
  execute 'set local role authenticated';
  if public.can_manage_clinical_agenda(v_org_a) then
    raise exception 'VALIDACAO 0012 FALHOU: gestor nao deveria gerir agenda';
  end if;
  select count(*) into v_count from public.appointments where organization_id = v_org_a;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0012 FALHOU: gestor leu agenda nominal';
  end if;
  begin
    update public.appointments set appointment_status = 'cancelado' where id = v_appt;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'VALIDACAO 0012 FALHOU: update gestor deveria ser bloqueado';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- update negado por outro profissional
  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';
  begin
    update public.appointments set appointment_status = 'cancelado' where id = v_appt;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'VALIDACAO 0012 FALHOU: update alheio deveria ser bloqueado';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- assignment ativo SEM papel clinico: membership + assignment + auth, sem medico/profissional_saude
  -- prova que has_active_clinical_assignment (e portanto as policies) ja exige o papel clinico
  insert into public.appointments (
    organization_id, user_id, professional_id, starts_at, ends_at,
    appointment_status, appointment_type, status
  ) values (
    v_org_a, v_user_a, v_asst,
    timestamptz '2026-08-04 08:00:00+00',
    timestamptz '2026-08-04 08:30:00+00',
    'solicitado', 'acompanhamento', 'ativo'
  ) returning id into v_appt_asst;

  perform set_config('request.jwt.claim.sub', v_asst::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_asst::text)::text, true);
  execute 'set local role authenticated';

  if public.can_manage_clinical_agenda(v_org_a) then
    raise exception 'VALIDACAO 0012 FALHOU: assistente sem papel clinico nao deveria gerir agenda';
  end if;
  if app_auth.has_active_clinical_assignment(v_org_a, v_user_a) then
    raise exception 'VALIDACAO 0012 FALHOU: has_active_clinical_assignment deveria exigir papel clinico';
  end if;

  select count(*) into v_count from public.appointments where id = v_appt_asst;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0012 FALHOU: assistente sem papel clinico listou compromisso';
  end if;

  begin
    insert into public.appointments (
      organization_id, user_id, professional_id, starts_at, ends_at,
      appointment_status, appointment_type, status
    ) values (
      v_org_a, v_user_a, v_asst,
      timestamptz '2026-08-04 09:00:00+00',
      timestamptz '2026-08-04 09:30:00+00',
      'solicitado', 'preventiva', 'ativo'
    );
    raise exception 'VALIDACAO 0012 FALHOU: assistente sem papel clinico inseriu compromisso';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  begin
    update public.appointments set appointment_status = 'confirmado' where id = v_appt_asst;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'VALIDACAO 0012 FALHOU: assistente sem papel clinico atualizou compromisso';
    end if;
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- rejeicao explicita de appointment_status invalido (CHECK)
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.appointments (
      organization_id, user_id, professional_id, starts_at, ends_at,
      appointment_status, appointment_type, status
    ) values (
      v_org_a, v_user_a, v_pro_a,
      timestamptz '2026-08-05 10:00:00+00',
      timestamptz '2026-08-05 10:30:00+00',
      'agendado', 'acompanhamento', 'ativo'
    );
    raise exception 'VALIDACAO 0012 FALHOU: status invalido deveria ser rejeitado';
  exception
    when check_violation then null;
    when others then
      if sqlstate = '23514' then null; else raise; end if;
  end;

  -- rejeicao explicita de slot ativo duplicado (unique parcial)
  begin
    insert into public.appointments (
      organization_id, user_id, professional_id, starts_at, ends_at,
      appointment_status, appointment_type, status
    ) values (
      v_org_a, v_user_a, v_pro_a, v_starts, v_ends,
      'solicitado', 'acompanhamento', 'ativo'
    );
    raise exception 'VALIDACAO 0012 FALHOU: slot ativo duplicado deveria ser rejeitado';
  exception
    when unique_violation then null;
    when others then
      if sqlstate = '23505' then null; else raise; end if;
  end;
  execute 'reset role';

  -- preservacao 0010/0011
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  if public.can_list_linked_clinical_portfolio(v_org_a) is not true then
    raise exception 'VALIDACAO 0012 FALHOU: 0011 quebrada';
  end if;
  if public.can_access_linked_patient_journey(v_org_a, v_user_a) is not true then
    raise exception 'VALIDACAO 0012 FALHOU: 0010 quebrada';
  end if;
  execute 'reset role';

  raise notice 'VALIDACAO 0012 OK';
end $$;

commit;
