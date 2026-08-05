# BioMed Health — Canonical Data Model

## 1. Finalidade

Este documento define a linguagem canônica dos dados da BioMed Health. Ele estabelece o significado oficial das principais entidades, seus identificadores, vínculos, fontes de verdade e fronteiras de responsabilidade entre os domínios pessoal, clínico, institucional e coletivo.

O documento não substitui migrations, RLS, contratos TypeScript ou especificações funcionais. Ele orienta sua evolução e deve ser consultado antes de criar novas tabelas, campos, APIs, indicadores ou integrações de IA.

## 2. Baseline e limites

Baseline documental: `main` após o WP-02.1 e migrations `0001` a `0018`.

Fontes principais:

- `DATABASE_INVENTORY.md`;
- `DATA_MODEL.md`;
- migrations versionadas;
- `PROJECT_MASTER_HANDOFF.md`;
- especificações SUP-B, SUP-C e SUP-D.

Este modelo descreve o estado canônico pretendido a partir do que está versionado. Ele não prova, isoladamente, o estado do Supabase remoto.

## 3. Princípios canônicos

1. Uma pessoa não se torna propriedade de uma organização por existir um vínculo institucional.
2. Autenticação, identidade de domínio e vínculo institucional são conceitos distintos.
3. Dados clínicos individualizados não podem ser tratados como dados gerenciais da organização.
4. `organization_id` representa contexto institucional, não titularidade universal do dado pessoal.
5. `unit_id` representa recorte operacional explícito e nunca pode ser usado como fallback de autorização.
6. Dados versionados preservam o significado histórico da informação utilizada em cada decisão.
7. Eventos clínicos, consentimentos e registros de auditoria exigem rastreabilidade e, quando definido pelo domínio, imutabilidade.
8. Dados coletivos derivam de dados individuais autorizados, mas não transferem à organização acesso ao detalhe individual.
9. O mesmo conceito de negócio deve possuir um único significado canônico, ainda que seja exposto por diferentes telas ou APIs.
10. IA, analytics e integrações devem consumir contratos canônicos, e não tabelas de forma irrestrita.

## 4. Contextos de identidade

### 4.1 Conta autenticada

A conta autenticada é a identidade técnica mantida pelo Supabase Auth e referenciada por `auth.uid()`.

Ela responde à pergunta: **quem está autenticado?**

Não responde, por si só:

- em qual organização a pessoa atua;
- qual papel possui;
- se é paciente, profissional ou gestor;
- quais dados clínicos pode acessar.

### 4.2 Pessoa/titular

Pessoa ou titular é o indivíduo a quem pertencem os dados pessoais e de saúde.

No MVP atual, diversos objetos utilizam `user_id` diretamente, sem uma tabela canônica própria de pessoa. Portanto:

- `user_id` é atualmente o identificador operacional mais próximo do titular;
- a criação futura de uma entidade `persons` ou equivalente exige RFC e plano de migração;
- não se deve criar nova tabela paralela de paciente, colaborador ou beneficiário sem mapear sua relação com esse identificador.

### 4.3 Vínculo institucional

`user_organizations` representa a relação ativa ou histórica entre uma conta e uma organização.

Ele responde à pergunta: **esta pessoa possui vínculo com esta organização?**

O vínculo:

- não concede papel automaticamente;
- não transfere titularidade de prontuário;
- pode ser encerrado sem apagar o histórico pessoal;
- é pré-condição para diversos acessos institucionais.

### 4.4 Papel e perfil

- `roles` representa papéis de autorização, como médico, profissional de saúde, gestor ou administrador.
- `profiles` representa perfis funcionais/configuráveis conforme o modelo de acesso.
- `user_roles` e estruturas relacionadas vinculam o usuário a um papel dentro de um escopo institucional.

Papel é autorização contextual; não é profissão, identidade civil nem titularidade de dado.

## 5. Domínio organizacional

### 5.1 Organização

**Entidade:** `organizations`

Representa a pessoa jurídica, instituição, contratante, patrocinadora ou estrutura administrativa que utiliza a plataforma.

Fonte de verdade para:

- identidade institucional;
- status operacional;
- raiz do isolamento multi-tenant.

