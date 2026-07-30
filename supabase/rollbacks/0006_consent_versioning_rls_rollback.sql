-- Rollback manual SUP-B01.2
-- Estrategia conservadora:
-- - validar estruturalmente todos os objetos da 0006 antes de qualquer DROP;
-- - abortar em ausencia/divergencia/identidade nao comprovada;
-- - nao ampliar privilegios alem do baseline estaticamente comprovado.

begin;

do $$
declare
  v_authenticated_oid oid;
  v_anon_oid oid;

  v_fn_oid oid;
  v_fn_prosrc text;
  v_fn_search_path_ok boolean;
  v_fn_exec_public boolean;
  v_fn_exec_anon boolean;
  v_fn_exec_authenticated boolean;

  v_trigger_oid oid;
  v_trigger_tgtype int2;
  v_trigger_tgenabled "char";
  v_trigger_tgfoid oid;

  v_idx_oid oid;
  v_idx_indrelid oid;
  v_idx_indisunique boolean;
  v_idx_indnkeyatts int2;
  v_idx_indnatts int2;
  v_idx_indexprs pg_node_tree;
  v_idx_indpred pg_node_tree;
  v_idx_method text;
  v_idx_col_order text[];
  v_idx_pred_expr text;
  v_idx_pred_norm text;
  v_idx_pred_expected_norm text;

  v_pol_oid oid;
  v_pol_cmd "char";
  v_pol_permissive boolean;
  v_pol_roles oid[];
  v_pol_qual pg_node_tree;
  v_pol_check pg_node_tree;
  v_pol_qual_expr text;
  v_pol_check_expr text;
  v_pol_qual_norm text;
  v_pol_check_norm text;

  v_exp_uc_select_qual_norm text;
  v_exp_uc_insert_check_norm text;
  v_exp_uc_update_qual_norm text;
  v_exp_uc_update_check_norm text;
  v_exp_cd_select_eligible_qual_norm text;
  v_exp_cd_select_history_qual_norm text;

  v_old_policy_oid oid;
  v_old_policy_cmd "char";
  v_old_policy_permissive boolean;
  v_old_policy_roles oid[];
  v_old_policy_qual pg_node_tree;
  v_old_policy_withcheck pg_node_tree;
  v_old_policy_qual_expr text;
  v_old_policy_qual_norm text;
  v_old_policy_expected_norm text;
