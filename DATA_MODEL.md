# BIOMED HEALTH - Modelo Inicial de Dados (MVP)

## Premissas

- Banco alvo: PostgreSQL (Supabase)
- IDs: UUID
- Auditoria e versionamento nativos
- JSONB apenas quando tecnicamente justificado
- O BIOMED HEALTH e um ecossistema modular (individual, clinico, gestao coletiva, ocupacional, intelligence) — Gestao nao e o proposito total do produto

## Escopo de `organization_id` e `unit_id` (decisao ratificada 2026-07-31)

Aplicacao do modelo hibrido **exclusivamente** ao dominio institucional e de gestao coletiva (detalhe: `PROJECT_MASTER_HANDOFF.md` §6.1).

| Dominio | `organization_id` | `unit_id` |
|---|---|---|
| Institucional / gestao coletiva | **Obrigatorio** | Obrigatorio quando houver recorte operacional por unidade; `null` = escopo organizacional **explicito** |
| Pessoal / B2C / titularidade do paciente | **Nao** obrigatorio como regra universal | N/A salvo vinculo opcional |
| Clinico assistencial | Contextual (vinculo/programa); org patrocinadora **nao** dona o prontuario | Gap residual em agenda (C01) e dívida **paralela** ao D01 coletivo |

Regras conceituais ratificadas:

1. No dominio coletivo/institucional, todo registro exige `organization_id`.
2. `unit_id` e condicional: obrigatorio apenas no recorte unitario; vedado usar `null` como unidade esquecida, contexto desconhecido, falha de selecao, ausencia acidental, fallback de autorizacao ou ampliação de acesso.
3. Quando houver `unit_id`, a unidade deve pertencer ao `organization_id` informado.
4. Dados pessoais e assistenciais independentes nao exigem organizacao universal.
5. Organizacao patrocinadora/sediante nao se torna titular do prontuario pessoal.
6. Informacoes coletivas/gerenciais exigem limiar minimo de **10** pessoas no recorte efetivamente consultado (apos todos os filtros), sem contorno por cruzamentos/exportacoes; o limiar nao impede atendimento clinico autorizado.
7. Usuario unit-scoped pode visualizar campanhas organizacionais aplicaveis a sua unidade sob vinculo/papel validos, sem acesso a outras units nem a dados individuais indevidos.

**Estado implementado (MVP atual — nao confundir com a decisao):** muitas tabelas sensiveis ja possuem `organization_id NOT NULL`; `unit_id` existe sobretudo em bindings de access (`user_roles` / `user_profiles`); campanhas/planos ainda sem coluna de unidade. Evolucoes de schema coletivo ficam para a especificação/implementação futuras do SUP-D01 (**ainda nao autorizadas**).

## Convencoes de colunas base

Sempre que aplicavel ao tipo de entidade:

- `id uuid primary key`
- `organization_id uuid not null` — **quando** a entidade for institucional/coletiva (nao como dogma universal)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by uuid null`
- `updated_by uuid null`
- `status text not null default 'ativo'`
- `version int not null default 1`
- `metadata jsonb null` (somente quando justificavel)

## Entidades obrigatorias do MVP

### Organizacao e acesso

- `organizations`
- `organization_units`
- `profiles`
- `user_organizations`
- `roles`
- `permissions`
- `user_roles`

### Consentimento e privacidade

- `consent_documents`
- `user_consents`

### Avaliacao e risco orientativo

- `assessments`
- `assessment_versions`
- `assessment_questions`
- `assessment_options`
- `assessment_responses`
- `risk_rules`
- `risk_results`

### Jornadas e acompanhamento

- `health_journeys`
- `journey_versions`
- `journey_steps`
- `journey_activities`
- `user_journeys`
- `user_activity_progress`

### Agenda e atendimento

- `appointments`
- `professional_assignments`
- `clinical_records`
- `care_plans`
- `care_plan_actions`

### Gestao e inteligencia coletiva

- `campaigns`
- `campaign_audiences`
- `action_plans`
- `educational_contents`
- `notifications`

### Documentos e auditoria

- `documents`
- `audit_events`

## Relacionamentos-chave

1. `organization_units.organization_id -> organizations.id`
2. `user_organizations.organization_id -> organizations.id`
3. `user_roles.user_organization_id -> user_organizations.id`
4. `user_consents.user_organization_id -> user_organizations.id`
5. `assessment_responses.assessment_version_id -> assessment_versions.id`
6. `risk_results.assessment_id -> assessments.id`
7. `user_journeys.journey_version_id -> journey_versions.id`
8. `user_activity_progress.user_journey_id -> user_journeys.id`
9. `appointments.user_id/professional_id` com escopo de organizacao
10. `clinical_records` e `care_plans` vinculados a usuario + profissional + organizacao
11. `audit_events` referencia entidade por tipo e id

## Estrategia de modelagem de versao

- Consentimentos:
  - `consent_documents` guarda documento, finalidade, base legal e versao
  - `user_consents` registra aceite/revogacao por usuario e origem

- Avaliacoes:
  - `assessments` como instancia preenchida
  - `assessment_versions` para versoes do questionario
  - `assessment_questions` e `assessment_options` versionadas

- Jornadas:
  - `health_journeys` como cabecalho
  - `journey_versions` para historico de alteracoes

## Regras de privacidade no modelo

- RH/Gestor institucional consulta apenas visoes agregadas (limiar minimo 10 no recorte efetivo).
- Dados clinicos individualizados ficam em tabelas clinicas segregadas; painel gerencial nao e canal de prontuario.
- Documentos em storage privado; banco guarda metadados.
- Exportacao/correcao/revogacao gera evento em `audit_events`.
- Desligamento de vinculo institucional nao elimina historico pessoal do usuario.
- Dado coletivo derivado nao transfere titularidade do dado pessoal a organizacao.

## Estrategia de seed ficticio

Minimo:

- 3 organizacoes
- 5 unidades
- 30 usuarios
- 5 profissionais
- avaliacoes preenchidas ficticias
- jornadas ativas
- campanhas e planos de acao
- agenda ficticia
- indicadores agregados por organizacao

Regras:

- Nenhum CPF, telefone ou endereco real
- Nomes sinteticos ficticios
- Banner global: "Ambiente demonstrativo - dados ficticios"

## Artefatos a gerar na fase de fundacao

1. `supabase/migrations/0001_init_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/seeds/seed_demo.sql`
4. Tipos TypeScript derivados do schema (arquivo dedicado em `apps/web/src/shared/types`)
