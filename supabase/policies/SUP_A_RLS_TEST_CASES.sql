-- Casos de teste SQL para SUP-A01/SUP-A03 (deny-by-default e isolamento de tenant).
-- Executar somente em ambiente local isolado com Supabase/psql configurado.
-- Este arquivo define cenarios de validacao esperada; nao deve usar dados reais.

-- 1) Sessao ausente -> negacao
-- expect: select * from organizations; => erro/0 linhas por RLS

-- 2) Usuario sem vinculo ativo -> negacao dados institucionais
-- expect: sem linha em user_organizations para auth.uid()
-- expect: select * from organizations; => 0 linhas

-- 3) Vinculo organizacao A nao acessa organizacao B
-- expect: usuario com vinculo ativo em org-A
-- expect: select * from organizations where id = 'org-B'::uuid; => 0 linhas

-- 4) Unidade indevida bloqueada em user_roles/user_profiles
-- expect: tentativa insert user_roles com unit_id de outra organization => excecao trigger

-- 5) Papel insuficiente bloqueado para administracao de vinculos
-- expect: usuario papel `usuario` tentar insert em user_roles => negado

-- 6) Multiplos papeis validos reconhecidos por vinculos persistidos
-- expect: usuario com dois papeis ativos em user_roles, mesmo tenant => ambas consultas permitidas conforme policy

-- 7) Alteracao do proprio papel bloqueada
-- expect: admin tentando update user_roles cujo user_organization_id pertence ao proprio auth.uid() => negado
--
-- SQL executavel (requer ambiente de teste com IDs ficticios semeados):
set role app_user;
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);

do $$
declare
  v_rows integer;
  v_role_code text;
begin
  update public.user_roles
     set role_id = '30000000-0000-0000-0000-000000000002'
   where id = '80000000-0000-0000-0000-000000000001';

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    raise exception
      'Self role update should fail, but % row(s) were updated',
      v_rows;
  end if;

  select r.code
    into v_role_code
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where ur.id = '80000000-0000-0000-0000-000000000001';

  if v_role_code is distinct from 'admin_cliente' then
    raise exception
      'Self role update should preserve admin_cliente, got %',
      coalesce(v_role_code, '<null>');
  end if;
end;
$$;

reset role;

-- 8) Alteracao do proprio vinculo/perfil bloqueada
-- expect: admin tentando update/delete em user_organizations/user_profiles do proprio auth.uid() => negado

-- 9) Operacao legitima dentro do tenant permitida
-- expect: admin_cliente/admin_biomed com vinculo ativo no tenant consegue CRUD autorizado em user_organizations/user_roles

-- Suite complementar positiva/negativa com rastreio de cenarios
-- A tabela permanece TEMP e existe apenas nesta sessao.
create temp table if not exists rls_test_results (
  scenario text primary key,
  status text not null,
  details text not null
);

grant insert, select on table rls_test_results to app_user;
truncate table rls_test_results;

set role app_user;

do $$
declare
  v_row_security text;
begin
  select current_setting('row_security') into v_row_security;
  if v_row_security is distinct from 'on' then
    raise exception 'row_security must be on, got %', coalesce(v_row_security, '<null>');
  end if;
  insert into rls_test_results values ('row_security_on', 'PASS', format('row_security=%s', v_row_security));
end;
$$;

-- 1) ausencia de sessao
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '', false);
do $$
declare
  v_org_count integer;
begin
  select count(*) into v_org_count from public.organizations;
  if v_org_count <> 0 then
    raise exception 'Sessao ausente deveria ver 0 organizacoes, viu %', v_org_count;
  end if;
  insert into rls_test_results values ('ausencia_sessao', 'PASS', format('organizations=%s', v_org_count));
end;
$$;

-- 2) usuario autenticado sem vinculo
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000009999', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_org_count integer;
  v_link_count integer;
begin
  select count(*) into v_org_count from public.organizations;
  select count(*) into v_link_count from public.user_organizations;
  if v_org_count <> 0 or v_link_count <> 0 then
    raise exception 'Usuario sem vinculo deveria ver 0/0, viu org=% link=%', v_org_count, v_link_count;
  end if;
  insert into rls_test_results values ('usuario_sem_vinculo', 'PASS', format('organizations=%s links=%s', v_org_count, v_link_count));
