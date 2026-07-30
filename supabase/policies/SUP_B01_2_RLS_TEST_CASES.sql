-- SUP-B01.2 SQL test cases (single-session + manual concurrency playbooks)
-- Scope: authenticated titular with active org link.
-- Out of scope: clinical/manager roles, RPC.

begin;

create temp table if not exists sup_b01_2_results (
  scenario text primary key,
  status text not null,
  details text not null
);
grant select, insert, update, delete on table sup_b01_2_results to public;
truncate table sup_b01_2_results;

create or replace function pg_temp.record_pass(p_scenario text, p_details text)
returns void
language plpgsql
as $$
begin
  insert into sup_b01_2_results(scenario, status, details)
  values (p_scenario, 'PASS', p_details);
end;
$$;

create or replace function pg_temp.expect_failure(
  p_scenario text,
  p_sql text,
  p_expected_states text[],
  p_expected_mechanisms text[] default null,
  p_expected_msg_fragments text[] default null
)
returns void
language plpgsql
as $$
declare
  v_operation_failed boolean := false;
  v_state text := null;
  v_msg text := null;
  v_mech text := null;
  v_msg_matches boolean := false;
  v_fragment text;
begin
  begin
    execute p_sql;
  exception
    when others then
      v_operation_failed := true;
      v_state := sqlstate;
      v_msg := sqlerrm;
  end;

  if not v_operation_failed then
    raise exception
      'SCENARIO %: operation unexpectedly succeeded.',
      p_scenario;
  end if;

  if not (v_state = any(p_expected_states)) then
    raise exception
      'SCENARIO %: unexpected SQLSTATE expected=% got=% msg=%',
      p_scenario,
      array_to_string(p_expected_states, ','),
      coalesce(v_state, '<null>'),
      coalesce(v_msg, '<null>');
  end if;

  if p_expected_msg_fragments is not null then
    foreach v_fragment in array p_expected_msg_fragments loop
      if position(lower(v_fragment) in lower(coalesce(v_msg, ''))) > 0 then
        v_msg_matches := true;
        exit;
      end if;
    end loop;
    if not v_msg_matches then
      raise exception
        'SCENARIO %: unexpected message fragments=% msg=%',
        p_scenario,
        array_to_string(p_expected_msg_fragments, ','),
        coalesce(v_msg, '<null>');
    end if;
  end if;

  if v_state = '42501' then
    if position('row-level security' in lower(coalesce(v_msg, ''))) > 0 then
      v_mech := 'rls';
    else
      v_mech := 'privilegio';
    end if;
  elsif v_state = '23505' then
    v_mech := 'indice_unico';
  elsif v_state = '23514' then
    v_mech := 'constraint_check';
  elsif v_state = 'P0001' then
    if position('sup-b01.1:' in lower(coalesce(v_msg, ''))) > 0
       or position('sup-b01.2:' in lower(coalesce(v_msg, ''))) > 0
       or position('delete em user_consents e proibido' in lower(coalesce(v_msg, ''))) > 0 then
      v_mech := 'trigger';
    else
      v_mech := 'raise_exception';
    end if;
  else
    v_mech := 'sqlstate_' || v_state;
  end if;

  if p_expected_mechanisms is not null and not (v_mech = any(p_expected_mechanisms)) then
    raise exception
      'SCENARIO %: unexpected mechanism expected=% got=% state=% msg=%',
      p_scenario,
      array_to_string(p_expected_mechanisms, ','),
      v_mech,
      v_state,
      v_msg;
  end if;

  perform pg_temp.record_pass(p_scenario, format('state=%s mechanism=%s msg=%s', v_state, v_mech, coalesce(v_msg, '<null>')));
end;
$$;

-- Schema/FK prechecks
do $$
declare
  v_roles_ok integer;
  v_fk_user_org boolean;
  v_fk_doc_org boolean;
begin
  select count(*) into v_roles_ok from pg_roles where rolname in ('anon', 'authenticated');
  if v_roles_ok < 2 then
    raise exception 'roles anon/authenticated missing';
  end if;

  select exists (
    select 1 from pg_constraint
    where conname = 'user_consents_user_org_fk'
      and conrelid = 'public.user_consents'::regclass
  ) into v_fk_user_org;
  if not v_fk_user_org then
    raise exception 'user_consents_user_org_fk missing';
  end if;

  select exists (
    select 1 from pg_constraint
    where conname = 'user_consents_document_org_fk'
      and conrelid = 'public.user_consents'::regclass
  ) into v_fk_doc_org;
  if not v_fk_doc_org then
    raise exception 'user_consents_document_org_fk missing';
  end if;

  perform pg_temp.record_pass(
    '00_precheck',
    format('roles_ok=%s fk_user_org=%s fk_doc_org=%s auth_users_table=%s', v_roles_ok, v_fk_user_org, v_fk_doc_org, to_regclass('auth.users') is not null)
  );
