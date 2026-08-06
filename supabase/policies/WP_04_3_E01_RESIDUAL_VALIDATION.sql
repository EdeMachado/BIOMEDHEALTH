-- WP-04.3 E01 residual validation (structural + behavioral).
-- No new migration required for this WP (0022 already enforces append-only / corr / PHI).
-- Prefer local disposable DB after `supabase db reset`.
-- Fixtures cleaned; residual count must be 0.

-- F/G/H/M/N/O style checks reuse 0022 guarantees
do $$
begin
  if has_function_privilege('anon', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE')
     or has_function_privilege('public', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'WP-04.3 B/C failed: register_audit_event executable by PUBLIC/anon';
  end if;

  if not has_function_privilege('authenticated', 'public.register_audit_event(uuid, text, text, text, text, text, text, text)', 'EXECUTE') then
    raise exception 'WP-04.3 failed: authenticated missing EXECUTE';
  end if;

  if has_table_privilege('authenticated', 'public.audit_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_events', 'DELETE') then
    raise exception 'WP-04.3 M/N/O failed: authenticated has write on audit_events';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_events' and column_name = 'correlation_id'
  ) then
    raise exception 'WP-04.3 I failed: correlation_id missing';
  end if;
end;
$$;

-- Behavioral: authenticated audit with provenance + care-plan-like codes; PHI rejected
do $$
declare
  org1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa53';
  org2 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa54';
  actor_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb53';
  cross_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb54';
  uo_actor uuid := 'ffffffff-ffff-ffff-ffff-ffffffffff53';
  uo_cross uuid := 'ffffffff-ffff-ffff-ffff-ffffffffff54';
  audit_id uuid;
  corr_seen text;
  reason_seen text;
  denied boolean;
begin
  delete from public.audit_events where organization_id in (org1, org2);
  delete from public.user_organizations where id in (uo_actor, uo_cross);
  delete from public.organizations where id in (org1, org2);

  insert into public.organizations (id, name, status)
  values (org1, 'TMP Org1 0043', 'ativo'), (org2, 'TMP Org2 0043', 'ativo');

  insert into public.user_organizations (id, organization_id, user_id, status)
  values
    (uo_actor, org1, actor_id, 'ativo'),
    (uo_cross, org2, cross_id, 'ativo');

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  -- K) distinct care-plan action codes accepted
  select public.register_audit_event(
    org1, 'medico', 'care_plan_action_status_changed', 'care_plan_action', 'act-1', 'web', 'sucesso',
    'code=care_plan_action_status_changed|src=clinical|corr=wp043carestatus01|provenance=application|next_status=em_andamento'
  ) into audit_id;

  perform public.register_audit_event(
    org1, 'medico', 'care_plan_suspended', 'care_plan', 'plan-1', 'web', 'sucesso',
    'code=care_plan_suspended|src=clinical|corr=wp043caresuspend01|previous_status=open|next_status=suspended'
  );

  perform public.register_audit_event(
    org1, 'usuario', 'lgpd_capability_unavailable', 'lgpd', null, 'web', 'negado',
    'code=lgpd_capability_unavailable|src=lgpd|corr=wp043lgpdunavail01|provenance=application_precheck_denied|request_kind=export'
  );

  perform public.register_audit_event(
    org1, 'gestor_institucional', 'repository_error', 'campaign', null, 'web', 'falha',
    'code=repository_error|src=collective|corr=wp043rlsinfer0001|provenance=database_rls_denied_inferred|error_code=CROSS_TENANT_DATA'
  );

  reset role;

  if audit_id is null then
    raise exception 'WP-04.3 K failed: care_plan_action_status_changed not persisted';
  end if;

  select correlation_id, reason into corr_seen, reason_seen
  from public.audit_events where id = audit_id;

  if corr_seen is distinct from 'wp043carestatus01' then
    raise exception 'WP-04.3 I failed: correlation mismatch';
  end if;
  if reason_seen ~* '(diagnost|anota|prontuario|cpf|senha|password|token)' then
    raise exception 'WP-04.3 L/D failed: sensitive marker in reason';
  end if;

  -- D) PHI rejected
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
      org1, 'medico', 'care_plan_note_added', 'care_plan', null, 'web', 'sucesso',
      'code=care_plan_note_added|corr=wp043phiblock0001|anotacao=hipertensao'
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
    raise exception 'WP-04.3 D/L failed: PHI-like reason should be rejected';
  end if;

  -- Q) cleanup
  delete from public.audit_events where organization_id in (org1, org2);
  delete from public.user_organizations where id in (uo_actor, uo_cross);
  delete from public.organizations where id in (org1, org2);

  if exists (select 1 from public.organizations where id in (org1, org2))
     or exists (select 1 from public.audit_events where organization_id in (org1, org2)) then
    raise exception 'WP-04.3 Q failed: residual fixtures remain';
  end if;

  raise notice 'WP-04.3 validation PASS (structural + behavioral; A/E covered by app tests; R via prior WP scripts)';
end;
$$;