end;
$$;

-- 3) isolamento entre organizacoes
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_total integer;
  v_org_b integer;
begin
  select count(*) into v_total from public.organizations;
  select count(*) into v_org_b from public.organizations where id = '10000000-0000-0000-0000-000000000002';
  if v_total <> 1 or v_org_b <> 0 then
    raise exception 'Isolamento de org falhou: total=% org_b=%', v_total, v_org_b;
  end if;
  insert into rls_test_results values ('isolamento_organizacoes', 'PASS', format('total=%s org_b=%s', v_total, v_org_b));
end;
$$;

-- 4) isolamento entre unidades
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
begin
  begin
    insert into public.user_roles (id, organization_id, user_organization_id, role_id, unit_id, status)
    values (
      '80000000-0000-0000-0000-000000000098',
      '10000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      'ativo'
    );
    raise exception 'Insercao em unidade fora do escopo deveria falhar';
  exception
    when insufficient_privilege then
      null;
  end;
  insert into rls_test_results values ('isolamento_unidades', 'PASS', 'insert cross-unit bloqueado');
end;
$$;

-- 5) papel insuficiente
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
begin
  begin
    insert into public.user_organizations (id, organization_id, user_id, status)
    values (
      '60000000-0000-0000-0000-000000000098',
      '10000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000098',
      'ativo'
    );
    raise exception 'Papel insuficiente deveria falhar ao inserir vinculo';
  exception
    when insufficient_privilege then
      null;
  end;
  insert into rls_test_results values ('papel_insuficiente', 'PASS', 'insert administrativo bloqueado');
end;
$$;

-- 6) multiplos papeis cumulativos
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000003', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_medico_or_auditor boolean;
  v_usuario boolean;
begin
  select app_auth.has_active_role('10000000-0000-0000-0000-000000000001'::uuid, array['auditor', 'medico'], null) into v_medico_or_auditor;
  select app_auth.has_active_role('10000000-0000-0000-0000-000000000001'::uuid, array['usuario'], null) into v_usuario;
  if v_medico_or_auditor is distinct from true or v_usuario is distinct from true then
    raise exception 'Multiplos papeis nao reconhecidos: medico_or_auditor=% usuario=%', v_medico_or_auditor, v_usuario;
  end if;
  insert into rls_test_results values ('multiplos_papeis_cumulativos', 'PASS', format('medico_or_auditor=%s usuario=%s', v_medico_or_auditor, v_usuario));
end;
$$;

-- 7) bloqueio de autoelevacao (confirmacao de estado apos teste dedicado)
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_role_code text;
begin
  select r.code
    into v_role_code
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where ur.id = '80000000-0000-0000-0000-000000000001';

  if v_role_code is distinct from 'admin_cliente' then
    raise exception 'Papel proprio nao deveria ser alterado, valor atual=%', coalesce(v_role_code, '<null>');
  end if;
  insert into rls_test_results values ('bloqueio_autoelevacao', 'PASS', format('role=%s', v_role_code));
end;
$$;

-- 8) bloqueio de atualizacao do proprio vinculo
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_rows integer;
  v_status text;
begin
  update public.user_organizations
     set status = 'inativo'
   where id = '60000000-0000-0000-0000-000000000001';

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'Atualizacao do proprio vinculo deveria falhar, rows=%', v_rows;
  end if;

  select status into v_status
  from public.user_organizations
  where id = '60000000-0000-0000-0000-000000000001';

  if v_status is distinct from 'ativo' then
    raise exception 'Status do proprio vinculo foi alterado para %', coalesce(v_status, '<null>');
  end if;
  insert into rls_test_results values ('bloqueio_update_proprio_vinculo', 'PASS', format('rows_updated=%s status=%s', v_rows, v_status));
end;
$$;

-- 9) bloqueio de exclusao do proprio vinculo
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_rows integer;
  v_remaining integer;
