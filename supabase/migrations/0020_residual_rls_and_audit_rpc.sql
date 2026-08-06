-- WP-03.2: residual RLS for 0001 tables + audit append RPC + grant hardening.
-- Additive only. Does not edit migrations 0001-0019.

begin;

do $$
begin
  if not exists (
    select 1 from pg_namespace where nspname = 'app_auth'
  ) then
    raise exception 'WP-03.2: schema app_auth ausente (esperado apos 0004/0019).';
  end if;

  if to_regprocedure('app_auth.has_active_org_link(uuid)') is null then
    raise exception 'WP-03.2: app_auth.has_active_org_link(uuid) ausente.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) Enable RLS on residual 0001 tables
-- ---------------------------------------------------------------------------
alter table public.assessment_versions enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_options enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.risk_rules enable row level security;
alter table public.educational_contents enable row level security;
alter table public.notifications enable row level security;
alter table public.documents enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Catalog SELECT policies (org members; no client writes)
-- ---------------------------------------------------------------------------
drop policy if exists assessment_versions_select_org_member on public.assessment_versions;
create policy assessment_versions_select_org_member
on public.assessment_versions
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and (
    status = 'ativo'
    or exists (
      select 1
      from public.assessments a
      where a.assessment_version_id = assessment_versions.id
        and a.organization_id = assessment_versions.organization_id
        and a.user_id = auth.uid()
    )
  )
);

drop policy if exists assessment_questions_select_org_member on public.assessment_questions;
create policy assessment_questions_select_org_member
on public.assessment_questions
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and exists (
    select 1
    from public.assessment_versions v
    where v.id = assessment_questions.assessment_version_id
      and v.organization_id = assessment_questions.organization_id
      and (
        v.status = 'ativo'
        or exists (
          select 1
          from public.assessments a
          where a.assessment_version_id = v.id
            and a.organization_id = v.organization_id
            and a.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists assessment_options_select_org_member on public.assessment_options;
create policy assessment_options_select_org_member
on public.assessment_options
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and exists (
    select 1
    from public.assessment_questions q
    join public.assessment_versions v
      on v.id = q.assessment_version_id
     and v.organization_id = q.organization_id
    where q.id = assessment_options.assessment_question_id
      and q.organization_id = assessment_options.organization_id
      and (
        v.status = 'ativo'
        or exists (
          select 1
          from public.assessments a
          where a.assessment_version_id = v.id
            and a.organization_id = v.organization_id
            and a.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists risk_rules_select_org_member on public.risk_rules;
create policy risk_rules_select_org_member
on public.risk_rules
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and status = 'ativo'
);

drop policy if exists educational_contents_select_org_member on public.educational_contents;
create policy educational_contents_select_org_member
on public.educational_contents
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and status = 'ativo'
);

-- ---------------------------------------------------------------------------
-- 3) Owner-tier policies (responses / notifications / documents)
-- ---------------------------------------------------------------------------
drop policy if exists assessment_responses_select_owner on public.assessment_responses;
create policy assessment_responses_select_owner
on public.assessment_responses
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_responses.assessment_id
      and a.organization_id = assessment_responses.organization_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists assessment_responses_select_clinical_linked on public.assessment_responses;
create policy assessment_responses_select_clinical_linked
on public.assessment_responses
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_responses.assessment_id
      and a.organization_id = assessment_responses.organization_id
      and app_auth.has_active_clinical_assignment(a.organization_id, a.user_id)
  )
);

drop policy if exists assessment_responses_insert_owner on public.assessment_responses;
create policy assessment_responses_insert_owner
on public.assessment_responses
for insert
to authenticated
with check (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_responses.assessment_id
      and a.organization_id = assessment_responses.organization_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists assessment_responses_update_owner on public.assessment_responses;
create policy assessment_responses_update_owner
on public.assessment_responses
for update
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_responses.assessment_id
      and a.organization_id = assessment_responses.organization_id
      and a.user_id = auth.uid()
  )
)
with check (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and exists (
    select 1
    from public.assessments a
    where a.id = assessment_responses.assessment_id
      and a.organization_id = assessment_responses.organization_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists notifications_select_owner on public.notifications;
create policy notifications_select_owner
on public.notifications
for select
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

drop policy if exists notifications_update_owner on public.notifications;
create policy notifications_update_owner
on public.notifications
for update
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
)
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

drop policy if exists documents_select_owner on public.documents;
create policy documents_select_owner
on public.documents
for select
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

drop policy if exists documents_select_clinical_linked on public.documents;
create policy documents_select_clinical_linked
on public.documents
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_clinical_assignment(organization_id, user_id)
);

