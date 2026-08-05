# WP-02.1 — Inventário técnico do banco

## 1. Finalidade e baseline

Este documento cataloga os objetos de banco comprovados pelo repositório `EdeMachado/BIOMEDHEALTH`, branch `main`, no início do WP-02.

Baseline auditado: `c47f3628d689878a464a7d8b94f969cdc7ebc1f9`.

O inventário é **estático e versionado**. Ele não afirma que todos os objetos estejam presentes, idênticos ou ativos no projeto Supabase remoto. Roles efetivas, owners, `BYPASSRLS`, grants herdados, extensions instaladas, buckets, objetos fora de migrations e divergência de schema exigem inventário remoto separado.

## 2. Estrutura Supabase versionada

O repositório contém:

- `supabase/migrations/` — 18 migrations forward-only (`0001` a `0018`);
- `supabase/rollbacks/` — scripts de reversão correspondentes;
- `supabase/policies/` — testes e artefatos de políticas;
- `supabase/seeds/` — seeds versionados, cuja execução não é presumida;
- migration `0019` — inexistente neste baseline.

## 3. Catálogo das migrations

| Nº | Arquivo | Capacidade principal |
|---|---|---|
| 0001 | `0001_init_schema.sql` | extensão `pgcrypto` e schema funcional inicial |
| 0002 | `0002_rls_policies.sql` | RLS inicial |
| 0003 | `0003_tenant_access_foundation.sql` | fundação de acesso multi-tenant |
| 0004 | `0004_tenant_access_rls.sql` | hardening de RLS por organização/unidade |
| 0005 | `0005_consent_versioning_schema.sql` | versionamento, integridade e imutabilidade de consentimento |
| 0006 | `0006_consent_versioning_rls.sql` | RLS e operações seguras de consentimento |
| 0007 | `0007_assessment_runtime_integrity.sql` | integridade da avaliação persistente |
| 0008 | `0008_journey_runtime_integrity.sql` | integridade da jornada preventiva |
| 0009 | `0009_journey_completion_immutability.sql` | imutabilidade após conclusão da jornada |
| 0010 | `0010_clinical_journey_linked_read.sql` | leitura clínica de jornada por vínculo ativo |
| 0011 | `0011_clinical_portfolio_linked_read.sql` | carteira clínica por vínculo ativo |
| 0012 | `0012_clinical_agenda_linked_write.sql` | agenda clínica persistida por vínculo |
| 0013 | `0013_clinical_record_versioned_write.sql` | ficha clínica modular e versionada |
| 0014 | `0014_care_plan_evolutions.sql` | plano de cuidado, ações, eventos e reavaliação atômica |
| 0015 | `0015_care_plan_event_permission_hardening.sql` | hardening de permissões dos eventos clínicos |
| 0016 | `0016_care_plan_event_insert_correlation.sql` | correlação e integridade na inserção de eventos |
| 0017 | `0017_collective_campaign_scope_integrity.sql` | campanhas/planos coletivos, escopo e aplicabilidade |
| 0018 | `0018_collective_atomic_mutations.sql` | seis mutações RPC atômicas do módulo coletivo |

## 4. Extensões e schemas

### Comprovado

- extensão `pgcrypto`, criada com `create extension if not exists`;
- schema `public` como domínio principal de tabelas e RPCs expostas;
- schema auxiliar `app_auth`, utilizado pelas migrations posteriores para helpers de autorização, guards e snapshots.

### Não comprovado por este inventário

- lista completa de extensions do ambiente remoto;
- owners efetivos dos schemas e funções;
- privilégios herdados por memberships de roles;
- existência de objetos criados manualmente fora das migrations.

## 5. Tabelas do schema inicial

A migration `0001` cria 32 tabelas:

### Organização, identidade e autorização

1. `organizations`
2. `organization_units`
3. `profiles`
4. `roles`
5. `permissions`
6. `user_organizations`
7. `user_roles`

### Consentimento e LGPD

8. `consent_documents`
9. `user_consents`

### Avaliações e risco

10. `assessments`
11. `assessment_versions`
12. `assessment_questions`
13. `assessment_options`
14. `assessment_responses`
15. `risk_rules`
16. `risk_results`

