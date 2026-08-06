-- WP-04.2 Trust & Audit validation (A–R).
-- Prefer local disposable DB after `supabase db reset`.
-- Fixtures cleaned; residual count must be 0.
-- Does not claim transactional RLS-deny audit atomicity.

-- Structural: grants / EXECUTE / RLS force / deny policies
do $$
begin
  if has_function_privilege('anon', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE')
     or has_function_privilege('public', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'WP-04.2 F/G failed: register_audit_event executable by PUBLIC/anon';
  end if;

  if not has_function_privilege('authenticated', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'WP-04.2 H failed: authenticated missing register_audit_event EXECUTE';
  end if;

  if has_table_privilege('authenticated', 'public.audit_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_events', 'DELETE') then
    raise exception 'WP-04.2 I/J/K failed: authenticated has write privilege on audit_events';
  end if;

  if not has_table_privilege('authenticated', 'public.audit_events', 'SELECT') then
    raise exception 'WP-04.2 failed: authenticated missing SELECT on audit_events';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_events' and policyname = 'audit_events_deny_update'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_events' and policyname = 'audit_events_deny_delete'
  ) then
    raise exception 'WP-04.2 failed: append-only deny policies missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'audit_events'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then
    raise exception 'WP-04.2 failed: audit_events RLS not forced';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_events' and column_name = 'correlation_id'
  ) then
    raise exception 'WP-04.2 M failed: correlation_id column missing';
  end if;
end;
$$;

-- Behavioral A–E, L–Q
do $$
declare
  org1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa42';
  org2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa43';
  actor_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb42';
  cross_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb43';
  uo_actor uuid := 'ffffffff-ffff-ffff-ffff-ffffffffff42';
  uo_cross uuid := 'ffffffff-ffff-ffff-ffff-ffffffffff43';
  audit_id uuid;
  audit_id2 uuid;
  actor_seen uuid;
  org_seen uuid;
  corr_seen text;
  reason_seen text;
  result_seen text;
  denied boolean;
  upd_count integer;
  del_count integer;
  ins_ok boolean;
begin
  delete from public.audit_events where organization_id in (org1, org2);
  delete from public.user_organizations where id in (uo_actor, uo_cross);
  delete from public.organizations where id in (org1, org2);

  insert into public.organizations (id, name, status)
  values (org1, 'TMP Org1 0022', 'ativo'), (org2, 'TMP Org2 0022', 'ativo');

  insert into public.user_organizations (id, organization_id, user_id, status)
  values
    (uo_actor, org1, actor_id, 'ativo'),
    (uo_cross, org2, cross_id, 'ativo');

  -- A/B) authorized collective success + actor = auth.uid()
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select public.register_audit_event(
    org1,
    'gestor_institucional',
    'campaign_created',
    'campaign',
    'camp-wp042-1',
    'web',
    'sucesso',
    'code=campaign_created|src=collective|corr=wp042corrabcd1234'
  ) into audit_id;
  reset role;

  if audit_id is null then
    raise exception 'WP-04.2 A failed: authorized event not persisted';
  end if;

  select actor_user_id, organization_id, correlation_id, reason, result
    into actor_seen, org_seen, corr_seen, reason_seen, result_seen
  from public.audit_events where id = audit_id;

  if actor_seen is distinct from actor_id then
    raise exception 'WP-04.2 B failed: actor mismatch';
  end if;
  if org_seen is distinct from org1 then
    raise exception 'WP-04.2 C failed: organization mismatch';
  end if;
  if corr_seen is distinct from 'wp042corrabcd1234' then
    raise exception 'WP-04.2 M failed: correlation_id not stored (% )', corr_seen;
  end if;
  if result_seen is distinct from 'sucesso' then
    raise exception 'WP-04.2 L failed: expected sucesso';
  end if;

  -- C/D) cross-org rejected (cannot forge organizationId)
  denied := false;
  perform set_config('request.jwt.claim.sub', cross_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', cross_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    perform public.register_audit_event(
      org1, 'gestor_institucional', 'campaign_created', 'campaign', null, 'web', 'sucesso',
      'code=campaign_created|corr=wp042crossdeny01'
    );
  exception
    when insufficient_privilege then
      denied := true;
    when others then
      if sqlstate = '42501' then
        denied := true;
      else
        raise;
      end if;
  end;
  reset role;
  if not denied then
    raise exception 'WP-04.2 C/D failed: cross-org audit should be rejected';
  end if;

  -- E/P) prohibited metadata rejected
  denied := false;
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    perform public.register_audit_event(
      org1, 'gestor_institucional', 'campaign_created', 'campaign', null, 'web', 'sucesso',
      'code=campaign_created|corr=wp042phiblock01|diagnostico=hipertensao'
    );
  exception
    when others then
      if sqlstate = '22023' then
        denied := true;
      else
        raise;
      end if;
  end;
  reset role;
  if not denied then
    raise exception 'WP-04.2 E/P failed: PHI-like reason should be rejected';
  end if;

  -- L) denied + error results accepted
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  select public.register_audit_event(
    org1, 'gestor_institucional', 'permission_denied', 'campaign', null, 'web', 'negado',
    'code=permission_denied|src=collective|corr=wp042deniedabcd01'
  ) into audit_id2;
  perform public.register_audit_event(
    org1, 'gestor_institucional', 'repository_error', 'action_plan', null, 'web', 'falha',
    'code=repository_error|error_code=NOT_FOUND|corr=wp042errorabcd01'
  );
  reset role;
  if audit_id2 is null then
    raise exception 'WP-04.2 L failed: denied event not persisted';
  end if;

  -- M) missing correlation rejected
  denied := false;
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    perform public.register_audit_event(
      org1, 'gestor_institucional', 'campaign_created', 'campaign', null, 'web', 'sucesso',
      'code=campaign_created'
    );
  exception
    when others then
      if sqlstate = '22023' then
        denied := true;
      else
        raise;
      end if;
  end;
  reset role;
  if not denied then
    raise exception 'WP-04.2 M failed: missing correlation should be rejected';
  end if;

  -- I) authenticated cannot UPDATE audit row
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    update public.audit_events set reason = 'tampered' where id = audit_id;
    get diagnostics upd_count = row_count;
  exception
    when insufficient_privilege then
      upd_count := -1;
    when others then
      upd_count := -1;
  end;
  reset role;
  if upd_count > 0 then
    raise exception 'WP-04.2 I failed: authenticated updated audit_events';
  end if;
  if exists (select 1 from public.audit_events where id = audit_id and reason = 'tampered') then
    raise exception 'WP-04.2 I failed: audit reason was tampered';
  end if;

  -- J) authenticated cannot DELETE
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    delete from public.audit_events where id = audit_id;
    get diagnostics del_count = row_count;
  exception
    when insufficient_privilege then
      del_count := -1;
    when others then
      del_count := -1;
  end;
  reset role;
  if del_count > 0 then
    raise exception 'WP-04.2 J failed: authenticated deleted audit_events';
  end if;
  if not exists (select 1 from public.audit_events where id = audit_id) then
    raise exception 'WP-04.2 J failed: audit row missing after delete attempt';
  end if;

  -- K) authenticated cannot INSERT directly
  ins_ok := false;
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    insert into public.audit_events (
      organization_id, actor_user_id, actor_role, action, entity, origin, result, reason, status, version
    ) values (
      org1, actor_id, 'gestor_institucional', 'campaign_created', 'campaign', 'web', 'sucesso',
      'code=x|corr=directinsert01', 'ativo', 1
    );
    ins_ok := true;
  exception
    when insufficient_privilege then
      ins_ok := false;
    when others then
      ins_ok := false;
  end;
  reset role;
  if ins_ok then
    raise exception 'WP-04.2 K failed: direct INSERT into audit_events succeeded';
  end if;

  -- N) exactly one final success event for campaign_created in this fixture set
  if (
    select count(*) from public.audit_events
    where organization_id = org1 and action = 'campaign_created' and result = 'sucesso'
  ) <> 1 then
    raise exception 'WP-04.2 N failed: expected exactly one campaign_created success';
  end if;

  -- Q) cleanup + residual check
  delete from public.audit_events where organization_id in (org1, org2);
  delete from public.user_organizations where id in (uo_actor, uo_cross);
  delete from public.organizations where id in (org1, org2);

  if exists (select 1 from public.organizations where id in (org1, org2))
     or exists (select 1 from public.user_organizations where id in (uo_actor, uo_cross))
     or exists (select 1 from public.audit_events where organization_id in (org1, org2)) then
    raise exception 'WP-04.2 Q failed: residual fixtures remain';
  end if;

  raise notice 'WP-04.2 validation PASS (A–Q structural/behavioral; O/R covered by app tests + prior WP scripts)';
end;
$$;