end;
$$;

-- Fixtures
insert into public.organizations(id,name,status) values
('10000000-0000-0000-0000-000000000001','Org A','ativo'),
('10000000-0000-0000-0000-000000000002','Org B','ativo');

insert into public.user_organizations(id,organization_id,user_id,status) values
('81000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','ativo'),
('81000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','ativo'),
('81000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000003','ativo'),
('81000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000004','inativo');

insert into public.consent_documents(id,organization_id,title,legal_basis,purpose,document_version,status,code,content_hash,effective_at,expires_at) values
('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','eligible','consent','A','1.0.0','ativo','doc-eligible','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',transaction_timestamp()-interval '5 days',transaction_timestamp()+interval '5 days'),
('90000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','no-exp','consent','B','1.0.0','ativo','doc-no-exp','sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',transaction_timestamp()-interval '5 days',null),
('90000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','future','consent','C','1.0.0','ativo','doc-future','sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',transaction_timestamp()+interval '1 day',transaction_timestamp()+interval '10 days'),
('90000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','expired','consent','D','1.0.0','ativo','doc-expired','sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',transaction_timestamp()-interval '10 days',transaction_timestamp()-interval '1 second'),
('90000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','inactive','consent','E','1.0.0','inativo','doc-inactive','sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',transaction_timestamp()-interval '5 days',transaction_timestamp()+interval '5 days'),
('90000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002','other-tenant','consent','F','1.0.0','ativo','doc-other-tenant','sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',transaction_timestamp()-interval '5 days',transaction_timestamp()+interval '5 days'),
('90000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','hist-self','consent','G','1.0.0','ativo','doc-hist-self','sha256:1111111111111111111111111111111111111111111111111111111111111111',transaction_timestamp()-interval '20 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','hist-third','consent','H','1.0.0','ativo','doc-hist-third','sha256:2222222222222222222222222222222222222222222222222222222222222222',transaction_timestamp()-interval '20 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','exp-eq-now','consent','I','1.0.0','ativo','doc-exp-eq-now','sha256:3333333333333333333333333333333333333333333333333333333333333333',transaction_timestamp()-interval '1 day',transaction_timestamp()),
('90000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','insert-valid','consent','J','1.0.0','ativo','doc-insert-valid','sha256:4444444444444444444444444444444444444444444444444444444444444444',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','reaccept','consent','K','1.0.0','ativo','doc-reaccept','sha256:5555555555555555555555555555555555555555555555555555555555555555',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','revoke','consent','L','1.0.0','ativo','doc-revoke','sha256:6666666666666666666666666666666666666666666666666666666666666666',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000001','canon-id','consent','CI','1.0.0','ativo','doc-canon-id','sha256:7777777777777777777777777777777777777777777777777777777777777777',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000001','canon-accepted','consent','CA','1.0.0','ativo','doc-canon-accepted','sha256:8888888888888888888888888888888888888888888888888888888888888888',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000023','10000000-0000-0000-0000-000000000001','canon-version','consent','CV','1.0.0','ativo','doc-canon-version','sha256:9999999999999999999999999999999999999999999999999999999999999999',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000024','10000000-0000-0000-0000-000000000001','canon-created','consent','CC','1.0.0','ativo','doc-canon-created','sha256:1010101010101010101010101010101010101010101010101010101010101010',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000025','10000000-0000-0000-0000-000000000001','canon-updated','consent','CU','1.0.0','ativo','doc-canon-updated','sha256:1111111111111111111111111111111111111111111111111111111111111122',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000026','10000000-0000-0000-0000-000000000001','canon-revoked-at','consent','CR1','1.0.0','ativo','doc-canon-revoked-at','sha256:1212121212121212121212121212121212121212121212121212121212121212',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000027','10000000-0000-0000-0000-000000000001','canon-revoked-src','consent','CR2','1.0.0','ativo','doc-canon-revoked-src','sha256:1313131313131313131313131313131313131313131313131313131313131313',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000028','10000000-0000-0000-0000-000000000001','canon-revoked-rsn','consent','CR3','1.0.0','ativo','doc-canon-revoked-rsn','sha256:1414141414141414141414141414141414141414141414141414141414141414',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000001','concurrency-c1','consent','C1','1.0.0','ativo','doc-concurrency-c1','sha256:1515151515151515151515151515151515151515151515151515151515151515',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000032','10000000-0000-0000-0000-000000000001','concurrency-c2a','consent','C2A','1.0.0','ativo','doc-concurrency-c2a','sha256:1616161616161616161616161616161616161616161616161616161616161616',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days'),
('90000000-0000-0000-0000-000000000033','10000000-0000-0000-0000-000000000001','concurrency-c2b','consent','C2B','1.0.0','ativo','doc-concurrency-c2b','sha256:1717171717171717171717171717171717171717171717171717171717171717',transaction_timestamp()-interval '2 days',transaction_timestamp()+interval '20 days');

insert into public.user_consents(id,organization_id,user_id,consent_document_id,source) values
('92000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','web'),
('92000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000008','web'),
('92000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000006','web'),
('92000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000007','web'),
('92000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001','web'),
('92000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000012','web');

update public.consent_documents
set status='inativo', expires_at=transaction_timestamp()-interval '1 hour'
where id in ('90000000-0000-0000-0000-000000000007','90000000-0000-0000-0000-000000000008');

-- Core scenarios 1..26
set role anon;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claims','',false);
select pg_temp.expect_failure('01_anon_sem_acesso','select count(*) from public.user_consents',array['42501'],array['privilegio']);

reset role; set role authenticated;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claims','{}',false);
do $$declare v_uid uuid; v_count int; begin
  select auth.uid() into v_uid; if v_uid is not null then raise exception '02 auth.uid should be null'; end if;
  select count(*) into v_count from public.user_consents; if v_count<>0 then raise exception '02 rows=%',v_count; end if;
  perform pg_temp.record_pass('02_auth_sem_sessao_valida',format('uid=%s rows=%s',coalesce(v_uid::text,'<null>'),v_count));
end$$;

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000099',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
do $$declare v_count int; begin
  select count(*) into v_count from public.user_consents; if v_count<>0 then raise exception '03 rows=%',v_count; end if;
  perform pg_temp.record_pass('03_auth_sem_vinculo_select',format('rows=%s',v_count));
end$$;
select pg_temp.expect_failure('03_auth_sem_vinculo_insert',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000099','90000000-0000-0000-0000-000000000010','web')$sql$,array['42501'],array['rls']);

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000004',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
do $$declare v_active boolean; v_count int; begin
  select app_auth.has_active_org_link('10000000-0000-0000-0000-000000000001'::uuid) into v_active;
  if v_active then raise exception '04 expected inactive link'; end if;
  select count(*) into v_count from public.user_consents; if v_count<>0 then raise exception '04 rows=%',v_count; end if;
  perform pg_temp.record_pass('04_vinculo_inativo_select',format('active=%s rows=%s',v_active,v_count));
end$$;
select pg_temp.expect_failure('04_vinculo_inativo_insert',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000004','90000000-0000-0000-0000-000000000010','web')$sql$,array['42501'],array['rls']);

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
do $$declare v_count int; begin
  select count(*) into v_count from public.user_consents where user_id='70000000-0000-0000-0000-000000000001'::uuid;
  if v_count<1 then raise exception '05 rows=%',v_count; end if;
  perform pg_temp.record_pass('05_titular_select_proprio',format('rows=%s',v_count));
end$$;

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
do $$declare v_count int; begin
  select count(*) into v_count from public.user_consents where id='92000000-0000-0000-0000-000000000001'::uuid;
  if v_count<>0 then raise exception '06 rows=%',v_count; end if;
  perform pg_temp.record_pass('06_terceiro_mesmo_tenant_bloqueado',format('rows=%s',v_count));
end$$;

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
do $$declare v_c int; v_d int; begin
  select count(*) into v_c from public.user_consents where organization_id='10000000-0000-0000-0000-000000000002'::uuid;
  select count(*) into v_d from public.consent_documents where organization_id='10000000-0000-0000-0000-000000000002'::uuid;
  if v_c<>0 or v_d<>0 then raise exception '07 consents=% docs=%',v_c,v_d; end if;
  perform pg_temp.record_pass('07_cross_tenant',format('consents=%s docs=%s',v_c,v_d));
end$$;

do $$declare v_id uuid; begin
  insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000010','web') returning id into v_id;
  if v_id is null then raise exception '08 no id'; end if;
  perform pg_temp.record_pass('08_insert_proprio_valido',format('id=%s',v_id));
end$$;

select pg_temp.expect_failure('09_insert_terceiro',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000010','web')$sql$,array['42501'],array['rls']);
select pg_temp.expect_failure('10_documento_outro_tenant',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000006','web')$sql$,array['P0001','42501'],array['trigger','rls'],array['organization_id do aceite','row-level security']);
select pg_temp.expect_failure('11_status_inelegivel',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000005','web')$sql$,array['P0001','42501'],array['trigger','rls'],array['nao e elegivel','row-level security']);
select pg_temp.expect_failure('12_effective_at_futuro',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003','web')$sql$,array['P0001','42501'],array['trigger','rls'],array['ainda nao vigente','row-level security']);
select pg_temp.expect_failure('13_expires_at_passado',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000004','web')$sql$,array['P0001','42501'],array['trigger','rls'],array['expirado','row-level security']);
select pg_temp.expect_failure('14_expires_at_igual_instante',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000009','web')$sql$,array['P0001','42501'],array['trigger','rls'],array['expirado','row-level security']);

do $$declare v_id uuid; begin
  insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','web') returning id into v_id;
  if v_id is null then raise exception '15 no id'; end if;
  perform pg_temp.record_pass('15_sem_expires_at',format('id=%s',v_id));
end$$;

select pg_temp.expect_failure('16_duplicidade_ativa',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000010','web')$sql$,array['23505'],array['indice_unico']);

do $$declare v_old_id uuid; v_old_ver int; v_new_id uuid; v_active int; v_total int; begin
  insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000011','web') returning id,version into v_old_id,v_old_ver;
  update public.user_consents set revoked_at=transaction_timestamp(),revoked_source='web',revoked_reason='reaccept',version=v_old_ver+1,updated_at=transaction_timestamp() where id=v_old_id;
  insert into public.user_consents(organization_id,user_id,consent_document_id,source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000011','web') returning id into v_new_id;
  select count(*) into v_active from public.user_consents where organization_id='10000000-0000-0000-0000-000000000001'::uuid and user_id='70000000-0000-0000-0000-000000000001'::uuid and consent_document_id='90000000-0000-0000-0000-000000000011'::uuid and revoked_at is null;
  select count(*) into v_total from public.user_consents where organization_id='10000000-0000-0000-0000-000000000001'::uuid and user_id='70000000-0000-0000-0000-000000000001'::uuid and consent_document_id='90000000-0000-0000-0000-000000000011'::uuid;
  if v_active<>1 or v_total<>2 then raise exception '17 active=% total=%',v_active,v_total; end if;
  perform pg_temp.record_pass('17_novo_aceite_pos_revogacao',format('revoked=%s new=%s active=%s total=%s',v_old_id,v_new_id,v_active,v_total));
end$$;

do $$declare v_target uuid; v_old_source text; v_new_source text; begin
  select id,source into v_target,v_old_source from public.user_consents where organization_id='10000000-0000-0000-0000-000000000001'::uuid and user_id='70000000-0000-0000-0000-000000000001'::uuid and consent_document_id='90000000-0000-0000-0000-000000000010'::uuid and revoked_at is null limit 1;
  if v_target is null then raise exception '18 precondition missing'; end if;
  perform pg_temp.expect_failure('18_update_coluna_nao_autorizada',format('update public.user_consents set source=''api'' where id=''%s''::uuid',v_target),array['42501'],array['privilegio']);
  select source into v_new_source from public.user_consents where id=v_target;
  if v_new_source is distinct from v_old_source then raise exception '18 changed old=% new=%',v_old_source,v_new_source; end if;
end$$;

do $$declare v_target uuid; v_old_ver int; v_rev timestamptz; begin
  select id,version into v_target,v_old_ver from public.user_consents where id='92000000-0000-0000-0000-000000000006'::uuid and revoked_at is null;
  if v_target is null then raise exception '19 precondition missing'; end if;
  update public.user_consents set revoked_at=transaction_timestamp(),revoked_source='web',revoked_reason='valid revoke',version=v_old_ver+1,updated_at=transaction_timestamp() where id=v_target;
  select revoked_at into v_rev from public.user_consents where id=v_target;
  if v_rev is null then raise exception '19 revoke missing'; end if;
  perform pg_temp.record_pass('19_revogacao_valida',format('id=%s revoked_at=%s',v_target,v_rev));
end$$;

do $$declare v_target uuid; begin
  select id into v_target from public.user_consents where id='92000000-0000-0000-0000-000000000006'::uuid and revoked_at is not null;
  if v_target is null then raise exception '20 precondition missing'; end if;
  perform pg_temp.expect_failure('20_segunda_revogacao',format('update public.user_consents set revoked_reason=''again'',version=version+1,updated_at=transaction_timestamp() where id=''%s''::uuid',v_target),array['P0001'],array['trigger'],array['apos revogacao']);
end$$;

do $$declare v_target uuid; begin
  select id into v_target from public.user_consents where id='92000000-0000-0000-0000-000000000006'::uuid and revoked_at is not null;
  if v_target is null then raise exception '21 precondition missing'; end if;
  perform pg_temp.expect_failure('21_desfazer_revogacao',format('update public.user_consents set revoked_at=null,revoked_source=null,version=version+1,updated_at=transaction_timestamp() where id=''%s''::uuid',v_target),array['P0001'],array['trigger'],array['apos revogacao']);
end$$;

do $$declare v_exists int; begin
  select count(*) into v_exists from public.user_consents where id='92000000-0000-0000-0000-000000000001'::uuid;
  if v_exists<>1 then raise exception '22 precondition missing'; end if;
  perform pg_temp.expect_failure('22_delete_negado',$sql$delete from public.user_consents where id='92000000-0000-0000-0000-000000000001'::uuid$sql$,array['42501'],array['privilegio']);
  select count(*) into v_exists from public.user_consents where id='92000000-0000-0000-0000-000000000001'::uuid;
  if v_exists<>1 then raise exception '22 row deleted'; end if;
end$$;

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
do $$declare v_count int; begin
  select count(*) into v_count from public.consent_documents where id='90000000-0000-0000-0000-000000000007'::uuid and (status<>'ativo' or (expires_at is not null and expires_at<=transaction_timestamp()));
  if v_count<1 then raise exception '23 rows=%',v_count; end if;
  perform pg_temp.record_pass('23_documento_historico_proprio',format('rows=%s',v_count));
end$$;

reset role;
do $$declare v_fixture int; begin
  select count(*) into v_fixture from public.user_consents where user_id='70000000-0000-0000-0000-000000000002'::uuid and consent_document_id='90000000-0000-0000-0000-000000000008'::uuid;
  if v_fixture<1 then raise exception '24 fixture missing'; end if;
end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
do $$declare v_count int; begin
  select count(*) into v_count from public.consent_documents where id='90000000-0000-0000-0000-000000000008'::uuid;
  if v_count<>0 then raise exception '24 rows=%',v_count; end if;
  perform pg_temp.record_pass('24_historico_terceiro_bloqueado',format('rows=%s',v_count));
end$$;

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
do $$declare v_own int; v_other int; begin
  select count(*) into v_own from public.user_consents where user_id='70000000-0000-0000-0000-000000000002'::uuid;
  select count(*) into v_other from public.user_consents where user_id='70000000-0000-0000-0000-000000000001'::uuid;
  if v_own<1 or v_other<>0 then raise exception '25 own=% other=%',v_own,v_other; end if;
  perform pg_temp.record_pass('25_regressao_policy_antiga',format('own=%s other=%s',v_own,v_other));
end$$;

do $$declare v_c int; v_d int; begin
  select count(*) into v_c from public.user_consents where organization_id='10000000-0000-0000-0000-000000000002'::uuid;
  select count(*) into v_d from public.consent_documents where organization_id='10000000-0000-0000-0000-000000000002'::uuid;
  if v_c<>0 or v_d<>0 then raise exception '26 consents=% docs=%',v_c,v_d; end if;
  perform pg_temp.record_pass('26_regressao_isolamento_tenant',format('consents=%s docs=%s',v_c,v_d));
end$$;

-- Canonical insert tests (column privilege hardening)
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"app.organization_id":"10000000-0000-0000-0000-000000000001"}',false);
select pg_temp.expect_failure('27_insert_id_bloqueado',$sql$insert into public.user_consents(id,organization_id,user_id,consent_document_id,source) values ('93000000-0000-0000-0000-000000000027','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000021','web')$sql$,array['42501'],array['privilegio']);
select pg_temp.expect_failure('28_insert_accepted_at_bloqueado',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source,accepted_at) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000022','web',transaction_timestamp())$sql$,array['42501'],array['privilegio']);
select pg_temp.expect_failure('29_insert_version_bloqueado',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source,version) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000023','web',7)$sql$,array['42501'],array['privilegio']);
select pg_temp.expect_failure('30_insert_created_at_bloqueado',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source,created_at) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000024','web',transaction_timestamp())$sql$,array['42501'],array['privilegio']);
select pg_temp.expect_failure('31_insert_updated_at_bloqueado',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source,updated_at) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000025','web',transaction_timestamp())$sql$,array['42501'],array['privilegio']);
select pg_temp.expect_failure('32_insert_revoked_at_bloqueado',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source,revoked_at) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000026','web',transaction_timestamp())$sql$,array['42501'],array['privilegio']);
select pg_temp.expect_failure('33_insert_revoked_source_bloqueado',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source,revoked_source) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000027','web','web')$sql$,array['42501'],array['privilegio']);
select pg_temp.expect_failure('34_insert_revoked_reason_bloqueado',$sql$insert into public.user_consents(organization_id,user_id,consent_document_id,source,revoked_reason) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000028','web','x')$sql$,array['42501'],array['privilegio']);

do $$declare v_cnt int; begin
  select count(*) into v_cnt from public.user_consents where consent_document_id in (
    '90000000-0000-0000-0000-000000000021'::uuid,'90000000-0000-0000-0000-000000000022'::uuid,
    '90000000-0000-0000-0000-000000000023'::uuid,'90000000-0000-0000-0000-000000000024'::uuid,
    '90000000-0000-0000-0000-000000000025'::uuid,'90000000-0000-0000-0000-000000000026'::uuid,
    '90000000-0000-0000-0000-000000000027'::uuid,'90000000-0000-0000-0000-000000000028'::uuid
  );
  if v_cnt<>0 then raise exception 'canonical insert should create zero rows, got=%',v_cnt; end if;
  perform pg_temp.record_pass('35_insert_canonico_sem_linhas',format('rows=%s',v_cnt));
end$$;

reset role;

select scenario,status,details from sup_b01_2_results order by scenario;

-- MANUAL CONCURRENCY PLAYBOOKS (two real sessions; NOT auto-executed)
-- IMPORTANTE: estas rotinas sao independentes da transacao principal desta suite.
-- Rode cada roteiro em ambiente administrativo separado, com preparacao COMMITADA
-- antes de abrir as duas sessoes concorrentes.
--
-- C1) Dois INSERTs simultaneos para o mesmo trio (org,user,documento)
-- Preparacao administrativa C1 (sessao admin separada):
--   begin;
--   insert into public.organizations (id, name, status)
--   values ('11000000-0000-0000-0000-000000000031', 'Org Concurrency C1', 'ativo')
--   on conflict (id) do nothing;
--   insert into public.user_organizations (id, organization_id, user_id, status)
--   values ('81100000-0000-0000-0000-000000000031', '11000000-0000-0000-0000-000000000031', '71000000-0000-0000-0000-000000000031', 'ativo')
--   on conflict (organization_id, user_id) do update set status = excluded.status;
--   insert into public.consent_documents (id, organization_id, title, legal_basis, purpose, document_version, status, code, content_hash, effective_at, expires_at)
--   values ('91000000-0000-0000-0000-000000000031', '11000000-0000-0000-0000-000000000031', 'Doc C1', 'consentimento', 'concorrencia c1', '1.0.0', 'ativo', 'doc-c1', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa31', transaction_timestamp() - interval '1 day', transaction_timestamp() + interval '7 days')
--   on conflict (id) do nothing;
--   commit;
--
-- Sessao A
--   begin;
--   set role authenticated;
--   select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000031', false);
--   select set_config('request.jwt.claims', '{"app.organization_id":"11000000-0000-0000-0000-000000000031"}', false);
--   insert into public.user_consents (organization_id, user_id, consent_document_id, source)
--   values ('11000000-0000-0000-0000-000000000031', '71000000-0000-0000-0000-000000000031', '91000000-0000-0000-0000-000000000031', 'web');
--   -- manter a transacao aberta sem commit
--
-- Sessao B (enquanto A permanece aberta)
--   begin;
--   set role authenticated;
--   select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000031', false);
--   select set_config('request.jwt.claims', '{"app.organization_id":"11000000-0000-0000-0000-000000000031"}', false);
--   insert into public.user_consents (organization_id, user_id, consent_document_id, source)
--   values ('11000000-0000-0000-0000-000000000031', '71000000-0000-0000-0000-000000000031', '91000000-0000-0000-0000-000000000031', 'web');
--   -- esperado: bloqueia enquanto a Sessao A estiver aberta
--
-- Desfecho C1-A (Sessao A faz COMMIT)
--   -- Sessao A
--   commit;
--   -- Sessao B destrava e deve falhar com unique_violation (SQLSTATE 23505)
--   rollback;
--
-- Desfecho C1-B (Sessao A faz ROLLBACK)
--   -- repetir C1 desde o inicio em base limpa para doc ...031
--   -- Sessao A
--   rollback;
--   -- Sessao B destrava e pode concluir com sucesso
--   commit;
--
-- Verificacao administrativa final (fora de role authenticated)
--   reset role;
--   select count(*) as active_count
--   from public.user_consents
--   where organization_id = '11000000-0000-0000-0000-000000000031'::uuid
--     and user_id = '71000000-0000-0000-0000-000000000031'::uuid
--     and consent_document_id = '91000000-0000-0000-0000-000000000031'::uuid
--     and revoked_at is null;
--   -- esperado final: exatamente 1 aceite nao revogado
-- Limpeza administrativa C1:
--   begin;
--   delete from public.user_consents where organization_id = '11000000-0000-0000-0000-000000000031'::uuid;
--   delete from public.consent_documents where id = '91000000-0000-0000-0000-000000000031'::uuid;
--   delete from public.user_organizations where organization_id = '11000000-0000-0000-0000-000000000031'::uuid and user_id = '71000000-0000-0000-0000-000000000031'::uuid;
--   delete from public.organizations where id = '11000000-0000-0000-0000-000000000031'::uuid;
--   commit;
--
-- C2-A) UPDATE do documento obtem lock primeiro
-- Preparacao administrativa C2-A:
--   begin;
--   insert into public.organizations (id, name, status)
--   values ('11000000-0000-0000-0000-000000000032', 'Org Concurrency C2A', 'ativo')
--   on conflict (id) do nothing;
--   insert into public.user_organizations (id, organization_id, user_id, status)
--   values ('81100000-0000-0000-0000-000000000032', '11000000-0000-0000-0000-000000000032', '71000000-0000-0000-0000-000000000032', 'ativo')
--   on conflict (organization_id, user_id) do update set status = excluded.status;
--   insert into public.consent_documents (id, organization_id, title, legal_basis, purpose, document_version, status, code, content_hash, effective_at, expires_at)
--   values ('91000000-0000-0000-0000-000000000032', '11000000-0000-0000-0000-000000000032', 'Doc C2A', 'consentimento', 'concorrencia c2a', '1.0.0', 'ativo', 'doc-c2a', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa32', transaction_timestamp() - interval '1 day', transaction_timestamp() + interval '7 days')
--   on conflict (id) do nothing;
--   commit;
--
-- Sessao A
--   begin;
--   update public.consent_documents
--      set status = 'inativo'
--    where id = '91000000-0000-0000-0000-000000000032'::uuid;
--   -- manter aberta sem commit para reter lock da linha
--
-- Sessao B (enquanto A aberta)
--   begin;
--   set role authenticated;
--   select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000032', false);
--   select set_config('request.jwt.claims', '{"app.organization_id":"11000000-0000-0000-0000-000000000032"}', false);
--   insert into public.user_consents (organization_id, user_id, consent_document_id, source)
--   values ('11000000-0000-0000-0000-000000000032', '71000000-0000-0000-0000-000000000032', '91000000-0000-0000-0000-000000000032', 'web');
--   -- esperado: bloqueia no SELECT ... FOR UPDATE do trigger
--
-- Fechamento C2-A
--   -- Sessao A
--   commit;
--   -- Sessao B destrava e deve falhar por inelegibilidade do documento (trigger P0001; eventualmente 42501 conforme caminho da policy)
--   rollback;
--
-- Verificacao administrativa final C2-A
--   reset role;
--   select status
--   from public.consent_documents
--   where id = '91000000-0000-0000-0000-000000000032'::uuid;
--   -- esperado: status = 'inativo'
--   select count(*) as consent_count
--   from public.user_consents
--   where organization_id = '11000000-0000-0000-0000-000000000032'::uuid
--     and user_id = '71000000-0000-0000-0000-000000000032'::uuid
--     and consent_document_id = '91000000-0000-0000-0000-000000000032'::uuid;
--   -- esperado: 0 linhas para a fixture C2-A
-- Limpeza administrativa C2-A:
--   begin;
--   delete from public.user_consents where organization_id = '11000000-0000-0000-0000-000000000032'::uuid;
--   delete from public.consent_documents where id = '91000000-0000-0000-0000-000000000032'::uuid;
--   delete from public.user_organizations where organization_id = '11000000-0000-0000-0000-000000000032'::uuid and user_id = '71000000-0000-0000-0000-000000000032'::uuid;
--   delete from public.organizations where id = '11000000-0000-0000-0000-000000000032'::uuid;
--   commit;
--
-- C2-B) INSERT obtem lock primeiro (concorrencia real)
-- Preparacao administrativa C2-B:
--   begin;
--   insert into public.organizations (id, name, status)
--   values ('11000000-0000-0000-0000-000000000033', 'Org Concurrency C2B', 'ativo')
--   on conflict (id) do nothing;
--   insert into public.user_organizations (id, organization_id, user_id, status)
--   values ('81100000-0000-0000-0000-000000000033', '11000000-0000-0000-0000-000000000033', '71000000-0000-0000-0000-000000000033', 'ativo')
--   on conflict (organization_id, user_id) do update set status = excluded.status;
--   insert into public.consent_documents (id, organization_id, title, legal_basis, purpose, document_version, status, code, content_hash, effective_at, expires_at)
--   values ('91000000-0000-0000-0000-000000000033', '11000000-0000-0000-0000-000000000033', 'Doc C2B', 'consentimento', 'concorrencia c2b', '1.0.0', 'ativo', 'doc-c2b', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa33', transaction_timestamp() - interval '1 day', transaction_timestamp() + interval '7 days')
--   on conflict (id) do nothing;
--   commit;
--
-- Sessao A
--   begin;
--   set role authenticated;
--   select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000033', false);
--   select set_config('request.jwt.claims', '{"app.organization_id":"11000000-0000-0000-0000-000000000033"}', false);
--   insert into public.user_consents (organization_id, user_id, consent_document_id, source)
--   values ('11000000-0000-0000-0000-000000000033', '71000000-0000-0000-0000-000000000033', '91000000-0000-0000-0000-000000000033', 'web');
--   -- manter aberta sem commit
--
-- Sessao B (iniciada ANTES do commit da A)
--   begin;
--   update public.consent_documents
--      set status = 'inativo'
--    where id = '91000000-0000-0000-0000-000000000033'::uuid;
--   -- esperado: UPDATE bloqueia enquanto a Sessao A estiver aberta
--
-- Fechamento C2-B
--   -- Sessao A
--   commit;
--   -- Sessao B destrava, conclui o UPDATE e faz commit
--   commit;
--
-- Verificacao administrativa final C2-B
--   reset role;
--   select status
--   from public.consent_documents
--   where id = '91000000-0000-0000-0000-000000000033'::uuid;
--   -- esperado: status = 'inativo'
--   select count(*) as consent_total,
--          count(*) filter (where revoked_at is null) as consent_active
--   from public.user_consents
--   where organization_id = '11000000-0000-0000-0000-000000000033'::uuid
--     and user_id = '71000000-0000-0000-0000-000000000033'::uuid
--     and consent_document_id = '91000000-0000-0000-0000-000000000033'::uuid;
--   -- esperado: consent_total = 1 e consent_active = 1 (nao apagado e nao revogado)
--
-- Verificacao de leitura historica pelo titular (apos inativacao do doc)
--   set role authenticated;
--   select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000033', false);
--   select set_config('request.jwt.claims', '{"app.organization_id":"11000000-0000-0000-0000-000000000033"}', false);
--   select count(*) as history_visible
--   from public.consent_documents
--   where id = '91000000-0000-0000-0000-000000000033'::uuid;
--   -- esperado: history_visible = 1 (documento legivel historicamente pelo titular)
--   reset role;
-- Limpeza administrativa C2-B:
--   begin;
--   delete from public.user_consents where organization_id = '11000000-0000-0000-0000-000000000033'::uuid;
--   delete from public.consent_documents where id = '91000000-0000-0000-0000-000000000033'::uuid;
--   delete from public.user_organizations where organization_id = '11000000-0000-0000-0000-000000000033'::uuid and user_id = '71000000-0000-0000-0000-000000000033'::uuid;
--   delete from public.organizations where id = '11000000-0000-0000-0000-000000000033'::uuid;
--   commit;

rollback;
