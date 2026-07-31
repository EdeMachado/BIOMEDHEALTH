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
| Baseline de `origin/main` utilizado na consolidação | `0f3f666403b6d47b2fa2a2c144fe5667ae0dd538` |
| Último merge relevante | PR #15 — normalização PostgreSQL `42501` |
| Data de consolidação deste handoff | 2026-07-31 |

## 3. Visão geral dos três módulos

### Minha BioMed (usuário)

Consentimento versionado, avaliação inicial orientativa, jornada/atividades/progresso, perfil e privacidade. Escopo estritamente próprio (`user_id` / tenant).

### BioMed Clínica (profissional)

Carteira por vínculo ativo, agenda, leitura de jornada vinculada, ficha clínica modular versionada, plano de cuidado e evoluções. Isolamento por organização + assignment; gestão institucional sem acesso clínico nominal.

### BioMed Gestão (institucional)

Painéis, campanhas, indicadores e planos coletivos. **Somente agregado**; limiar mínimo de 10 indivíduos; sem drill-down nominal. Persistência real de gestão ainda em backlog (Fase D).

## 4. Documentos canônicos

| Documento | Finalidade |
|---|---|
| `PROJECT_MASTER_HANDOFF.md` (este) | Continuidade, status, decisões, retomada |
| `SUPABASE_IMPLEMENTATION_BACKLOG.md` | Backlog técnico detalhado (tickets SUP-*) |
| `SUPABASE_ARCHITECTURE_PLANNING.md` | Decisões arquitetônicas Supabase (2026-07-29) |
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
2. `organization_id` obrigatório em dados institucionais; `unit_id` somente em entidades operacionais vinculadas a unidade (planejado; **gap residual** em agenda/vinculo — ver C01).
3. Consentimento versionado/revogável; texto jurídico final pendente de aprovação humana.
4. Auditoria append-only via RPC (Fase E ainda aberta).
5. Indicadores gerenciais: grupo mínimo 10; anti-reidentificação.
6. Substituição gradual mock→real por módulo, sem big-bang.
7. **Fallback clínico runtime com fixture mock, coleção vazia como sucesso, ou escrita fictícia: PROIBIDO** (ver §8).

## 7. Status das fases SUP-A … SUP-E

| Fase | Status | Notas |
|---|---|---|
| A — Acesso/tenant | Entregue na prática (A01–A04 via PRs de auth/access) | Detalhe fino no backlog |
| B — Preventivo | Parcial | B01–B03 (+ filhas) entregues; **B04 aberto** |
| C — Clínico | Parcial | C01.1/C01.2, C02, C03 entregues; C01 parent com gap `unit_id`; C04 parcial (ver §8) |
| D — Gestão agregada | Aberta | Próximo foco técnico recomendado: D01 |
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
| **Normalização PostgreSQL 42501** | **PR #15 MERGED** — `0f3f666…` (pai do HEAD atual de main) |

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
| SUP-C01 `unit_id` | Gap residual arquitetural |
| SUP-D01…D03 | Abertos (Fase D) |
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

Ver também a seção homônima do backlog: bases legais/texto de consentimento; estrutura final da ficha; retention/exportação de auditoria; estratégia de rollout por tenant/módulo; granularidade operacional de `unit_id` onde ainda residual.

## 12. Sequência recomendada de retomada

1. **Consolidação documental** (este handoff + backlog + `.env.example`) — publicada no Draft PR #16; integração em main pendente.
2. **SUP-D01** — próximo ticket técnico **recomendado**, **condicionado** à confirmação da granularidade de unidade aplicável a campanhas/planos (o backlog afirma aprovação da granularidade em A01; o gap `unit_id` em C01.2 permanece — **não** declarar D01 incondicionalmente desbloqueado sem fechar essa contradição operacional).
3. **SUP-B04** — alternativa posterior; condicionada à revisão de qualquer fallback mock inseguro no domínio preventivo.
4. Gap residual `unit_id` — controlar como dependência arquitetural quando o ticket tocar entidades operacionais.
5. **SUP-C04.2b — não iniciar.**

## 13. Instruções para retomada segura

1. Partir de `origin/main` no HEAD documentado neste handoff (atualizar o hash ao mergear).
2. Worktree limpa; branch nova por ticket.
3. Não reabrir C04.2b sem pré-requisitos de cache/estado degradado+UX.
4. Não ativar `enableTransientFallback` / `enableMockDataFallback` em produção ou por default.
5. Gates habituais do módulo tocado; sem SQL oportunista.
6. Atualizar este Documento Mestre e o backlog após cada marco.

## 14. Declaração

O backlog (`SUPABASE_IMPLEMENTATION_BACKLOG.md`) permanece o documento técnico detalhado. Este handoff consolida continuidade e decisões; evita cópia integral dos tickets.