Não é fonte de verdade para:

- identidade da pessoa;
- prontuário clínico;
- profissão do usuário;
- consentimento universal.

### 5.2 Unidade organizacional

**Entidade:** `organization_units`

Representa um recorte operacional pertencente a uma organização, como unidade, planta, estabelecimento ou local de atuação.

Regras:

- toda unidade pertence a exatamente uma organização;
- quando um registro informa `unit_id`, a unidade deve pertencer ao mesmo `organization_id`;
- `unit_id = null` somente é válido quando o domínio define explicitamente escopo organizacional;
- ausência acidental de unidade não pode ampliar acesso.

## 6. Consentimento e privacidade

### 6.1 Documento de consentimento

**Entidade:** `consent_documents`

É a versão canônica de um termo de consentimento, identificada por organização, código e versão jurídica/funcional.

Fonte de verdade para:

- finalidade;
- base legal declarada;
- conteúdo identificado por hash;
- vigência;
- versão do documento.

Após existir aceite vinculado, seus campos canônicos são imutáveis. Nova redação deve gerar nova versão.

### 6.2 Aceite/revogação

**Entidade:** `user_consents`

Representa um evento de aceite de um documento específico por um titular, com possibilidade de revogação posterior.

Regras:

- aceite original é imutável;
- revogação é transição explícita e irreversível na mesma linha;
- exclusão não representa revogação;
- o vínculo entre documento, usuário e organização deve permanecer coerente;
- a situação vigente deriva de `revoked_at`, não da edição histórica do aceite.

## 7. Avaliação e risco orientativo

### 7.1 Definição da avaliação

- `assessment_versions`: versão canônica do instrumento.
- `assessment_questions`: perguntas pertencentes à versão.
- `assessment_options`: opções e escores possíveis.

Uma versão publicada não deve ser reinterpretada retroativamente. Alterações funcionais devem gerar nova versão.

### 7.2 Instância de avaliação

**Entidade:** `assessments`

Representa o preenchimento de uma versão do instrumento por um titular.

### 7.3 Resposta

**Entidade:** `assessment_responses`

Representa a resposta do titular a uma pergunta da versão vinculada à avaliação.

A resposta deve preservar coerência entre:

- organização;
- avaliação;
- versão;
- pergunta;
- titular.

### 7.4 Regra e resultado de risco

- `risk_rules`: regra versionada e explicável de classificação.
- `risk_results`: resultado produzido para uma avaliação.

Resultado de risco é orientativo conforme o domínio definido. Não equivale automaticamente a diagnóstico clínico, causalidade ou decisão autônoma de IA.

## 8. Jornadas preventivas

### 8.1 Jornada e versão

- `health_journeys`: identidade funcional da jornada.
- `journey_versions`: versão executável da jornada.
- `journey_steps`: etapas ordenadas.
- `journey_activities`: atividades de cada etapa.

A versão vinculada ao participante deve preservar o conteúdo histórico utilizado durante sua execução.

### 8.2 Participação e progresso

- `user_journeys`: instância da jornada atribuída ao titular.
- `user_activity_progress`: progresso por atividade.

Conclusão é evento de domínio e deve respeitar as regras de imutabilidade definidas nas migrations.

## 9. Domínio clínico

### 9.1 Profissional clínico

No estado atual, `professional_id` referencia a identidade autenticada do profissional e é validado contra `auth.uid()` nos fluxos protegidos.

A condição de profissional autorizado depende de:

- sessão autenticada;
- vínculo organizacional aplicável;
- papel clínico ativo;
- assignment clínico ativo quando exigido.

Não se deve assumir que qualquer usuário com UUID em `professional_id` seja profissional habilitado.

### 9.2 Vínculo clínico

**Entidade:** `professional_assignments`

Representa a autorização relacional entre profissional e paciente/titular em uma organização.

É fonte de verdade para a carteira clínica e para diversos acessos individuais.

Regras:

- deve estar ativo;
- deve corresponder à organização consultada;
- não pode ser inferido apenas de uma consulta ou agendamento anterior;
- sua ausência deve resultar em comportamento `fail-closed`.