begin
  select oid into v_authenticated_oid from pg_roles where rolname = 'authenticated';
  if v_authenticated_oid is null then
    raise exception 'Rollback 0006 bloqueado: role authenticated ausente.';
  end if;
  select oid into v_anon_oid from pg_roles where rolname = 'anon';

  -- Policy legada: estado esperado apos 0006 e ausencia.
  -- Se existir, deve ser exatamente a definicao baseline antiga.
  select p.oid, p.polcmd, p.polpermissive, p.polroles, p.polqual, p.polwithcheck
    into v_old_policy_oid, v_old_policy_cmd, v_old_policy_permissive, v_old_policy_roles, v_old_policy_qual, v_old_policy_withcheck
    from pg_policy p
   where p.polrelid = 'public.user_consents'::regclass
     and p.polname = 'org_isolation_user_consents';

  if v_old_policy_oid is not null then
    if v_old_policy_cmd <> '*' or not v_old_policy_permissive then
      raise exception 'Rollback 0006 bloqueado: policy legada org_isolation_user_consents com comando/permissive divergente.';
    end if;
    if coalesce(array_length(v_old_policy_roles, 1), 0) <> 1 or v_old_policy_roles[1] <> 0::oid then
      raise exception 'Rollback 0006 bloqueado: roles da policy legada org_isolation_user_consents divergentes.';
    end if;
    if v_old_policy_withcheck is not null then
      raise exception 'Rollback 0006 bloqueado: WITH CHECK inesperado em org_isolation_user_consents.';
    end if;

    v_old_policy_qual_expr := pg_get_expr(v_old_policy_qual, 'public.user_consents'::regclass);
    v_old_policy_qual_norm := regexp_replace(lower(coalesce(v_old_policy_qual_expr, '')), '[^a-z0-9_]+', '', 'g');
    v_old_policy_expected_norm := regexp_replace(lower($old$
organization_id::text = auth.jwt() ->> 'app.organization_id'
$old$), '[^a-z0-9_]+', '', 'g');

    if v_old_policy_qual_norm <> v_old_policy_expected_norm then
      raise exception 'Rollback 0006 bloqueado: expressao da policy legada org_isolation_user_consents divergente.';
    end if;
  end if;

  -- 1) Funcao
  select p.oid, p.prosrc
    into v_fn_oid, v_fn_prosrc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'validate_user_consent_insert_eligibility'
     and p.pronargs = 0;

  if v_fn_oid is null then
    raise exception 'Rollback 0006 bloqueado: funcao public.validate_user_consent_insert_eligibility() ausente.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where p.oid = v_fn_oid
     and n.nspname = 'public'
     and p.prorettype = 'trigger'::regtype
     and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
     and p.prosecdef
  ) then
    raise exception 'Rollback 0006 bloqueado: assinatura/seguranca da funcao divergente.';
  end if;

  v_fn_search_path_ok := exists (
    select 1
    from pg_proc p
    join unnest(coalesce(p.proconfig, array[]::text[])) cfg on true
    where p.oid = v_fn_oid
      and cfg in ('search_path=pg_catalog, public', 'search_path=pg_catalog,public')
  );
  if not v_fn_search_path_ok then
    raise exception 'Rollback 0006 bloqueado: search_path da funcao divergente.';
  end if;

  -- Corpo: comparar normalizado, sem depender de pg_get_expr.
  if lower(regexp_replace(coalesce(v_fn_prosrc, ''), '\s+', '', 'g')) <> lower(regexp_replace($fn$
declare
  v_document public.consent_documents%rowtype;
begin
  select d.*
    into v_document
    from public.consent_documents d
   where d.id = new.consent_document_id
   for update;

  if not found then
    raise exception
      'SUP-B01.2: consent_document_id % inexistente para registro de aceite.',
      new.consent_document_id;
  end if;

  if v_document.organization_id is distinct from new.organization_id then
    raise exception
      'SUP-B01.2: organization_id do aceite (%) diverge do organization_id do documento (%).',
      new.organization_id,
      v_document.organization_id;
  end if;

  if v_document.status <> 'ativo' then
    raise exception
      'SUP-B01.2: documento de consentimento % com status "%" nao e elegivel para novo aceite.',
      v_document.id,
      v_document.status;
  end if;

  if v_document.effective_at > transaction_timestamp() then
    raise exception
      'SUP-B01.2: documento de consentimento % ainda nao vigente (effective_at=%).',
      v_document.id,
      v_document.effective_at;
  end if;

  if v_document.expires_at is not null and v_document.expires_at <= transaction_timestamp() then
    raise exception
      'SUP-B01.2: documento de consentimento % expirado para novo aceite (expires_at=%).',
      v_document.id,
      v_document.expires_at;
  end if;

  return new;
end;
$fn$, '\s+', '', 'g')) then
    raise exception 'Rollback 0006 bloqueado: corpo da funcao diverge da definicao 0006.';
  end if;

  v_fn_exec_public := has_function_privilege('public', v_fn_oid, 'EXECUTE');
  v_fn_exec_anon := case when v_anon_oid is null then false else has_function_privilege('anon', v_fn_oid, 'EXECUTE') end;
  v_fn_exec_authenticated := has_function_privilege('authenticated', v_fn_oid, 'EXECUTE');
  if v_fn_exec_public or v_fn_exec_anon or v_fn_exec_authenticated then
    raise exception 'Rollback 0006 bloqueado: EXECUTE indevido em public/anon/authenticated.';
  end if;

  -- 2) Trigger
  select t.oid, t.tgtype, t.tgenabled, t.tgfoid
    into v_trigger_oid, v_trigger_tgtype, v_trigger_tgenabled, v_trigger_tgfoid
    from pg_trigger t
   where t.tgrelid = 'public.user_consents'::regclass
     and t.tgname = 'trg_validate_user_consent_insert_eligibility'
     and not t.tgisinternal;

  if v_trigger_oid is null then
    raise exception 'Rollback 0006 bloqueado: trigger trg_validate_user_consent_insert_eligibility ausente.';
  end if;
  if v_trigger_tgtype <> 7 then
    raise exception 'Rollback 0006 bloqueado: tgtype divergente (esperado BEFORE INSERT FOR EACH ROW).';
  end if;
  if v_trigger_tgfoid <> v_fn_oid then
    raise exception 'Rollback 0006 bloqueado: trigger nao aponta para funcao esperada.';
  end if;
  if v_trigger_tgenabled <> 'O' then
    raise exception 'Rollback 0006 bloqueado: trigger com estado tgenabled divergente.';
  end if;

  -- 3) Indice parcial unico
  select c.oid,
         i.indrelid,
         i.indisunique,
         i.indnkeyatts,
         i.indnatts,
         i.indexprs,
         i.indpred,
         am.amname
    into v_idx_oid, v_idx_indrelid, v_idx_indisunique, v_idx_indnkeyatts,
         v_idx_indnatts, v_idx_indexprs, v_idx_indpred, v_idx_method
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_index i on i.indexrelid = c.oid
    join pg_am am on am.oid = c.relam
   where n.nspname = 'public'
     and c.relname = 'user_consents_one_active_acceptance_idx';

  if v_idx_oid is null then
    raise exception 'Rollback 0006 bloqueado: indice user_consents_one_active_acceptance_idx ausente.';
  end if;
  if v_idx_indrelid <> 'public.user_consents'::regclass then
    raise exception 'Rollback 0006 bloqueado: indice nao pertence a public.user_consents.';
  end if;
  if not v_idx_indisunique then
    raise exception 'Rollback 0006 bloqueado: indice nao e unico.';
  end if;
  if coalesce(v_idx_method, '') <> 'btree' then
    raise exception 'Rollback 0006 bloqueado: metodo de indice divergente (esperado btree).';
  end if;
  if v_idx_indnkeyatts <> 3 or v_idx_indnatts <> 3 then
    raise exception 'Rollback 0006 bloqueado: indice deve ter exatamente 3 colunas-chave e nenhum INCLUDE.';
  end if;
  if v_idx_indexprs is not null then
    raise exception 'Rollback 0006 bloqueado: indice nao deve conter expressoes.';
  end if;

  select array_agg(a.attname order by k.ord)
    into v_idx_col_order
    from pg_index i
    cross join lateral unnest(i.indkey::int2[]) with ordinality as k(attnum, ord)
    join pg_attribute a
      on a.attrelid = i.indrelid
     and a.attnum = k.attnum
     and not a.attisdropped
   where i.indexrelid = v_idx_oid
     and k.ord <= i.indnkeyatts;

  if v_idx_col_order is distinct from array['organization_id', 'user_id', 'consent_document_id'] then
    raise exception 'Rollback 0006 bloqueado: ordem das colunas do indice divergente.';
  end if;

  -- Predicado: comparar no contexto da propria relacao do indice real.
  v_idx_pred_expr := pg_get_expr(v_idx_indpred, v_idx_indrelid);
  v_idx_pred_norm := regexp_replace(lower(coalesce(v_idx_pred_expr, '')), '[^a-z0-9_]+', '', 'g');
  v_idx_pred_expected_norm := regexp_replace(lower($idx$
revoked_at is null
$idx$), '[^a-z0-9_]+', '', 'g');

  if v_idx_pred_norm <> v_idx_pred_expected_norm then
    raise exception 'Rollback 0006 bloqueado: predicado do indice parcial diverge de revoked_at IS NULL.';
  end if;

  -- 4) Policies: atributos catalogados + expressao normalizada via pg_get_expr
  v_exp_uc_select_qual_norm := regexp_replace(lower($ucs$
auth.uid() is not null
and user_id = auth.uid()
and app_auth.has_active_org_link(organization_id)
$ucs$), '[^a-z0-9_]+', '', 'g');
  v_exp_uc_insert_check_norm := regexp_replace(lower($uci$
auth.uid() is not null
and user_id = auth.uid()
and app_auth.has_active_org_link(organization_id)
and exists (
  select 1
  from public.consent_documents d
  where d.id = user_consents.consent_document_id
    and d.organization_id = user_consents.organization_id
    and d.status = 'ativo'
    and d.effective_at <= transaction_timestamp()
    and (d.expires_at is null or d.expires_at > transaction_timestamp())
)
$uci$), '[^a-z0-9_]+', '', 'g');
  v_exp_uc_update_qual_norm := regexp_replace(lower($ucu$
auth.uid() is not null
and user_id = auth.uid()
and app_auth.has_active_org_link(organization_id)
$ucu$), '[^a-z0-9_]+', '', 'g');
  v_exp_uc_update_check_norm := v_exp_uc_update_qual_norm;
  v_exp_cd_select_eligible_qual_norm := regexp_replace(lower($cde$
auth.uid() is not null
and app_auth.has_active_org_link(organization_id)
and status = 'ativo'
and effective_at <= transaction_timestamp()
and (expires_at is null or expires_at > transaction_timestamp())
$cde$), '[^a-z0-9_]+', '', 'g');
  v_exp_cd_select_history_qual_norm := regexp_replace(lower($cdh$
auth.uid() is not null
and app_auth.has_active_org_link(organization_id)
and exists (
  select 1
  from public.user_consents uc
  where uc.organization_id = consent_documents.organization_id
    and uc.consent_document_id = consent_documents.id
    and uc.user_id = auth.uid()
)
$cdh$), '[^a-z0-9_]+', '', 'g');

  -- user_consents_select_self
  select p.oid, p.polcmd, p.polpermissive, p.polroles, p.polqual, p.polwithcheck
    into v_pol_oid, v_pol_cmd, v_pol_permissive, v_pol_roles, v_pol_qual, v_pol_check
    from pg_policy p
   where p.polrelid = 'public.user_consents'::regclass
     and p.polname = 'user_consents_select_self';
  if v_pol_oid is null then
    raise exception 'Rollback 0006 bloqueado: policy user_consents_select_self ausente.';
  end if;
  if v_pol_cmd <> 'r' or not v_pol_permissive then
    raise exception 'Rollback 0006 bloqueado: comando/permissive divergente em user_consents_select_self.';
  end if;
  if coalesce(array_length(v_pol_roles, 1), 0) <> 1 or v_pol_roles[1] <> v_authenticated_oid then
    raise exception 'Rollback 0006 bloqueado: role alvo divergente em user_consents_select_self.';
  end if;
  if v_pol_check is not null then
    raise exception 'Rollback 0006 bloqueado: WITH CHECK inesperado em user_consents_select_self.';
  end if;
  v_pol_qual_expr := pg_get_expr(v_pol_qual, 'public.user_consents'::regclass);
  v_pol_qual_norm := regexp_replace(lower(coalesce(v_pol_qual_expr, '')), '[^a-z0-9_]+', '', 'g');
  if v_pol_qual_norm <> v_exp_uc_select_qual_norm then
    raise exception 'Rollback 0006 bloqueado: expressao policy user_consents_select_self divergente.';
  end if;

  -- user_consents_insert_self
  select p.oid, p.polcmd, p.polpermissive, p.polroles, p.polqual, p.polwithcheck
    into v_pol_oid, v_pol_cmd, v_pol_permissive, v_pol_roles, v_pol_qual, v_pol_check
    from pg_policy p
   where p.polrelid = 'public.user_consents'::regclass
     and p.polname = 'user_consents_insert_self';
  if v_pol_oid is null then
    raise exception 'Rollback 0006 bloqueado: policy user_consents_insert_self ausente.';
  end if;
  if v_pol_cmd <> 'a' or not v_pol_permissive then
    raise exception 'Rollback 0006 bloqueado: comando/permissive divergente em user_consents_insert_self.';
  end if;
  if coalesce(array_length(v_pol_roles, 1), 0) <> 1 or v_pol_roles[1] <> v_authenticated_oid then
    raise exception 'Rollback 0006 bloqueado: role alvo divergente em user_consents_insert_self.';
  end if;
  if v_pol_qual is not null then
    raise exception 'Rollback 0006 bloqueado: USING inesperado em user_consents_insert_self.';
  end if;
  v_pol_check_expr := pg_get_expr(v_pol_check, 'public.user_consents'::regclass);
  v_pol_check_norm := regexp_replace(lower(coalesce(v_pol_check_expr, '')), '[^a-z0-9_]+', '', 'g');
  if v_pol_check_norm <> v_exp_uc_insert_check_norm then
    raise exception 'Rollback 0006 bloqueado: expressao WITH CHECK de user_consents_insert_self divergente.';
  end if;

  -- user_consents_update_revoke_self
  select p.oid, p.polcmd, p.polpermissive, p.polroles, p.polqual, p.polwithcheck
    into v_pol_oid, v_pol_cmd, v_pol_permissive, v_pol_roles, v_pol_qual, v_pol_check
    from pg_policy p
   where p.polrelid = 'public.user_consents'::regclass
     and p.polname = 'user_consents_update_revoke_self';
  if v_pol_oid is null then
    raise exception 'Rollback 0006 bloqueado: policy user_consents_update_revoke_self ausente.';
  end if;
  if v_pol_cmd <> 'w' or not v_pol_permissive then
    raise exception 'Rollback 0006 bloqueado: comando/permissive divergente em user_consents_update_revoke_self.';
  end if;
  if coalesce(array_length(v_pol_roles, 1), 0) <> 1 or v_pol_roles[1] <> v_authenticated_oid then
    raise exception 'Rollback 0006 bloqueado: role alvo divergente em user_consents_update_revoke_self.';
  end if;
  v_pol_qual_expr := pg_get_expr(v_pol_qual, 'public.user_consents'::regclass);
  v_pol_check_expr := pg_get_expr(v_pol_check, 'public.user_consents'::regclass);
  v_pol_qual_norm := regexp_replace(lower(coalesce(v_pol_qual_expr, '')), '[^a-z0-9_]+', '', 'g');
  v_pol_check_norm := regexp_replace(lower(coalesce(v_pol_check_expr, '')), '[^a-z0-9_]+', '', 'g');
  if v_pol_qual_norm <> v_exp_uc_update_qual_norm or v_pol_check_norm <> v_exp_uc_update_check_norm then
    raise exception 'Rollback 0006 bloqueado: expressoes USING/WITH CHECK de user_consents_update_revoke_self divergentes.';
  end if;

  -- consent_documents_select_eligible
  select p.oid, p.polcmd, p.polpermissive, p.polroles, p.polqual, p.polwithcheck
    into v_pol_oid, v_pol_cmd, v_pol_permissive, v_pol_roles, v_pol_qual, v_pol_check
    from pg_policy p
   where p.polrelid = 'public.consent_documents'::regclass
     and p.polname = 'consent_documents_select_eligible';
  if v_pol_oid is null then
    raise exception 'Rollback 0006 bloqueado: policy consent_documents_select_eligible ausente.';
  end if;
  if v_pol_cmd <> 'r' or not v_pol_permissive then
    raise exception 'Rollback 0006 bloqueado: comando/permissive divergente em consent_documents_select_eligible.';
  end if;
  if coalesce(array_length(v_pol_roles, 1), 0) <> 1 or v_pol_roles[1] <> v_authenticated_oid then
    raise exception 'Rollback 0006 bloqueado: role alvo divergente em consent_documents_select_eligible.';
  end if;
  if v_pol_check is not null then
    raise exception 'Rollback 0006 bloqueado: WITH CHECK inesperado em consent_documents_select_eligible.';
  end if;
  v_pol_qual_expr := pg_get_expr(v_pol_qual, 'public.consent_documents'::regclass);
  v_pol_qual_norm := regexp_replace(lower(coalesce(v_pol_qual_expr, '')), '[^a-z0-9_]+', '', 'g');
  if v_pol_qual_norm <> v_exp_cd_select_eligible_qual_norm then
    raise exception 'Rollback 0006 bloqueado: expressao policy consent_documents_select_eligible divergente.';
  end if;

  -- consent_documents_select_history_self
  select p.oid, p.polcmd, p.polpermissive, p.polroles, p.polqual, p.polwithcheck
    into v_pol_oid, v_pol_cmd, v_pol_permissive, v_pol_roles, v_pol_qual, v_pol_check
    from pg_policy p
   where p.polrelid = 'public.consent_documents'::regclass
     and p.polname = 'consent_documents_select_history_self';
  if v_pol_oid is null then
    raise exception 'Rollback 0006 bloqueado: policy consent_documents_select_history_self ausente.';
  end if;
  if v_pol_cmd <> 'r' or not v_pol_permissive then
    raise exception 'Rollback 0006 bloqueado: comando/permissive divergente em consent_documents_select_history_self.';
  end if;
  if coalesce(array_length(v_pol_roles, 1), 0) <> 1 or v_pol_roles[1] <> v_authenticated_oid then
    raise exception 'Rollback 0006 bloqueado: role alvo divergente em consent_documents_select_history_self.';
  end if;
  if v_pol_check is not null then
    raise exception 'Rollback 0006 bloqueado: WITH CHECK inesperado em consent_documents_select_history_self.';
  end if;
  v_pol_qual_expr := pg_get_expr(v_pol_qual, 'public.consent_documents'::regclass);
  v_pol_qual_norm := regexp_replace(lower(coalesce(v_pol_qual_expr, '')), '[^a-z0-9_]+', '', 'g');
  if v_pol_qual_norm <> v_exp_cd_select_history_qual_norm then
    raise exception 'Rollback 0006 bloqueado: expressao policy consent_documents_select_history_self divergente.';
  end if;