drop policy if exists documents_insert_owner on public.documents;
create policy documents_insert_owner
on public.documents
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

drop policy if exists documents_update_owner on public.documents;
create policy documents_update_owner
on public.documents
for update
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
)
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and app_auth.has_active_org_link(organization_id)
);

-- ---------------------------------------------------------------------------
-- 4) Privilege sandwich for residual tables
-- ---------------------------------------------------------------------------
revoke all on table public.assessment_versions from public, anon, authenticated;
revoke all on table public.assessment_questions from public, anon, authenticated;
revoke all on table public.assessment_options from public, anon, authenticated;
revoke all on table public.assessment_responses from public, anon, authenticated;
revoke all on table public.risk_rules from public, anon, authenticated;
revoke all on table public.educational_contents from public, anon, authenticated;
revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.documents from public, anon, authenticated;

grant select on table public.assessment_versions to authenticated;
grant select on table public.assessment_questions to authenticated;
grant select on table public.assessment_options to authenticated;
grant select on table public.risk_rules to authenticated;
grant select on table public.educational_contents to authenticated;

grant select, insert, update on table public.assessment_responses to authenticated;
grant select, update on table public.notifications to authenticated;
grant select, insert, update on table public.documents to authenticated;

-- Also harden assessments / risk_results / audit_events / professional_assignments grants
revoke all on table public.assessments from public, anon;
revoke all on table public.risk_results from public, anon;
revoke all on table public.audit_events from public, anon;
revoke all on table public.professional_assignments from public, anon;

grant select on table public.assessments to authenticated;
grant select on table public.risk_results to authenticated;
grant select on table public.audit_events to authenticated;
grant select on table public.professional_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Modernize audit_events RLS + append-only RPC (WP-03.2 audit adapter prep)
-- ---------------------------------------------------------------------------
drop policy if exists audit_read_only_for_auditor on public.audit_events;
drop policy if exists audit_events_select_auditor on public.audit_events;

create policy audit_events_select_auditor
on public.audit_events
for select
to authenticated
using (
  auth.uid() is not null
  and app_auth.has_active_org_link(organization_id)
  and app_auth.has_active_role(
    organization_id,
    array['auditor', 'admin_biomed']::text[]
  )
);

create or replace function public.register_audit_event(
  p_organization_id uuid,
  p_actor_role text,
  p_action text,
  p_entity text,
  p_entity_id text,
  p_origin text,
  p_result text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'register_audit_event: sessao ausente' using errcode = '42501';
  end if;

  if p_organization_id is null
     or coalesce(trim(p_actor_role), '') = ''
     or coalesce(trim(p_action), '') = ''
     or coalesce(trim(p_entity), '') = ''
     or coalesce(trim(p_origin), '') = ''
     or coalesce(trim(p_result), '') = '' then
    raise exception 'register_audit_event: parametros obrigatorios ausentes'
      using errcode = '22023';
  end if;

  if not app_auth.has_active_org_link(p_organization_id) then
    raise exception 'register_audit_event: vinculo organizacional ausente'
      using errcode = '42501';
  end if;

  if p_result not in ('sucesso', 'falha', 'negado') then
    raise exception 'register_audit_event: resultado invalido' using errcode = '22023';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_role,
    action,
    entity,
    entity_id,
    origin,
    result,
    reason,
    status,
    version
  )
  values (
    p_organization_id,
    auth.uid(),
    trim(p_actor_role),
    trim(p_action),
    trim(p_entity),
    nullif(trim(coalesce(p_entity_id, '')), ''),
    trim(p_origin),
    trim(p_result),
    nullif(trim(coalesce(p_reason, '')), ''),
    'ativo',
    1
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.register_audit_event(uuid, text, text, text, text, text, text, text) from public;
revoke all on function public.register_audit_event(uuid, text, text, text, text, text, text, text) from anon;
grant execute on function public.register_audit_event(uuid, text, text, text, text, text, text, text) to authenticated;

commit;