### Jornada preventiva

17. `health_journeys`
18. `journey_versions`
19. `journey_steps`
20. `journey_activities`
21. `user_journeys`
22. `user_activity_progress`

### Clínica

23. `appointments`
24. `professional_assignments`
25. `clinical_records`
26. `care_plans`
27. `care_plan_actions`

### Gestão coletiva e conteúdo

28. `campaigns`
29. `campaign_audiences`
30. `action_plans`
31. `educational_contents`
32. `notifications`

### Documentos e auditoria

33. `documents`
34. `audit_events`

> Correção de contagem: a migration inicial contém **34 tabelas**, não 32. A contagem de 32 registrada durante a inspeção preliminar foi substituída pela enumeração integral acima.

## 6. Tabelas e estruturas adicionadas/evoluídas

### `care_plan_events`

Criada em `0014` como histórico append-only de plano de cuidado, com:

- vínculo ao plano e, opcionalmente, à ação;
- organização, paciente e profissional;
- `event_kind` e `event_category` controlados por constraints;
- `payload` JSONB;
- versões anterior e posterior;
- autoria e data de criação;
- leitura por profissional responsável ou supervisão clínica;
- ausência intencional de `UPDATE` e `DELETE` para o fluxo autenticado.

### Evolução de consentimentos

`0005` acrescenta a `consent_documents`:

- `code`;
- `content_hash` verificável ou marcador legado explícito;
- `effective_at` e `expires_at`;
- unicidade por organização, código e versão jurídica;
- janela de validade e validação de hash;
- proteção dos campos canônicos após aceite.

`user_consents` recebe metadados de revogação, coerência temporal, FKs compostas de tenant, revogação irreversível e proibição de exclusão.

### Evolução do plano clínico

`0014` acrescenta a `care_plans` estado clínico próprio, objetivos, datas, reavaliação, autoria, fechamento, suspensão, versão de schema e vínculo opcional à ficha clínica.

`care_plan_actions` passa a carregar explicitamente paciente, profissional, objetivo, frequência, estado clínico, ordem, notas, autoria e conclusão.

### Gestão coletiva

`0017` e `0018` consolidam campanhas e planos de ação com escopos organizacionais/unidades, aplicabilidade, integridade de audiência, controle de versão e mutações atômicas. O D02 de indicadores agregados continua apenas especificado e não possui migration `0019` neste baseline.

## 7. Funções e RPCs — grupos comprovados

O repositório contém funções nos seguintes grupos:

### Autorização e vínculo

- helpers de vínculo ativo com organização;
- helpers de papel ativo, inclusive por unidade;
- verificação de assignment clínico ativo;
- verificações de gestão e supervisão clínica.

### Consentimento

- guards de mutabilidade de documentos e aceites;
- prevenção de `DELETE` em histórico de consentimento;
- operações seguras de aceite/revogação definidas nas migrations de RLS/runtime.

### Avaliação e jornada

- funções de criação/retomada e integridade concorrente;
- guards de transição e imutabilidade após conclusão;
- leituras clínicas vinculadas.

### Clínica

- autorização de carteira, agenda, ficha e plano por vínculo;
- guards de imutabilidade e versionamento otimista;
- snapshots automáticos de plano e ações;
- `reassess_clinical_care_plan(...)`, RPC atômica de reavaliação;
- helpers internos em `app_auth` com `SECURITY DEFINER` e `search_path` explícito nas migrations auditadas.

### Gestão coletiva

A migration `0018` implementa seis RPCs atômicas para criação, atualização e exclusão de campanhas e planos de ação, com bloqueio, versão esperada e substituição atômica da aplicabilidade.

## 8. Triggers — categorias comprovadas

- proteção de imutabilidade de termos após aceite;
- proteção e revogação irreversível de consentimentos;
- prevenção de exclusão de histórico;
- integridade e imutabilidade de avaliação/jornada;
- versionamento e proteção de ficha clínica;
- guard de plano de cuidado e ações;
- snapshots append-only de alterações clínicas;
- integridade de escopo e mutações coletivas.

O número e o nome completos dos triggers serão confirmados no inventário remoto e na matriz objeto-a-objeto do WP-02.3.