begin
  delete from public.user_organizations
   where id = '60000000-0000-0000-0000-000000000001';

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'Exclusao do proprio vinculo deveria falhar, rows=%', v_rows;
  end if;

  select count(*) into v_remaining
  from public.user_organizations
  where id = '60000000-0000-0000-0000-000000000001';

  if v_remaining <> 1 then
    raise exception 'Linha do proprio vinculo deveria permanecer, count=%', v_remaining;
  end if;
  insert into rls_test_results values ('bloqueio_delete_proprio_vinculo', 'PASS', format('rows_deleted=%s remaining=%s', v_rows, v_remaining));
end;
$$;

-- 10) bloqueio de transformar vinculo alheio em proprio
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_rows integer := 0;
  v_original_user_id uuid;
  v_persisted_user_id uuid;
  v_blocked boolean := false;
  v_block_mode text := 'none';
begin
  select user_id into v_original_user_id
  from public.user_organizations
  where id = '60000000-0000-0000-0000-000000000003';

  begin
    update public.user_organizations
       set user_id = '70000000-0000-0000-0000-000000000001'
     where id = '60000000-0000-0000-0000-000000000003';

    get diagnostics v_rows = row_count;
    v_blocked := (v_rows = 0);
    if v_blocked then
      v_block_mode := 'UPDATE_0';
    end if;
  exception
    when insufficient_privilege then
      v_blocked := true;
      v_block_mode := 'SQLSTATE_42501';
  end;

  if not v_blocked then
    raise exception 'Scenario 10 failed: prohibited update affected % row(s)', v_rows;
  end if;

  select user_id into v_persisted_user_id
  from public.user_organizations
  where id = '60000000-0000-0000-0000-000000000003';

  if v_persisted_user_id is distinct from v_original_user_id then
    raise exception 'Scenario 10 failed: user_id changed from % to %', v_original_user_id, v_persisted_user_id;
  end if;

  insert into rls_test_results values (
    'bloqueio_transformar_alheio_em_proprio',
    'PASS',
    format(
      'block_mode=%s rows=%s user_id_before=%s user_id_after=%s',
      v_block_mode,
      v_rows,
      v_original_user_id,
      v_persisted_user_id
    )
  );
end;
$$;

-- 11) acesso administrativo legitimo sobre outros usuarios
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_ins integer;
  v_upd integer;
  v_del integer;
begin
  insert into public.user_organizations (id, organization_id, user_id, status)
  values (
    '60000000-0000-0000-0000-000000000097',
    '10000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000097',
    'ativo'
  );
  get diagnostics v_ins = row_count;

  update public.user_organizations
     set status = 'inativo'
   where id = '60000000-0000-0000-0000-000000000097';
  get diagnostics v_upd = row_count;

  delete from public.user_organizations
   where id = '60000000-0000-0000-0000-000000000097';
  get diagnostics v_del = row_count;

  if v_ins <> 1 or v_upd <> 1 or v_del <> 1 then
    raise exception 'CRUD administrativo esperado 1/1/1, obtido %/%/%', v_ins, v_upd, v_del;
  end if;
  insert into rls_test_results values ('acesso_admin_legitimo_outros', 'PASS', format('ins=%s upd=%s del=%s', v_ins, v_upd, v_del));
end;
$$;

-- 12) acesso legitimo dentro do tenant
select set_config('request.jwt.claim.sub', '70000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"app.organization_id":"10000000-0000-0000-0000-000000000001"}', false);
do $$
declare
  v_org_count integer;
  v_link_count integer;
begin
  select count(*) into v_org_count from public.organizations;
  select count(*) into v_link_count from public.user_organizations;
  if v_org_count <> 1 or v_link_count < 3 then
    raise exception 'Acesso legitimo no tenant esperava org=1 e links>=3, obteve org=% links=%', v_org_count, v_link_count;
  end if;
  insert into rls_test_results values ('acesso_legitimo_tenant', 'PASS', format('organizations=%s links=%s', v_org_count, v_link_count));
end;
$$;

reset role;

select scenario, status, details
from rls_test_results
order by scenario;
