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
| Baseline de `origin/main` (pós PR #26) | `89de7abb02262236d5633c82ebedd09424c65a49` |
| Último merge documental integrado | PR #26 — consolidação pós-merge SUP-D01-D; HEAD `ec84b82a163e9c236be6b3735e587c295e128f62`; merge `89de7ab…` |
| Último merge funcional integrado | PR #24 — SUP-D01-D; HEAD auditado `ebfd700…`; merge `00b7b3f…` |
| Change set em curso (não mergeado) | **Planejamento/SPEC SUP-D02** (documental); implementação D02 **não** iniciada / **não** autorizada |
| Data desta atualização do handoff | 2026-08-01 |
| Ratificação org×unit (coletivo) | PR #17 — decisão documental |
| SPEC SUP-D01 | Aprovada; ciclo **A/B/C/D** em `main` (PRs #20–#24; docs #23/#26) |
| SPEC SUP-D02 | `SUP_D02_TECHNICAL_SPECIFICATION.md` — planejamento/especificação **autorizados**; implementação **não** iniciada / **não** autorizada |

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

Painéis, campanhas, indicadores e planos coletivos. **Somente agregado**; limiar mínimo de 10 no recorte efetivo; sem drill-down nominal. Persistência estrutural e mutações atômicas **D01-A/B/C/D** em `main`. Overview/indicadores da UI permanecem **demonstrativos** até implementação autorizada do **SUP-D02** (e migração ampla no **SUP-D03**). Fonte técnica do D02: `SUP_D02_TECHNICAL_SPECIFICATION.md` (planejamento/especificação; **implementação não iniciada / não autorizada**). `selectedUnitId` de sessão **não** implementado. Issue **#25** = P3 UI residual (campanhas/planos), fora do D02.

## 4. Documentos canônicos

| Documento | Finalidade |
|---|---|
| `PROJECT_MASTER_HANDOFF.md` (este) | Continuidade, status, decisões, retomada |
| `SUPABASE_IMPLEMENTATION_BACKLOG.md` | Backlog técnico detalhado (tickets SUP-*) |
| `SUPABASE_ARCHITECTURE_PLANNING.md` | Decisões arquitetônicas Supabase (histórico + adendo de continuidade) |
| `SUP_D01_TECHNICAL_SPECIFICATION.md` | SPEC gestão coletiva / escopo (D01) |
| `SUP_D02_TECHNICAL_SPECIFICATION.md` | SPEC indicadores agregados / limiar / anti-drilldown (planejamento; impl. não autorizada) |
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
4. Auditoria append-only via RPC (Fase E ainda aberta).
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

**SUP-D02:** planejamento/especificação em `SUP_D02_TECHNICAL_SPECIFICATION.md` (**autorizados** neste caminho documental). **Implementação** expressamente **não iniciada** e **não autorizada** — exige aprovação formal da SPEC e ordem mutável por fatia (D02-A…).

**Auditoria independente do PR #24 (HEAD `ebfd700…`):** veredito **B**; nenhum P1/P2; nenhum achado bloqueante; prova concorrente (duas sessões) aprovada; rollback e reaplicação da `0018` aprovados; validação SQL D01-D aprovada. **Único P3 residual** (não bloqueante): mensagem de sucesso residual após falha de close/delete na UI coletiva — rastreado na issue **#25** (aberta; follow-up isolado).

**Auditoria independente pós-correção do PR #22 (HEAD `4079287…` — histórico):** veredito **B**, sem P0/P1/P2; quatro achados anteriores corrigidos. **P3 de teste (D01-C) — encerradas pelos testes do D01-D:** (1) suíte de integração `ManagementActionPlanPage`; (2) assert negativo de ausência de mensagem de sucesso após falha de create; (3) cobertura Vitest de `NO_ACTIVE_MEMBERSHIP` no repository coletivo. Não confundir com a issue #25 (P3 distinto, pós-auditoria do #24).

**Evidência histórica do merge D01-C (auditoria do HEAD `4079287…`):** typecheck PASS; lint PASS; unitários 269; integração 81; collective específico 55; build PASS; migrations `0001`–`0017` + validação D01-B + regressão B1 PASS. **Não** executados naquela auditoria: Supabase remoto; Playwright/E2E; CI do GitHub (sem checks publicados no PR).

## 7. Status das fases SUP-A … SUP-E

| Fase | Status | Notas |
|---|---|---|
| A — Acesso/tenant | Entregue na prática (A01–A04 via PRs de auth/access) | Detalhe fino no backlog |
| B — Preventivo | Parcial | B01–B03 (+ filhas) entregues; **B04 aberto** (não iniciado) |
| C — Clínico | Parcial | C01.1/C01.2, C02, C03 entregues; C01 parent com gap `unit_id`; C04 parcial (ver §8) |
| D — Gestão agregada | Parcial | **D01-A/B/C/D** em main; SPEC D02 elaborada; **implementação D02 não iniciada / não autorizada**; D03 não iniciado |
| E — Auditoria/hardening | Aberta | Após B/C/D maduros |

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
| SUP-D02…D03 | **D02:** SPEC em `SUP_D02_TECHNICAL_SPECIFICATION.md` (planejamento autorizado); **implementação não iniciada / não autorizada**; dependência D01 satisfeita. **D03:** não iniciado |
| SUP-E01…E03 | Abertos (Fase E) |
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
- Suite de auditoria persistente (E01) ainda não entregue.

## 11. Decisões humanas pendentes

Granularidade coletiva org×unit (**ratificada**). SPEC SUP-D01 **aprovada** e ciclo A/B/C/D em `main`. SPEC SUP-D02 **elaborada** (planejamento); **implementação D02** exige aprovação formal + ordem mutável por fatia. Pendentes: bases legais/consentimento; ficha/retention; rollout; catálogo de indicadores (D02); timezone/intervalos; desenho deny de SELECT raw gerencial. Issue **#25** = follow-up P3 isolado.

## 12. Sequência recomendada de retomada

1. **Consolidação documental** — PR #16.
2. **Ratificação org×unit** — PR #17.
3. **SPEC SUP-D01** — PRs #18/#19; implementação A/B/C/D — PRs #20–#24; docs pós-merge #23/#26 (`89de7ab…`).
4. **Planejamento/SPEC SUP-D02** — `SUP_D02_TECHNICAL_SPECIFICATION.md` (este change set documental); **não** implementar sem aprovação formal + ordem de fatia.
5. **Após aprovação da SPEC D02:** fatias D02-A… (SQL/RPC → repository → UI controlada → anti-diff), cada uma com auditoria pré-merge.
6. **Issue #25** — follow-up P3 isolado (não bloqueia D02).
7. **SUP-D03** — após D02; não iniciar agora.
8. **SUP-B04** / gap C01 / **C04.2b** — conforme governança vigente; C04.2b não iniciar.
9. **Fase E** — não iniciar neste caminho até D maduro.

## 13. Instruções para retomada segura

1. Partir de `origin/main` no HEAD documentado neste handoff (atualizar o hash ao mergear).
2. Worktree limpa; branch nova por ticket.
3. Não reabrir C04.2b sem pré-requisitos de cache/estado degradado+UX.
4. Não ativar `enableTransientFallback` / `enableMockDataFallback` em produção ou por default.
5. Gates habituais do módulo tocado; sem SQL oportunista.
6. Atualizar este Documento Mestre e o backlog após cada marco.

## 14. Declaração

O backlog (`SUPABASE_IMPLEMENTATION_BACKLOG.md`) permanece o documento técnico detalhado. Este handoff consolida continuidade e decisões; evita cópia integral dos tickets.