### 9.3 Agendamento

**Entidade:** `appointments`

Representa um compromisso assistencial entre titular e profissional em período definido.

Fronteira:

- agendamento organiza atendimento;
- não substitui assignment clínico;
- não é prontuário;
- o uso canônico de `unit_id` ainda é gap explícito a ser tratado separadamente.

### 9.4 Registro clínico

**Entidade:** `clinical_records`

Representa a ficha clínica individual e versionada, vinculada a:

- titular;
- profissional;
- organização contextual;
- versão e autoria.

A organização contextual não se torna dona do prontuário. A leitura e escrita dependem de autorização clínica específica.

Registros concluídos devem seguir a imutabilidade e o histórico definidos pelo domínio. Reabertura, quando permitida, deve produzir nova versão ou evento rastreável.

### 9.5 Plano de cuidado

**Entidade:** `care_plans`

Representa um plano clínico individual elaborado por profissional autorizado para um titular.

Fonte de verdade para:

- objetivo geral;
- ciclo de vida clínico;
- datas de início, meta e reavaliação;
- vínculo com registro clínico;
- autoria e versão.

Regras canônicas:

- no máximo um plano aberto por organização, profissional e titular;
- plano aberto possui estado `planejado` ou `em_andamento`;
- plano concluído ou suspenso é imutável;
- alteração exige incremento de versão;
- chaves de escopo são imutáveis.

### 9.6 Ação do plano de cuidado

**Entidade:** `care_plan_actions`

Representa uma ação clínica pertencente a um plano e herda seu contexto de organização, titular e profissional.

Não é a mesma entidade que `action_plans`, do domínio coletivo.

### 9.7 Evento do plano de cuidado

**Entidade:** `care_plan_events`

Representa o histórico append-only de criação, atualização, evolução, reavaliação e mudança de estado do plano ou de suas ações.

É fonte de verdade para a trilha temporal do plano, sem substituir o estado corrente armazenado no cabeçalho.

## 10. Domínio coletivo e institucional

### 10.1 Campanha

**Entidade:** `campaigns`

Representa uma iniciativa institucional de comunicação, prevenção ou promoção de saúde.

Campanha não é atendimento clínico, prescrição nem plano individual.

Seu escopo pode ser:

- organizacional;
- todas as unidades elegíveis;
- unidades selecionadas.

A aplicabilidade deve ser explícita e coerente com a organização.

### 10.2 Audiência da campanha

**Entidade:** `campaign_audiences`

Representa a definição singular da audiência funcional da campanha. Não deve ser usada para armazenar listas individuais indevidas quando o objetivo é coletivo.

### 10.3 Plano de ação coletivo

**Entidade:** `action_plans`

Representa resposta gerencial a indicador, risco coletivo ou necessidade institucional.

Distingue-se de `care_plans` porque:

- não é prontuário;
- não é direcionado a um paciente individual;
- possui responsável operacional, prioridade, prazo e status gerencial;
- deve operar somente sobre dados coletivos autorizados.

### 10.4 Conteúdo educacional e notificação

- `educational_contents`: conteúdo informativo reutilizável.
- `notifications`: mensagem entregue a um usuário no contexto permitido.

Notificação é canal de comunicação; não é fonte de verdade clínica ou de consentimento.

## 11. Documentos e auditoria

### 11.1 Documento

**Entidade:** `documents`

Representa metadados de um arquivo pertencente ao titular e armazenado em storage privado.

O banco não deve guardar o binário como campo genérico. `storage_path` deve apontar para objeto protegido por política coerente com o domínio.

### 11.2 Evento de auditoria

**Entidade:** `audit_events`

Representa trilha transversal de ação, ator, origem, resultado, entidade e motivo.

Auditoria não substitui eventos específicos de domínio, como `care_plan_events`. Ela registra responsabilidade e operação transversal; o evento clínico registra significado clínico.

A persistência real e cobertura completa de auditoria ainda devem ser confirmadas em etapa específica do WP-02.

## 12. Relações canônicas principais

