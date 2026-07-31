-- Validacao executavel SUP-C02 em Postgres descartavel.
-- Premissa: migrations 0001..0013 + harness auth.uid()/authenticated + auth.users.

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
  v_record uuid;
  v_record_b uuid;
  v_sections jsonb := jsonb_build_object(
    'motivo_acompanhamento', jsonb_build_object('value', 'Sono irregular'),
    'avaliacao_profissional_orientativa', jsonb_build_object('value', 'Acompanhamento preventivo'),
    'conduta_orientativa', jsonb_build_object('value', 'Higiene do sono')
  );
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
    (v_org_a, v_uo_asst, v_role_usuario, 'ativo'),
    (v_org_b, v_uo_pro_b_membership, v_role_medico, 'ativo')
  on conflict do nothing;

  insert into public.professional_assignments (
    organization_id, professional_id, user_id, assignment_reason, status
  ) values
    (v_org_a, v_pro_a, v_user_a, 'acompanhamento', 'ativo'),
    (v_org_b, v_pro_a, v_user_b, 'multi-org', 'ativo'),
    (v_org_a, v_asst, v_user_a, 'assignment-sem-papel-clinico', 'ativo');

  delete from public.clinical_record_versions
   where organization_id in (v_org_a, v_org_b);
  delete from public.clinical_records
   where organization_id in (v_org_a, v_org_b);

  -- escrita autorizada: criar rascunho
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';

  if public.can_manage_clinical_record(v_org_a) is not true then
    raise exception 'VALIDACAO 0013 FALHOU: pro_a deveria gerir ficha na org A';
  end if;

  insert into public.clinical_records (
    organization_id, user_id, professional_id, summary, status, version,
    record_status, schema_version, sections, revision_number, authored_by
  ) values (
    v_org_a, v_user_a, v_pro_a, 'Sono irregular', 'ativo', 1,
    'rascunho', 'clinical_record.v1', v_sections, 1, v_pro_a
  ) returning id into v_record;

  select count(*) into v_count from public.clinical_record_versions where clinical_record_id = v_record;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0013 FALHOU: snapshot create ausente';
  end if;

  -- draft save
  update public.clinical_records
     set sections = v_sections || jsonb_build_object('sono', jsonb_build_object('value', '6h')),
         summary = 'Sono irregular',
         authored_by = v_pro_a,
         updated_at = now()
   where id = v_record;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0013 FALHOU: draft save nao atualizou';
  end if;

  -- concluir
  update public.clinical_records
     set record_status = 'concluido',
         concluded_at = now(),
         concluded_by = v_pro_a,
         authored_by = v_pro_a,
         updated_at = now()
   where id = v_record;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0013 FALHOU: conclusao nao atualizou';
  end if;

  select count(*) into v_count
    from public.clinical_record_versions
   where clinical_record_id = v_record and change_kind = 'conclude';
  if v_count < 1 then
    raise exception 'VALIDACAO 0013 FALHOU: snapshot conclude ausente';
  end if;

  -- imutabilidade pos-conclusao
  begin
    update public.clinical_records
       set sections = v_sections || jsonb_build_object('sono', jsonb_build_object('value', 'hack')),
           authored_by = v_pro_a
     where id = v_record;
    raise exception 'VALIDACAO 0013 FALHOU: ficha concluida foi alterada';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate in ('42501', 'P0001') then null; else raise; end if;
  end;

  -- reopen nova revisao
  update public.clinical_records
     set record_status = 'rascunho',
         revision_number = 2,
         concluded_at = null,
         concluded_by = null,
         authored_by = v_pro_a,
         updated_at = now()
   where id = v_record;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'VALIDACAO 0013 FALHOU: reopen nao atualizou';
  end if;

  select count(*) into v_count
    from public.clinical_record_versions
   where clinical_record_id = v_record and change_kind = 'reopen' and revision_number = 2;
  if v_count < 1 then
    raise exception 'VALIDACAO 0013 FALHOU: snapshot reopen ausente';
  end if;

  -- historico consultavel
  select count(*) into v_count from public.clinical_record_versions where clinical_record_id = v_record;
  if v_count < 4 then
    raise exception 'VALIDACAO 0013 FALHOU: historico incompleto (% )', v_count;
  end if;

  -- schema_version invalido
  begin
    update public.clinical_records
       set schema_version = 'invalid',
           authored_by = v_pro_a
     where id = v_record;
    raise exception 'VALIDACAO 0013 FALHOU: schema_version invalido deveria falhar';
  exception
    when check_violation then null;
    when others then
      if sqlstate = '23514' then null; else raise; end if;
  end;

  -- duplicidade ativa
  begin
    insert into public.clinical_records (
      organization_id, user_id, professional_id, summary, status, version,
      record_status, schema_version, sections, revision_number, authored_by
    ) values (
      v_org_a, v_user_a, v_pro_a, 'dup', 'ativo', 1,
      'rascunho', 'clinical_record.v1', '{}'::jsonb, 1, v_pro_a
    );
    raise exception 'VALIDACAO 0013 FALHOU: unique ativo deveria rejeitar duplicata';
  exception
    when unique_violation then null;
    when others then
      if sqlstate = '23505' then null; else raise; end if;
  end;

  -- multi-org: ficha na org B
  insert into public.clinical_records (
    organization_id, user_id, professional_id, summary, status, version,
    record_status, schema_version, sections, revision_number, authored_by
  ) values (
    v_org_b, v_user_b, v_pro_a, 'Org B', 'ativo', 1,
    'rascunho', 'clinical_record.v1', v_sections, 1, v_pro_a
  ) returning id into v_record_b;

  select count(*) into v_count from public.clinical_records where id = v_record_b;
  if v_count <> 1 then
    raise exception 'VALIDACAO 0013 FALHOU: ficha org B nao listavel pelo dono';
  end if;
  execute 'reset role';

  -- profissional B nao ve ficha de A
  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.clinical_records where id = v_record;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0013 FALHOU: pro_b listou ficha de pro_a';
  end if;
  execute 'reset role';

  -- identidade forjada (pro_b tenta escrever como professional_id=pro_a)
  perform set_config('request.jwt.claim.sub', v_pro_b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_b::text)::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.clinical_records (
      organization_id, user_id, professional_id, summary, status, version,
      record_status, schema_version, sections, revision_number, authored_by
    ) values (
      v_org_a, v_user_a, v_pro_a, 'forge', 'ativo', 1,
      'rascunho', 'clinical_record.v1', '{}'::jsonb, 1, v_pro_a
    );
    raise exception 'VALIDACAO 0013 FALHOU: professional_id forjado inseriu';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- gestor institucional negado
  perform set_config('request.jwt.claim.sub', v_mgr::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_mgr::text)::text, true);
  execute 'set local role authenticated';
  if public.can_manage_clinical_record(v_org_a) then
    raise exception 'VALIDACAO 0013 FALHOU: gestor nao deveria gerir ficha';
  end if;
  select count(*) into v_count from public.clinical_records where organization_id = v_org_a;
  if v_count <> 0 then
    raise exception 'VALIDACAO 0013 FALHOU: gestor listou fichas';
  end if;
  execute 'reset role';

  -- membership + assignment sem papel clinico
  perform set_config('request.jwt.claim.sub', v_asst::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_asst::text)::text, true);
  execute 'set local role authenticated';
  if app_auth.has_active_clinical_assignment(v_org_a, v_user_a) then
    raise exception 'VALIDACAO 0013 FALHOU: assistente nao deveria ter assignment clinico efetivo';
  end if;
  begin
    insert into public.clinical_records (
      organization_id, user_id, professional_id, summary, status, version,
      record_status, schema_version, sections, revision_number, authored_by
    ) values (
      v_org_a, v_user_a, v_asst, 'asst', 'ativo', 1,
      'rascunho', 'clinical_record.v1', '{}'::jsonb, 1, v_asst
    );
    raise exception 'VALIDACAO 0013 FALHOU: assistente sem papel clinico inseriu ficha';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  -- DELETE negado (sem grant)
  perform set_config('request.jwt.claim.sub', v_pro_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro_a::text)::text, true);
  execute 'set local role authenticated';
  begin
    delete from public.clinical_records where id = v_record;
    raise exception 'VALIDACAO 0013 FALHOU: DELETE deveria ser negado';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;

  -- INSERT direto em versions negado
  begin
    insert into public.clinical_record_versions (
      clinical_record_id, organization_id, user_id, professional_id,
      schema_version, sections, summary, record_status, revision_number,
      change_kind, authored_by
    ) values (
      v_record, v_org_a, v_user_a, v_pro_a,
      'clinical_record.v1', '{}'::jsonb, 'x', 'rascunho', 1,
      'draft_save', v_pro_a
    );
    raise exception 'VALIDACAO 0013 FALHOU: INSERT em versions deveria ser negado';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlstate = '42501' then null; else raise; end if;
  end;
  execute 'reset role';

  raise notice 'VALIDACAO 0013 OK';
end $$;

commit;
