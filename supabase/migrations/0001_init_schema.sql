create extension if not exists "pgcrypto";

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'ativo',
  version int not null default 1,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_organization_id uuid not null references user_organizations(id),
  role_id uuid not null references roles(id),
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create table if not exists consent_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  legal_basis text not null,
  purpose text not null,
  document_version text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  consent_document_id uuid not null references consent_documents(id),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text not null default 'web',
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  assessment_version_id uuid,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessment_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  code text not null,
  title text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessment_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  assessment_version_id uuid not null references assessment_versions(id),
  domain text not null,
  prompt text not null,
  question_order int not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessment_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  assessment_question_id uuid not null references assessment_questions(id),
  label text not null,
  value text not null,
  score int,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assessment_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  assessment_id uuid not null references assessments(id),
  assessment_question_id uuid not null references assessment_questions(id),
  answer_text text,
  answer_value text,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists risk_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  rule_key text not null,
  domain text not null,
  condition_expression text not null,
  result_label text not null,
  rationale text not null,
  priority int not null,
  effective_at timestamptz not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists risk_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  assessment_id uuid not null references assessments(id),
  level text not null,
  message text not null,
  explainability text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists health_journeys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  description text not null,
  target_audience text not null,
  duration_weeks int not null,
  technical_owner text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists journey_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  journey_id uuid not null references health_journeys(id),
  code text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists journey_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  journey_version_id uuid not null references journey_versions(id),
  title text not null,
  step_order int not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists journey_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  journey_step_id uuid not null references journey_steps(id),
  title text not null,
  periodicity text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_journeys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  journey_version_id uuid not null references journey_versions(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_activity_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_journey_id uuid not null references user_journeys(id),
  journey_activity_id uuid not null references journey_activities(id),
  progress_percent int not null default 0,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  professional_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  appointment_status text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists professional_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  professional_id uuid not null,
  user_id uuid not null,
  assignment_reason text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clinical_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  professional_id uuid not null,
  summary text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists care_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  professional_id uuid not null,
  title text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists care_plan_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  care_plan_id uuid not null references care_plans(id),
  action_text text not null,
  due_date date,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  description text not null,
  channel text not null,
  starts_at date not null,
  ends_at date not null,
  campaign_status text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_audiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  campaign_id uuid not null references campaigns(id),
  audience_label text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists action_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  origin_indicator text not null,
  issue_description text not null,
  action_text text not null,
  owner_name text not null,
  due_date date not null,
  priority text not null,
  action_status text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists educational_contents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  body text not null,
  category text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null,
  storage_path text not null,
  mime_type text not null,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  actor_user_id uuid,
  actor_role text not null,
  action text not null,
  entity text not null,
  entity_id text,
  origin text not null,
  result text not null,
  reason text,
  status text not null default 'ativo',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
