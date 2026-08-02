# BIOMED HEALTH - Planejamento de Arquitetura Supabase (Sem Integracao)

## Escopo desta etapa

Este documento define o planejamento tecnico para a futura integracao com Supabase, mantendo:

- sem conexao local/cloud nesta fase;
- sem criacao de tabelas ou migrations nesta fase;
- sem alteracao de interfaces aprovadas;
- sem alteracao de regras clinicas;
- sem alteracao de dados demonstrativos mock;
- sem alteracao de guardas de acesso existentes.

## Decisoes arquitetonicas aprovadas (2026-07-29)

1. Usuario pode ter multiplos papeis por organizacao e por unidade.
   - JWT deve permanecer minimo.
   - Autorizacao efetiva deve ser validada por vinculos persistidos e RLS.
2. `organization_id` obrigatorio para dados **institucionais**.
   - `unit_id` obrigatorio apenas em entidades operacionais vinculadas a unidade.
3. Consentimento deve ser versionado, revogavel e auditavel.
   - texto juridico final depende de aprovacao humana e nao deve ser inventado em codigo.
4. Auditoria persistente deve usar RPC controlada.
   - sem escrita direta pelo cliente;
   - trilha append-only obrigatoria.
5. Indicadores gerenciais exigem agrupamento minimo de 10 individuos.
   - suprimir resultados abaixo do limiar;
   - prevenir reidentificacao por filtros combinados.

## Decisao ratificada complementar (2026-07-31) — escopo institucional/coletivo

Formaliza e delimita o item 2 acima. Detalhe de continuidade: `PROJECT_MASTER_HANDOFF.md` §6.1.

1. Modelo **hibrido** aplica-se ao dominio **institucional e de gestao coletiva**, nao como regra universal do BIOMED HEALTH.
2. Todo registro institucional/coletivo exige `organization_id`.
3. `unit_id` e obrigatorio quando houver recorte operacional por unidade; validar unit ∈ organization.
4. Nesse dominio, `unit_id = null` significa **somente** escopo organizacional explicito — nunca unidade esquecida, contexto desconhecido, falha de selecao, ausencia acidental, fallback de autorizacao ou ampliação de permissao.
5. A especificação futura do SUP-D01 deverá tornar o escopo coletivo **explicito no contrato** (sem depender apenas de inferencia por `null`); a forma tecnica desse contrato sera definida nessa especificação — **nao** nesta ratificação.
6. Limiar >= 10 no recorte efetivo apos todos os filtros; sem contorno por cruzamentos/exportacoes. O limiar **nao** impede atendimento clinico autorizado.
7. Usuario unit-scoped pode visualizar campanhas organizacionais aplicaveis a sua unidade sob vinculo/papel validos, sem acesso a outras units nem a dados individuais indevidos.
8. `organization_id` **nao** e obrigatorio para conta pessoal, jornada/historico pessoal, atendimento particular/assistencial independente, titularidade do paciente ou futuras operacoes B2C desvinculadas de organizacao.
9. Organizacao patrocinadora/sediante **nao** se torna proprietaria do prontuario pessoal.
10. O BIOMED HEALTH e ecossistema modular (Minha BioMed, Clinica, Gestao, Ocupacional, Intelligence); Gestao coletiva nao e a finalidade exclusiva do produto.
11. SUP-D01: **desbloqueado somente para especificação futura**; **implementacao nao autorizada** nesta etapa.

---

## 1) Entidades e relacionamentos necessarios

Baseado no estado atual (`DATA_MODEL.md`, migrations existentes e regras em producao mock), o modelo alvo permanece organizado por dominios:

### 1.1 Organizacao e acesso

- `organizations`
- `organization_units`
- `profiles`
- `roles`
- `permissions`
- `user_organizations`
- `user_roles`

Relacoes-chave:

- uma `organization` possui muitas `organization_units`;
- um usuario pode pertencer a uma ou mais organizacoes via `user_organizations`;
- papeis efetivos sao resolvidos por `user_roles` dentro do contexto organizacional.

### 1.2 Consentimento e LGPD

- `consent_documents` (versionado)
- `user_consents` (aceite/revogacao por usuario e contexto)

Relacoes-chave:

- um documento de consentimento pode ter muitos registros de aceite/revogacao;
- consentimento sempre vinculado a `organization_id` e `user_id`.

### 1.3 Avaliacao e risco orientativo

- `assessment_versions`
- `assessment_questions`
- `assessment_options`
- `assessments`
- `assessment_responses`
- `risk_rules`
- `risk_results`

Relacoes-chave:

- questionario e versoes separados da instancia preenchida;
- `risk_results` vinculados a `assessments` para rastreabilidade explicavel.

### 1.4 Jornada preventiva

- `health_journeys`
- `journey_versions`
- `journey_steps`
- `journey_activities`
- `user_journeys`
- `user_activity_progress`

Relacoes-chave:

- jornada versionada para permitir evolucao sem apagar historico;
- progresso individual por atividade.

### 1.5 Agenda, vinculo e cuidado clinico

- `appointments`
- `professional_assignments`
- `clinical_records`
- `care_plans`
- `care_plan_actions`

Relacoes-chave:

- vinculo profissional-usuario formal em `professional_assignments`;
- dados clinicos e plano de cuidado sempre associados a profissional + usuario + organizacao.

### 1.6 Gestao coletiva

- `campaigns`
- `campaign_audiences`
- `action_plans`
- `educational_contents`
- `notifications`

Relacoes-chave:

- dados gerenciais sem exposicao nominal de usuarios;
- tabelas de gestao restritas por organizacao e por perfil gerencial.

### 1.7 Documentos e auditoria

- `documents`
- `audit_events`

Relacoes-chave:

- `documents` guarda metadados de storage privado;
- `audit_events` guarda trilha de eventos com contexto de ator, acao e resultado.

---

## 2) Separacao entre organizacao, unidade, usuarios e vinculos

### 2.1 Isolamento organizacional (tenant)

Dados **institucionais e coletivos** devem carregar `organization_id` e operar com:

- filtro por organizacao na aplicacao (use-cases/repositorios);
- filtro por organizacao no banco (RLS obrigatoria).

Dados **pessoais ou assistenciais independentes** possuem titularidade e regras proprias; **nao** exigem `organization_id` como obrigatoriedade universal do produto.

Quando um registro individual se originar de programa institucional, o vinculo organizacional/unidade de origem **nao** transfere a titularidade do prontuario pessoal a organizacao patrocinadora.

### 2.2 Unidade organizacional

`organization_units` define escopo operacional para agenda, campanhas e indicadores **no dominio institucional**.
Decisao ratificada (2026-07-31): no dominio coletivo/institucional, `organization_id` obrigatorio; `unit_id` obrigatorio somente quando houver recorte por unidade; `null` = escopo organizacional explicito (nunca ausencia acidental nem ampliação de acesso).
**Estado implementado:** `unit_id` ainda ausente em `appointments` / `campaigns` / `action_plans` (gap clinico C01 paralelo; evolucao coletiva depende de especificação/implementação futuras do SUP-D01, ainda nao autorizadas).
**Nao confundir:** obrigatoriedade institucional **nao** se estende como regra universal a dados pessoais/B2C.

### 2.3 Usuario e vinculo

- identidade tecnica: Supabase Auth (`auth.users`);
- identidade de negocio: `user_organizations` + `user_roles`;
- vinculo assistencial: `professional_assignments`.
- um mesmo usuario pode acumular multiplos papeis por organizacao/unidade, com resolucao efetiva por vinculos persistidos.

Regra central: profissional so acessa usuario com vinculo ativo.

---

## 3) Autenticacao e perfis

## 3.1 Estado atual

