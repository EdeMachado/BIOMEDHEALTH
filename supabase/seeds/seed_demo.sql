-- Ambiente demonstrativo - dados ficticios

insert into organizations (id, name)
values
  ('11111111-1111-1111-1111-111111111111', 'BioVale Energia'),
  ('22222222-2222-2222-2222-222222222222', 'Prefeitura Municipal Aurora'),
  ('33333333-3333-3333-3333-333333333333', 'Instituto Horizonte Tech')
on conflict (id) do nothing;

insert into organization_units (id, organization_id, name)
values
  ('aaaaaaa1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Unidade Centro'),
  ('aaaaaaa2-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Unidade Industrial'),
  ('aaaaaaa3-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Unidade Norte'),
  ('aaaaaaa4-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Unidade Sul'),
  ('aaaaaaa5-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'Unidade Campus')
on conflict (id) do nothing;

insert into roles (code, description)
values
  ('usuario', 'Usuario final'),
  ('medico', 'Medico'),
  ('gestor_institucional', 'Gestor institucional'),
  ('auditor', 'Auditor')
on conflict (code) do nothing;

insert into health_journeys (organization_id, name, description, target_audience, duration_weeks, technical_owner)
values
  ('11111111-1111-1111-1111-111111111111', 'Bem-estar e Prevencao', 'Jornada preventiva introdutoria.', 'Adultos ativos', 8, 'Equipe Clinica Demo'),
  ('11111111-1111-1111-1111-111111111111', 'Sono e Recuperacao', 'Foco em rotina de descanso.', 'Colaboradores administrativos', 6, 'Equipe Clinica Demo'),
  ('22222222-2222-2222-2222-222222222222', 'Saude Corporativa', 'Acoes coletivas de saude ocupacional.', 'Servidores municipais', 10, 'Equipe SST Demo')
on conflict do nothing;

insert into campaigns (organization_id, title, description, channel, starts_at, ends_at, campaign_status)
values
  ('11111111-1111-1111-1111-111111111111', 'Semana do Sono', 'Campanha educativa sobre sono.', 'app', current_date, current_date + interval '15 day', 'ativa'),
  ('11111111-1111-1111-1111-111111111111', 'Movimente-se com Saude', 'Campanha de atividade preventiva.', 'email', current_date + interval '7 day', current_date + interval '30 day', 'agendada')
on conflict do nothing;

insert into action_plans (organization_id, origin_indicator, issue_description, action_text, owner_name, due_date, priority, action_status)
values
  ('11111111-1111-1111-1111-111111111111', 'Adesao jornada cardiovascular', 'Adesao abaixo da meta', 'Reforcar comunicacao preventiva', 'Marina Gestora', current_date + interval '30 day', 'alta', 'em_andamento')
on conflict do nothing;