## 9. Índices e constraints — padrões comprovados

### Isolamento e relacionamento

- índices por `organization_id` e combinações de organização/usuário/profissional;
- FKs compostas para impedir associação entre tenants;
- unicidade funcional por organização;
- índices parciais para estados ativos/abertos.

### Concorrência

- coluna técnica `version` amplamente utilizada;
- guards exigindo incremento exato em alterações críticas;
- RPCs com `expected_version` e erro de concorrência;
- unicidade de apenas um plano clínico aberto por organização/profissional/paciente.

### Integridade temporal e de estado

- validade de consentimentos;
- revogação posterior ao aceite;
- fechamento coerente de planos;
- conclusão coerente de ações;
- status limitados por `CHECK`;
- imutabilidade após conclusão/encerramento.

## 10. RLS e grants — estado versionado

### Comprovado

- RLS habilitada e progressivamente endurecida em tabelas sensíveis;
- políticas para titular, profissional vinculado e supervisor conforme o domínio;
- revogação explícita de privilégios de `public` e `anon` em objetos críticos;
- grants de coluna restritos em fluxos clínicos;
- `service_role` não é destinado ao frontend;
- dados clínicos devem falhar de forma fechada quando autenticação, tenant, RLS ou proveniência falham.

### Ainda não comprovado remotamente

- grants efetivos após herança de roles;
- owners das funções/tabelas;
- funções com `BYPASSRLS` ou owner superuser;
- policies efetivamente instaladas no HML;
- divergência entre migrations locais e catálogo remoto.

## 11. Views, materialized views e storage

Nenhuma view, materialized view ou bucket de Storage foi confirmada por este inventário inicial das migrations.

Isso não prova ausência no ambiente remoto. A confirmação deve consultar `pg_class`, `pg_views`, `pg_matviews`, `storage.buckets` e `storage.objects` no inventário operacional.

## 12. Seeds

A existência da pasta `supabase/seeds/` é comprovada. A execução de qualquer seed no HML ou em produção **não** é presumida. Seeds devem ser sanitizados, opcionais e explicitamente autorizados.

## 13. Principais achados do WP-02.1

### Pontos fortes

- evolução incremental e numerada;
- rollbacks versionados;
- forte uso de FKs compostas para tenant;
- RLS e grants explícitos em fluxos sensíveis;
- concorrência otimista e mutações atômicas;
- histórico append-only em consentimento e cuidado;
- `SECURITY DEFINER` acompanhado de `search_path` explícito nas funções revisadas;
- ausência de migration `0019`, preservando o bloqueio do D02-A.

### Gaps a investigar

1. ausência de `supabase/config.toml` e bootstrap local completo no baseline auditado;
2. inventário remoto de owners, roles, grants, policies e `BYPASSRLS` ainda pendente;
3. tipos TypeScript do banco precisam ser comparados com o schema final;
4. uso consistente de `unit_id` permanece incompleto em partes do domínio clínico;
5. `audit_events` existe desde o schema inicial, mas a persistência efetiva de auditoria da aplicação precisa de validação própria;
6. views, storage, extensions adicionais e objetos manuais precisam ser comprovados remotamente;
7. necessidade de medir índices por FKs, cardinalidade e consultas reais no WP-02.4.

## 14. Próximas entregas

1. **WP-02.2 — Canonical Data Model**: definição oficial das entidades e relacionamentos.
2. **WP-02.3 — Database Security Review**: matriz completa de RLS, policies, grants, owners, `SECURITY DEFINER`, `search_path` e isolamento.
3. **WP-02.4 — Database Performance Review**: índices, cardinalidade, crescimento e queries críticas.
4. **Inventário remoto separado**: comparação entre migrations e catálogo do HML, sem aplicar alterações.

## 15. Veredito

O banco versionado possui uma base madura para um MVP corporativo, com boas decisões de isolamento, integridade, concorrência e rastreabilidade. O repositório, porém, ainda não é prova suficiente do estado operacional do Supabase remoto. A continuidade do WP-02 deve preservar essa separação entre **schema pretendido/versionado** e **schema efetivamente implantado**.