- autenticacao mock em `AuthContext`;
- guardas por perfil em `RequireRole`;
- rota inicial por perfil via `getRoleHomePath`;
- segregacao profissional-usuario via `canProfessionalAccessUser`.

## 3.2 Estado planejado (futuro)

- troca progressiva para sessao Supabase Auth;
- claims JWT minimas, priorizando identificacao de usuario e tenant sem expandir regras de autorizacao no token;
- politica de "deny by default" para acesso a dados.
- autorizacao efetiva validada em vinculos persistidos (`user_organizations`, `user_roles`, `professional_assignments`) + RLS.

Perfis mantidos:

- `usuario`
- `medico`
- `profissional_saude`
- `gestor_clinico`
- `gestor_institucional`
- `sst`
- `admin_cliente`
- `admin_biomed`
- `auditor`

---

## 4) Matriz de permissoes (resumo tecnico)

Referenciada de `PERMISSIONS_MATRIX.md`:

- `usuario`: apenas dados proprios;
- `medico`/`profissional_saude`: acesso clinico somente aos vinculados;
- `gestor_clinico`: supervisao clinica no tenant;
- `gestor_institucional`/`sst`: apenas agregado (sem dado clinico individual);
- `admin_cliente`: operacional gerencial, sem acesso clinico automatico;
- `admin_biomed`: administrativo autorizado por escopo;
- `auditor`: somente leitura.

Todos os cenarios devem ser protegidos em:

1. guardas e casos de uso na aplicacao;
2. RLS no banco.

---

## 5) Politicas RLS necessarias

Planejamento de politica por categoria:

### 5.1 Basicas obrigatorias

- isolamento por `organization_id` em tabelas institucionais/coletivas sensiveis;
- ownership para dados pessoais (`user_id = auth.uid()` onde aplicavel), sem exigir organizacao como regra universal;
- politicas especificas por papel para leitura/escrita.

### 5.2 Clinicas

- leitura/escrita em `clinical_records` e `care_plans` apenas para:
  - `gestor_clinico`;
  - profissional com vinculo ativo em `professional_assignments`;
- negar por padrao para perfis gerenciais institucionais.

### 5.3 Gestao coletiva

- `campaigns` e `action_plans` para perfis gerenciais permitidos;
- proibicao explicita de retorno individualizado em queries de gestao;
- limiar minimo de 10 individuos por agrupamento;
- supressao de resultados abaixo do limiar;
- prevencao de reidentificacao por combinacao de filtros.

### 5.4 Auditoria

- `audit_events`: leitura para `auditor` e escopos administrativos autorizados;
- escrita exclusivamente via RPC controlada;
- sem escrita direta pelo cliente;
- append-only (sem update/delete por app user).

### 5.5 Escrita controlada