end $$;

-- Remocoes somente apos validacao completa.
drop trigger trg_validate_user_consent_insert_eligibility on public.user_consents;
drop function public.validate_user_consent_insert_eligibility();
drop index public.user_consents_one_active_acceptance_idx;

drop policy user_consents_select_self on public.user_consents;
drop policy user_consents_insert_self on public.user_consents;
drop policy user_consents_update_revoke_self on public.user_consents;
drop policy consent_documents_select_eligible on public.consent_documents;
drop policy consent_documents_select_history_self on public.consent_documents;

-- Restaurar policy legada.
drop policy if exists org_isolation_user_consents on public.user_consents;
create policy org_isolation_user_consents on public.user_consents
  using (organization_id::text = auth.jwt() ->> 'app.organization_id');

-- Reverter grants de 0006 de forma conservadora.
revoke select on table public.consent_documents from authenticated;
revoke select on table public.user_consents from authenticated;
revoke insert (organization_id, user_id, consent_document_id, source) on table public.user_consents from authenticated;
revoke update (revoked_at, revoked_source, revoked_reason, version, updated_at) on table public.user_consents from authenticated;
revoke delete on table public.user_consents from authenticated;

revoke all on table public.consent_documents from anon;
revoke all on table public.user_consents from anon;

revoke all on table public.consent_documents from public;
revoke all on table public.user_consents from public;

-- Pos-condicao de RLS
-- user_consents permanece com RLS habilitado.
-- consent_documents era sem RLS antes da 0006.
alter table public.consent_documents disable row level security;

commit;