```text
organization
  ├── organization_units
  ├── user_organizations
  │     └── user_roles / user_profiles
  ├── consent_documents
  │     └── user_consents
  ├── assessment_versions
  │     ├── assessment_questions
  │     │     └── assessment_options
  │     └── assessments
  │           ├── assessment_responses
  │           └── risk_results
  ├── health_journeys
  │     └── journey_versions
  │           └── journey_steps
  │                 └── journey_activities
  ├── professional_assignments
  │     ├── appointments
  │     ├── clinical_records
  │     └── care_plans
  │           ├── care_plan_actions
  │           └── care_plan_events
  ├── campaigns
  │     └── campaign_audiences / scope bindings
  └── action_plans
```

O diagrama indica contexto e dependência funcional; não afirma que todas as relações são FKs físicas em todas as migrations.

## 13. Fontes de verdade

| Conceito | Fonte canônica atual |
|---|---|
| Organização | `organizations` |
| Unidade | `organization_units` |
| Conta autenticada | Supabase Auth / `auth.uid()` |
| Vínculo institucional | `user_organizations` |
| Papel autorizado | `roles` + bindings ativos |
| Termo de consentimento | `consent_documents` |
| Aceite/revogação | `user_consents` |
| Instrumento de avaliação | `assessment_versions` e filhos |
| Avaliação preenchida | `assessments` + `assessment_responses` |
| Jornada atribuída | `user_journeys` |
| Vínculo profissional-paciente | `professional_assignments` |
| Agendamento | `appointments` |
| Ficha clínica | `clinical_records` e histórico/versionamento aplicável |
| Plano clínico atual | `care_plans` |
| Histórico do plano clínico | `care_plan_events` |
| Campanha coletiva | `campaigns` |
| Plano gerencial coletivo | `action_plans` |
| Arquivo privado | storage + metadados em `documents` |
| Auditoria transversal | `audit_events` |

## 14. Termos que não podem ser usados como sinônimos

- usuário ≠ pessoa ≠ vínculo institucional;
- paciente ≠ colaborador ≠ conta autenticada;
- papel ≠ profissão;
- organização ≠ titular do prontuário;
- agendamento ≠ vínculo clínico;
- ficha clínica ≠ plano de cuidado;
- `care_plans` ≠ `action_plans`;
- evento de domínio ≠ log técnico;
- dado agregado ≠ autorização para detalhe individual;
- resultado de risco ≠ diagnóstico;
- correlação ≠ causalidade.

## 15. Regras para novas entidades

Toda proposta de nova entidade deve declarar:

1. conceito de negócio que representa;
2. fonte de verdade anterior, se houver;
3. razão pela qual tabela existente não é suficiente;
4. titularidade e classificação dos dados;
5. contexto de `organization_id` e `unit_id`;
6. chaves naturais e identificador técnico;
7. ciclo de vida e estratégia de exclusão;
8. versionamento e imutabilidade;
9. regras de autoria e auditoria;
10. RLS, grants e escopo de leitura/escrita;
11. impacto em analytics e reidentificação;
12. contrato para API, frontend e futura IA.

## 16. Gaps e decisões futuras

1. Criar ou não uma entidade canônica explícita de pessoa/titular.
2. Definir modelo de profissional com atributos cadastrais e validações além de `auth.uid()`.
3. Resolver `unit_id` na agenda e demais contextos clínicos onde for operacionalmente necessário.
4. Confirmar coerência entre `profiles`, `roles`, `user_profiles` e `user_roles` no schema final.
5. Formalizar catálogo de classificação de dados pessoais, sensíveis, clínicos e coletivos.
6. Confirmar persistência e cobertura de `audit_events` no runtime.
7. Definir contrato canônico para indicadores agregados após autorização do SUP-D02.
8. Regenerar tipos TypeScript a partir do schema final auditado.

## 17. Governança

Mudança de significado de qualquer entidade canônica exige:

- RFC ou ADR;
- análise de compatibilidade;
- migration quando aplicável;
- atualização deste documento;
- atualização dos contratos TypeScript e repositories;
- testes de autorização e integridade;
- revisão de impacto em LGPD, analytics e IA.

Nenhuma interface, repository ou agente de IA deve criar semântica paralela para um conceito já definido neste documento.
