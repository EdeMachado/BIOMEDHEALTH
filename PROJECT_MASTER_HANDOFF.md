# BIOMED HEALTH — Documento Mestre de Continuidade (Handoff)

## 1. Finalidade e regra de atualização

Este documento é a **fonte oficial de continuidade e governança** do projeto BIOMED HEALTH.

- Registra baseline, status de fases/tickets, decisões consolidadas, riscos e sequência de retomada.
- Deve ser atualizado a cada marco mergeado em `main` (PR relevante) ou decisão estrutural aprovada.
- **Não substitui** o backlog técnico detalhado: o detalhamento de escopo, RLS, testes e critérios por ticket permanece em `SUPABASE_IMPLEMENTATION_BACKLOG.md`.
- Evitar duplicação integral de tickets aqui; preferir sumário + ponteiros.

## 2. Baseline atual

| Item | Valor |
|---|---|
| Repositório | `EdeMachado/BIOMEDHEALTH` |
| Branch de referência | `main` |
| **Architecture Baseline** | **v1.0** — `docs/ARCHITECTURE_BASELINE_v1.md` (**FASE I Foundation ENCERRADA**) |
| **Engineering Book** | `docs/BIOMED_HEALTH_ENGINEERING_BOOK_v1.md` (índice de entrada; não substitui este handoff) |
| Baseline oficial `origin/main` | `ee0eff64d5ccec04314dd52f1b795fe55e8aaa3c` (merge **PR #54** WP-04.3) |
| Baseline anterior (closeout WP-04.2) | `a21a184174bb901de3199a1051705bd59dd1b9da` (PR #53) |
| Baseline Trust & Audit funcional | `cc6252059ce7746b0369f892c445c74860bf1481` (merge **PR #52** WP-04.2) |
| Baseline funcional WP-04.1 | `cb61981ccf30c6f765431fab536dbeb17e3bf114` (PR #50) |
| Último merge integrado | **PR #54** — WP-04.3 E01 Residual Closure |
| HML Supabase | `biomedhealth-hml` sincronizado até **0022** (0001–0022) — WP-04.3 **sem** migration / **sem** apply |
| Change set em curso | **Closeout documental WP-04.3** → próximo recomendado: gap clínico `unit_id`; **D02-A BLOCKED** |
| Data desta atualização do handoff | 2026-08-06 |
| Ratificação org×unit (coletivo) | PR #17 — decisão documental |
| SPEC SUP-D01 | Aprovada; ciclo **A/B/C/D** em `main` (PRs #20–#24; docs #23/#26) |
| SPEC SUP-D02 / Gate | SPEC + Gate D02-0 documentais em `main`; **implementação D02-A não autorizada** (**permanece BLOCKED**) |
| WP-03.1 | Domínio coletivo + bootstrap application (PRs #45–#47) — **DONE** |
| WP-03.2 | Endurecimento operacional — **DONE** (PR #48 + HML 0020) |
| WP-04.0 | Architecture Baseline v1.0 — **DONE** (PR #49) |
| WP-04.1 | Platform Readiness — **DONE** (PR #50 + HML 0021) |
| WP-04.2 | Trust & Audit Layer — **DONE** (PR #52 + HML 0022; closeout #53) |
| WP-04.3 | E01 Residual Closure — **DONE** (PR #54 `ee0eff6…`; sem migration; sem HML; E01 **não** 100%) |
| ADRs oficiais | `docs/adr/ADR-001`…`008`; operacionais `010`…`013` |
| Roadmap / WP Status / Métricas | `docs/ROADMAP.md`, `docs/WP_STATUS.md`, `docs/PLATFORM_METRICS.md` |

## 3. Propósito do BIOMED HEALTH e módulos

O BIOMED HEALTH é um **ecossistema modular de saúde**. A gestão coletiva é um módulo, **não** a finalidade exclusiva do produto.

| Módulo | Finalidade |
|---|---|
| **Minha BioMed** | Experiência e jornada individual |
| **BioMed Clínica** | Cuidado e acompanhamento assistencial |
| **BioMed Gestão** | Saúde coletiva e programas institucionais |
| **BioMed Ocupacional** | Saúde corporativa e ocupacional (evolução) |
| **BioMed Intelligence** | Análises e apoio à decisão (evolução) |

### Minha BioMed (usuário)

Consentimento versionado, avaliação inicial orientativa, jornada/atividades/progresso, perfil e privacidade. Titularidade do usuário; **não** exige organização como regra universal para funcionalidades pessoais independentes / futuras B2C.

### BioMed Clínica (profissional)

Carteira por vínculo ativo, agenda, leitura de jornada vinculada, ficha clínica modular versionada, plano de cuidado e evoluções. Isolamento por organização + assignment quando o contexto for institucional; gestão institucional sem acesso clínico nominal. Organização patrocinadora **não** se torna proprietária do prontuário pessoal.

### BioMed Gestão (institucional / coletivo)

Painéis, campanhas, indicadores e planos coletivos. **Somente agregado**; limiar interno 10 (**necessário, não suficiente**). D01 em `main`. Overview/indicadores **demo** até liberação autorizada do D02. Fontes: SPEC D02 + `SUP_D02_GATE_D02_0_DECISIONS.md` (**Gate D02-0 documentalmente reauditatado e aprovado com P3**; desenho proposto / especificado; Gate de implementação não liberado). Piloto: `organization`; bandas; sem `empty`/contagem exata; P05 diferido; rejeitar `unitId`/`unitIds`. Anti-diff, auditoria e **fail-closed** antes da exposição. Privilégio proposto: DEFINER endurecida. Implementação D02 **não** iniciada. Issue **#25** isolada.

## 4. Documentos canônicos

| Documento | Finalidade |
|---|---|
| `PROJECT_MASTER_HANDOFF.md` (este) | Continuidade, status, decisões, retomada |
| `docs/ARCHITECTURE_BASELINE_v1.md` | Arquitetura oficial pós-Foundation |
| `docs/BIOMED_HEALTH_ENGINEERING_BOOK_v1.md` | Engineering Book v1 — índice de entrada |
| `docs/adr/ADR-001`…`008` | Decisões arquitetônicas canônicas |
| `docs/ROADMAP.md` / `docs/WP_STATUS.md` | Roadmap e status de WPs |
| `docs/PLATFORM_METRICS.md` | Métricas de maturidade |
| `SUPABASE_IMPLEMENTATION_BACKLOG.md` | Backlog técnico detalhado (tickets SUP-*) |
| `SUPABASE_ARCHITECTURE_PLANNING.md` | Decisões arquitetônicas Supabase (histórico + adendo de continuidade) |
| `SUP_D01_TECHNICAL_SPECIFICATION.md` | SPEC gestão coletiva / escopo (D01) |
| `SUP_D02_TECHNICAL_SPECIFICATION.md` | SPEC indicadores agregados / limiar / anti-drilldown (planejamento; impl. não autorizada) |
| `SUP_D02_GATE_D02_0_DECISIONS.md` | Decisões canônicas do Gate D02-0 (**documentalmente reauditatado e aprovado com P3**; não autoriza D02-A) |
| `IMPLEMENTATION_PLAN.md` | Plano MVP Demo 1 (legado complementar) |
| `ARCHITECTURE.md` / `DATA_MODEL.md` | Fundação demo e modelo |
| `PERMISSIONS_MATRIX.md` / `SECURITY_CHECKLIST.md` | Permissões e checklist |
| `README.md` | Execução local |
| `.env.example` | Flags e defaults (comentários operacionais) |

## 5. Arquitetura vigente (sumário)

- Frontend: React + TypeScript + Vite (`apps/web`); repositórios dual-mode mock/supabase.
- Auth: híbrida via `VITE_ENABLE_SUPABASE_AUTH` + factory de access (módulo access **fora** do escopo das fatias clínicas C04.2*).
- Clínica: modos por módulo (C04.1); instrumentação + política de fallback **deny-by-default** (C04.2a); **sem** troca dinâmica para mock.
- SQLSTATE `42501` clínico → `CROSS_TENANT_DATA` / `authorization` / `transient: false` (PR #15).
- RLS e migrations em `supabase/`; validação Postgres descartável documentada em tickets.

## 6. Decisões estruturais consolidadas

1. Multi-papel por organização/unidade; JWT mínimo; autorização por vínculos + RLS.
2. **Decisão ratificada (domínio institucional/coletivo — híbrido):** ver §6.1. **Não** é regra universal de todo o produto.
3. Consentimento versionado/revogável; texto jurídico final pendente de aprovação humana.
4. Auditoria append-only via RPC (E01 operacional com residuais controlados; **não** 100% — ver WP-04.3).
5. Indicadores gerenciais: grupo mínimo 10 no recorte efetivo; anti-reidentificação (sem contorno por filtros/exportações).
6. Substituição gradual mock→real por módulo, sem big-bang.
7. **Fallback clínico runtime com fixture mock, coleção vazia como sucesso, ou escrita fictícia: PROIBIDO** (ver §8).
8. Separação titularidade: dado pessoal/clínico ≠ vínculo institucional ≠ agregado coletivo.

### 6.1 Decisão ratificada — organização × unidade (escopo limitado)

**Aplicação:** exclusivamente domínio **institucional e de gestão coletiva** (BioMed Gestão / programas institucionais / inteligência populacional derivada).

| Regra | Definição |
|---|---|
| `organization_id` | Obrigatório em todo registro institucional ou de gestão coletiva |
| `unit_id` | Obrigatório quando houver recorte operacional específico por unidade |
| `unit_id = null` | Significa **somente** escopo organizacional **explícito** nesse domínio |
| Proibições de `null` | Não pode significar unidade esquecida, contexto desconhecido, falha de seleção, ausência acidental de vínculo, fallback de autorização ou ampliação de permissões |
| Validação | Se houver `unit_id`, a unidade deve pertencer ao `organization_id` informado |
| Limiar | Relatórios/indicadores coletivos: ≥ **10** pessoas no recorte efetivo após todos os filtros; sem contorno por cruzamentos/exportações |
| Visibilidade | Usuário unit-scoped pode ver campanhas org aplicáveis à sua unidade (vínculo válido, papel compatível, sem dados individuais indevidos, sem outras units, agregados com limiar) |

**Limitação expressa:** esta decisão **não** torna `organization_id` obrigatório para conta pessoal, cadastro independente, jornada/histórico pessoal, preventivo individual, atendimento clínico particular ou assistencial independente, registros de titularidade do paciente, ou futuras operações B2C desvinculadas de organização. Esses domínios têm regras próprias de titularidade, vínculo, consentimento, finalidade, portabilidade, continuidade, compartilhamento, autorização e auditoria.

**Estado implementado (não confundir com a decisão):** schema atual exige `organization_id` em muitas tabelas MVP; `unit_id` em bindings de access e, no D01-B, em campanhas/planos coletivos conforme `scope_type`. Gap clínico C01 (agenda sem `unit_id`) permanece dívida **paralela**.

**SUP-D01:** SPEC aprovada (PR #19). Ciclo técnico **D01-A/B/C/D concluído e integrado em `main`**. **D01-A** (PR #20). **D01-B** (PR #21) — migration `0017` + RLS/constraints; B1 corrigido. **D01-C** (PR #22, merge `907f3ed…`, HEAD `4079287…`) — repositories + UI campanhas/planos; consolidação documental pós-merge **PR #23** (`b32aa12…`, baseline de partida do PR #24). **D01-D** (PR #24, merge `00b7b3f…`, HEAD auditado `ebfd700…`) — migration `0018` + seis RPCs atômicas; consolidação documental **PR #26** (`89de7ab…`). Sem fallback Supabase→mock; AuthContext/guards/rotas/`selectedUnitId` intactos; C01/B04 fora; C04.2b encerrada.

**SUP-D02:** SPEC integrada via PR #27 (`547c60c…` — base histórica do PR #28). Gate D02-0: PR #28 **mergeado** (`b04b4b9…`); HEAD corretivo `f9a4ca5…` (B1–B6/P05); 1ª auditoria histórica **reprovou**; reauditoria SUP-D02-G0-RA **aprovada com P3** (2026-08-03); nenhum review formal no GitHub no momento auditado. Status: **Gate D02-0 documentalmente reauditatado e aprovado com P3**; desenho **proposto / especificado**; **Gate de implementação não liberado**; **D02-A não autorizado** (critério 14). Contrato canônico: bandas; `support_n` interno; sem `empty`/contagem exata; P05 diferido. **Implementação não iniciada / não autorizada.**

**Ambiente HML (PROJECT-HML):** `biomedhealth-hml` com migrations **`0001`–`0022`** aplicadas e alinhadas ao repositório (0022 em 2026-08-06 pós PR #52; backup + dry-run + validação + inventário remoto). WP-04.3 **não** cria migration nem autoriza apply HML. Seed demo **não** é pré-requisito de produção. A sincronização HML **não** autoriza D02-A.

**Auditoria independente do PR #24 (HEAD `ebfd700…`):** veredito **B**; nenhum P1/P2; nenhum achado bloqueante; prova concorrente (duas sessões) aprovada; rollback e reaplicação da `0018` aprovados; validação SQL D01-D aprovada. **Único P3 residual** (não bloqueante): mensagem de sucesso residual após falha de close/delete na UI coletiva — rastreado na issue **#25** (aberta; follow-up isolado).

**Auditoria independente pós-correção do PR #22 (HEAD `4079287…` — histórico):** veredito **B**, sem P0/P1/P2; quatro achados anteriores corrigidos. **P3 de teste (D01-C) — encerradas pelos testes do D01-D:** (1) suíte de integração `ManagementActionPlanPage`; (2) assert negativo de ausência de mensagem de sucesso após falha de create; (3) cobertura Vitest de `NO_ACTIVE_MEMBERSHIP` no repository coletivo. Não confundir com a issue #25 (P3 distinto, pós-auditoria do #24).

**Evidência histórica do merge D01-C (auditoria do HEAD `4079287…`):** typecheck PASS; lint PASS; unitários 269; integração 81; collective específico 55; build PASS; migrations `0001`–`0017` + validação D01-B + regressão B1 PASS. **Não** executados naquela auditoria: Supabase remoto; Playwright/E2E; CI do GitHub (sem checks publicados no PR).

## 7. Status das fases SUP-A … SUP-E

| Fase | Status | Notas |
|---|---|---|
| A — Acesso/tenant | Entregue na prática (A01–A04 via PRs de auth/access) | Detalhe fino no backlog |
| B — Preventivo | Parcial | B01–B03 (+ filhas) entregues; **B04 aberto** (não iniciado) |
| C — Clínico | Parcial | C01.1/C01.2, C02, C03 entregues; C01 parent com gap `unit_id`; C04 parcial (ver §8) |
| D — Gestão agregada | Parcial | D01 em main; SPEC D02 + Gate em main (PR #27/#28); Gate reauditatado com P3; impl. D02 não iniciada; critério 14 impede D02-A; D03 não iniciado |
| E — Auditoria/hardening | Parcial | WP-04.2 + WP-04.3 **DONE**; E01 **não** 100% (pré-auth Supabase / RLS same-txn / LGPD jurídica); E02 aberto |

## 8. Tickets e fatias C04 — status consolidado

### Concluídos / integrados (evidência Git)

| Item | Evidência |
|---|---|
| SUP-B03.2 | PR #6 mergeado — `d8399ca…` |
| SUP-C01.1 | PR #7 — `00ccd8b…` |
| SUP-C01.2 | PR #8 — `e2bf19c…` |
| SUP-C02 | PR #9 — `2ab6546…` |
| SUP-C03 | PR #10 (+ hardening #11/#12) — base `eac8685…` / follow-ups |
| **SUP-C04.1** | **PR #13 MERGED** — `69cb165…` (modos por módulo) |
| **SUP-C04.2a** | **PR #14 MERGED** — `ca624915…` (observabilidade + deny-by-default) |
| **Normalização PostgreSQL 42501** | **PR #15 MERGED** — `0f3f666…` (histórico; baseline atual de `main` é o merge do PR #16) |

### Classificação canônica pós-PR #15

PostgreSQL/PostgREST `42501` nos repositories clínicos →:

- `errorCode`: `CROSS_TENANT_DATA`
- `errorKind`: `authorization`
- `transient`: `false`

Inelegível a qualquer fallback de dados.

### SUP-C04.2b

**ENCERRADA SEM IMPLEMENTAÇÃO — bloqueio arquitetural comprovado.**

- Encerramento **não** significa entrega de switch mock.
- Fixtures mock **não** são fonte clínica secundária confiável.
- **Proibido:** retornar fixture mock como fallback clínico runtime.
- **Proibido:** retornar coleção vazia / `null` / objeto vazio como “sucesso degradado”.
- **Proibido:** escrita fictícia ou falsa percepção de persistência.
- Inelegíveis: autorização, `CROSS_TENANT_DATA`, `42501`, erros de domínio, erros não transitórios.
- **Nenhuma** troca dinâmica para mock existe ou deve ser ativada no baseline atual.
- Módulo **access** permanece fora do escopo destas fatias.

**Retomada futura somente após:**

1. cache seguro de dados reais (tenant/usuário/paciente, integridade, TTL, invalidação, indicação visual de stale); **ou**
2. estado degradado explícito, com contrato **e** UX próprios.

### Pai SUP-C04

**Parcial / residual:** C04.1 + C04.2a + normalização 42501 entregues; C04.2b encerrada sem implementação; rollout clínico progressivo e página demo `/clinica/registros` fora do escopo C04.1 permanecem limitações/residuais. **Não** marcar o pai como integralmente implementado.

### Abertos / condicionados / gaps

| Item | Estado |
|---|---|
| SUP-B04 | Aberto — revisar linguagem/mecanismos de fallback inseguro antes de executar |
| SUP-C01 `unit_id` | Gap residual clínico **paralelo** (não bloqueia D01) |
| SUP-D01 | Ciclo **A/B/C/D** concluído em `main` (PRs #20–#24; docs #23/#26 `89de7ab…`); P3 residual UI issue **#25** (aberta) |
| SUP-D02…D03 | **D02:** Gate documental; D02-A **BLOCKED**; inventário remoto HML Trust/Audit atualizado pós-0022; A1–A3 como aceite futuro. **D03:** não iniciado |
| SUP-E01…E03 | E01 **parcial / WP-04.2 DONE** (HML 0022; residuais documentados; **não** 100%); E02–E03 abertos |
| Decisões humanas (jurídico/clínico/retention/rollout) | Pendentes (seção backlog) |

## 9. PRs relevantes (clínica / C04)

| PR | Título resumido | Estado |
|---|---|---|
| #6 | Leitura clínica jornada | MERGED |
| #7 | Carteira clínica | MERGED |
| #8 | Agenda clínica | MERGED |
| #9 | Ficha clínica versionada | MERGED |
| #10–#12 | Plano de cuidado + hardening | MERGED |
| #13 | SUP-C04.1 modos por módulo | MERGED |
| #14 | SUP-C04.2a observabilidade / deny-by-default | MERGED |
| #15 | Normalização 42501 (pré-condição; não é C04.2b) | MERGED |

## 10. Riscos e limitações conhecidas

- Backlog esteve desatualizado em status (corrigido nesta consolidação documental).
- Ausência prévia de Documento Mestre versionado.
- Mock demo inadequado como secundário clínico sob falha transitória.
- Gap `unit_id` em entidades operacionais clínicas.
- Decisões clínicas provisórias (ficha/plano) sujeitas a revisão humana.
- Texto jurídico de consentimento pendente.
- Suite de auditoria persistente (E01) **melhorada** e **operacional no HML** sob WP-04.2 (**DONE** com residuais): mutações coletivas auditadas, sanitizer allowlist, append-only 0022. Residuais: login pré-auth, export demo LGPD, RLS-deny same-txn, care-plan fine-grained. E01 **não** 100%.

## 11. Decisões humanas pendentes

Granularidade coletiva org×unit (**ratificada**). D01 concluído. **PR #52** em `main` (`cc62520…`). HML **0001–0022**. Architecture Baseline v1.0 + Engineering Book v1. Gate D02-0 documental; **D02-A permanece BLOCKED** (não iniciar automaticamente). Opções: **A** residual E01 · **B** gap `unit_id` · **C** B04 · **D** issue **#25** · **E** submeter D02-A a gate humano.

## 12. Sequência recomendada de retomada

1. **Decisão humana** entre residual E01 / `unit_id` / B04 / #25 / gate D02-A — **sem auto-iniciar D02-A**.
2. **Não iniciar D02-A** sem gate de implementação liberado.
3. SUP-D03 — somente após D02 liberado.
4. C04.2b — não iniciar.
5. Produção — somente após HML estável + autorização explícita.

## 13. Instruções para retomada segura

1. Partir de `origin/main` no HEAD documentado neste handoff (atualizar o hash ao mergear).
2. Worktree limpa; branch nova por ticket.
3. Não reabrir C04.2b sem pré-requisitos de cache/estado degradado+UX.
4. Não ativar `enableTransientFallback` / `enableMockDataFallback` em produção ou por default.
5. Gates habituais do módulo tocado; sem SQL oportunista.
6. Atualizar este Documento Mestre e o backlog após cada marco.

## 14. Declaração

O backlog (`SUPABASE_IMPLEMENTATION_BACKLOG.md`) permanece o documento técnico detalhado. Este handoff consolida continuidade e decisões; evita cópia integral dos tickets.