- `WITH CHECK` alinhado a `USING` para impedir escrita fora do escopo organizacional;
- politicas separadas para `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

---

## 6) Segregacao por ambiente de produto

## 6.1 Minha BioMed

- leitura/escrita somente de dados do proprio usuario;
- consentimento, jornada, atividades e agenda dentro do proprio escopo.

## 6.2 BioMed Clinica

- acesso a carteira de vinculados;
- acesso clinico detalhado somente com vinculo ativo;
- nao vinculados nao aparecem na listagem.

## 6.3 BioMed Gestao

- apenas agregado/coletivo;
- sem drill-down nominal;
- sem acesso a ficha clinica individual;
- modulo do ecossistema — nao finalidade exclusiva do BIOMED HEALTH;
- limiar >=10 no recorte efetivo (enforcement detalhado em tickets futuros de gestao/indicadores).

---

## 7) Estrutura planejada da ficha clinica e plano de cuidado

## 7.1 Ficha clinica (modular)

Manter estrutura orientada a secoes:

- identificacao e contexto;
- motivo do acompanhamento;
- habitos/rotina/sono/movimento/alimentacao percebida/bem-estar;
- antecedentes informados, alergias, medicamentos informados;
- sinais/medidas demonstrativas;
- avaliacao profissional orientativa;
- conduta orientativa e plano de acompanhamento;
- metadados de versao/autoria/atualizacao.

Planejamento de persistencia:

- cabecalho em `clinical_records`;
- blocos extensos em colunas text/jsonb com esquema controlado e validado;
- historico de revisoes em tabela de versoes clinicas (migracao futura dedicada).

## 7.2 Plano de cuidado

Persistencia alvo:

- `care_plans` (cabecalho por usuario/profissional)
- `care_plan_actions` (itens por objetivo/acao/frequencia/prazo/status/reavaliacao)

Status previstos:

- `planejado`, `em_andamento`, `concluido`, `suspenso`

---

## 8) Consentimentos e bases legais LGPD

Dados minimos por documento (`consent_documents`):

- finalidade;
- base legal;
- versao;
- vigencia;
- linguagem clara em PT-BR.

Dados minimos por aceite (`user_consents`):

- usuario + organizacao;
- documento/versionamento;
- `accepted_at`, `revoked_at`, origem e evidencia.

Fluxos obrigatorios futuros:

- aceite, consulta, revogacao;
- solicitacao de exportacao e correcao;
- eventos de auditoria para operacoes LGPD relevantes.
- texto juridico definitivo permanece pendente de aprovacao humana.

---

## 9) Trilha de auditoria imutavel

## 9.1 Requisitos

- registrar login, logout, negacao de acesso, leitura sensivel, alteracoes, consentimentos;
- evitar dados clinicos completos em log;
- incluir contexto minimo:
  - `actor_user_id`
  - `organization_id`
  - `actor_role`
  - `action`
  - `entity`
  - `entity_id`
  - `origin`
  - `result`
  - `reason`
  - `created_at`

## 9.2 Imutabilidade (planejada)

- tabela append-only para app user;
- bloquear `UPDATE/DELETE` via RLS e privilegios;
- escrita via funcao controlada quando necessario;
- retention e export para trilhas reguladas (fase posterior).

---

## 10) Estrategia de substituicao gradual dos mocks

## 10.1 Principio

Substituir repositório por repositório, sem alterar contrato das telas.

## 10.2 Sequencia sugerida

1. Autenticacao/sessao (provider hibrido)
2. Entidades de organizacao e perfil
3. Agenda e vinculos profissionais
4. Jornada e atividades
5. Avaliacao/risco
6. Clinico (ficha/plano/registros)
7. Gestao agregada
8. Auditoria persistente

## 10.3 Modo hibrido por feature flag

- manter `VITE_ENABLE_SUPABASE_AUTH=false` por padrao;
- habilitacao progressiva por modulo/ambiente de homologacao;
- fallback mock para demonstracao quando necessario.

---

## 11) Migrations previstas (somente planejamento)

Observacao: sem criar arquivos nesta etapa.

Ordem planejada:

1. **base-auth-org**: organizacoes, unidades, user_organizations, roles, permissions, user_roles
2. **consent-privacy**: consent_documents, user_consents
3. **assessment-risk**: versoes, perguntas, respostas, regras e resultados
4. **journey-progress**: jornada versionada e progresso
5. **clinical-core**: appointments, assignments, clinical_records, care_plans, care_plan_actions
6. **management-collective**: campaigns, audiences, action_plans, educational_contents
7. **audit-docs**: documents, audit_events
8. **rls-policies**: politicas completas por papel/tenant/ownership/vinculo
9. **indexes-hardening**: indices, constraints, funcoes utilitarias e auditoria

---

## 12) Testes de seguranca e bloqueio de acesso cruzado

## 12.1 Casos obrigatorios

- usuario A nao le usuario B;
- profissional sem vinculo nao le dado clinico;
- organizacao A nao acessa organizacao B;
- gestor institucional nao le ficha clinica;
- admin cliente nao ganha acesso clinico implicito;
- auditor nao altera dados;
- URL direta sem permissao deve negar.

## 12.2 Niveis de teste

- unitario: regras de autorizacao;
- integracao: repositorios + politicas de dominio;
- E2E: navegacao protegida e bloqueios funcionais;
- SQL/RLS tests: consultas permitidas e negadas por perfil/tenant.

---

## 13) Riscos tecnicos e decisoes que exigem aprovacao

## 13.1 Riscos

- divergencia entre regra de frontend e RLS de banco;
- complexidade de claims JWT para usuarios multi-organizacao;
- risco de regressao ao trocar mock por repositorio real sem contrato unico;
- consultas agregadas de gestao com risco de reidentificacao se grupo pequeno;
- crescimento de complexidade da ficha clinica sem versionamento formal.

## 13.2 Decisoes pendentes de aprovacao

1. **Modelo da ficha clinica**: estrutura relacional expandida vs. bloco estruturado versionado.
2. **Plano de rollout**: feature flags por modulo ou por tenant piloto.
3. **Texto juridico final dos consentimentos**: validacao humana obrigatoria antes de producao.

---

## 14) Proposta objetiva de fases de implementacao (proxima etapa, apos aprovacao)

### Fase A - Fundacao de acesso e tenant

- Supabase Auth + organizacao + roles + user_organizations + RLS basica.

### Fase B - Dominio preventivo do usuario

- consentimento versionado + avaliacao + jornada + progresso.

### Fase C - Dominio clinico com vinculo

- assignments + agenda + ficha/plano/registros com RLS clinica restritiva.

### Fase D - Gestao agregada segura

- campanhas, planos de acao e indicadores coletivos com bloqueio nominal.

### Fase E - Auditoria persistente e endurecimento

- trilha imutavel, testes SQL de negacao e hardening final.

### Criterio de saida de cada fase

- lint/typecheck/testes locais aprovados;
- testes de autorizacao e negacao aprovados;
- sem regressao visual das telas aprovadas;
- sem uso de dados reais.

---

## Adendo de continuidade (2026-08-01) — SUP-D02

Este documento permanece o registro **historico** das decisoes de 2026-07-29/31 (incluindo limiar >= 10 e gestao apenas agregada).

**Estado corrente do projeto:** consultar `PROJECT_MASTER_HANDOFF.md` e `SUPABASE_IMPLEMENTATION_BACKLOG.md`.

**SUP-D01:** ciclo A/B/C/D implementado em `main` (nao reler o item 11 de 2026-07-31 como bloqueio atual de implementacao do D01).

**SUP-D02:** especificacao tecnica em `SUP_D02_TECHNICAL_SPECIFICATION.md` (planejamento autorizado). **Implementacao do D02 nao iniciada e nao autorizada** por este adendo.

---

## Adendo de continuidade (2026-08-02) — Gate D02-0

Registro **aditivo** (nao reescreve decisoes historicas de 2026-07-29/31).

**Documento canônico das decisoes propostas:** `SUP_D02_GATE_D02_0_DECISIONS.md` (status **PROPOSTO — PENDENTE DE AUDITORIA INDEPENDENTE E MERGE**).

**Baseline:** `origin/main` = `547c60c992c64b9f9038db1029734c3b9c9ec93e` (PR #27 mergeado).

**Propostas do Gate (nao sao implementacao):** RPC `SECURITY DEFINER` endurecida; deny de SELECT bruto gerencial em `risk_results`; catalogo piloto fechado; escopo `organization` apenas; contrato cliente sem `n`; anti-diferencial; auditoria minima; **fail-closed** se a auditoria nao persistir; ordem futura D02-0.9.

**Explicitamente nao autorizado por este adendo:** D02-A, SQL/migration/policy, UI, SUP-D03, Fase E, acesso ao Supabase remoto.

**Estado corrente:** consultar `PROJECT_MASTER_HANDOFF.md` e o documento do Gate.

