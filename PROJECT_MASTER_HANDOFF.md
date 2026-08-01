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
| Baseline de `origin/main` (pós PR #18) | `9930c61c87ad40689704ff5f127b3255609a4560` |
| Último merge documental integrado | PR #18 — SPEC SUP-D01 |
| Data desta atualização do handoff | 2026-08-01 |
| Ratificação org×unit (coletivo) | PR #17 — decisão documental; sem implementação |
| SPEC SUP-D01 | Aprovada para implementação controlada (revisão formal); impl. não iniciada |

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

Painéis, campanhas, indicadores e planos coletivos. **Somente agregado**; limiar mínimo de 10 no recorte efetivo; sem drill-down nominal. Persistência real ainda não implementada (Fase D).

## 4. Documentos canônicos

| Documento | Finalidade |
|---|---|
| `PROJECT_MASTER_HANDOFF.md` (este) | Continuidade, status, decisões, retomada |
| `SUPABASE_IMPLEMENTATION_BACKLOG.md` | Backlog técnico detalhado (tickets SUP-*) |
| `SUPABASE_ARCHITECTURE_PLANNING.md` | Decisões arquitetônicas Supabase |
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

**Estado implementado (não confundir com a decisão):** schema atual exige `organization_id` em muitas tabelas MVP; `unit_id` só em bindings de access; campanhas/planos coletivos ainda sem coluna de unidade. Gap clínico C01 (agenda sem `unit_id`) permanece dívida **paralela** e **não** bloqueia, por si só, o SUP-D01.

**SUP-D01:** especificação técnica incorporada pelo **PR #18** (`9930c61…`); revisão formal **aprovada para implementação controlada** (2026-08-01). **Implementação não iniciada.** D01-A (contratos/tipos) e D01-B (schema/migration) exigem **autorizações específicas** posteriores. Não autoriza D02, C01, B04 nem reabrir C04.2b. UI de gestão permanece demonstrativa até ordem explícita.

## 7. Status das fases SUP-A … SUP-E

| Fase | Status | Notas |
|---|---|---|
| A — Acesso/tenant | Entregue na prática (A01–A04 via PRs de auth/access) | Detalhe fino no backlog |
| B — Preventivo | Parcial | B01–B03 (+ filhas) entregues; **B04 aberto** (não iniciado) |
| C — Clínico | Parcial | C01.1/C01.2, C02, C03 entregues; C01 parent com gap `unit_id`; C04 parcial (ver §8) |
| D — Gestão agregada | Aberta | SPEC D01 **aprovada p/ impl. controlada** (PR #18 + revisão formal); **sem implementação**; D01-A pendente de autorização |
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
| SUP-D01 | SPEC incorporada (PR #18) e **aprovada p/ impl. controlada**; implementação **não** iniciada; D01-A pendente de ordem específica; D01-B não iniciado |
| SUP-D02…D03 | Abertos (após implementação futura controlada de D01) |
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

Granularidade coletiva org×unit (**ratificada** — §6.1). SPEC SUP-D01 **aprovada para implementação controlada**. Pendentes: bases legais/texto de consentimento; estrutura final da ficha; retention/exportação de auditoria; estratégia de rollout por tenant/módulo; autorizações mutáveis dos blocos D01-A/D01-B.

## 12. Sequência recomendada de retomada

1. **Consolidação documental** — integrada via PR #16 (`d38c6c5…`).
2. **Ratificação arquitetural org×unit (domínio coletivo)** — PR #17.
3. **Especificação técnica do SUP-D01** — PR #18 incorporado em `main` (`9930c61…`); revisão formal **aprovada para implementação controlada**.
4. **D01-A / D01-B / demais blocos** — somente após **autorização explícita por bloco**; esta aprovação documental **não** inicia implementação.
5. **SUP-B04** — alternativa posterior; revisar fallback preventivo inseguro antes; **não iniciar** agora.
6. Gap residual `unit_id` clínico (C01) — trilha **paralela**, não pré-requisito integral do D01.
7. **SUP-C04.2b — não iniciar.**
8. Correção `catch → mock` (assessment/consent) — **ticket próprio**, fora do D01.

## 13. Instruções para retomada segura

1. Partir de `origin/main` no HEAD documentado neste handoff (atualizar o hash ao mergear).
2. Worktree limpa; branch nova por ticket.
3. Não reabrir C04.2b sem pré-requisitos de cache/estado degradado+UX.
4. Não ativar `enableTransientFallback` / `enableMockDataFallback` em produção ou por default.
5. Gates habituais do módulo tocado; sem SQL oportunista.
6. Atualizar este Documento Mestre e o backlog após cada marco.

## 14. Declaração

O backlog (`SUPABASE_IMPLEMENTATION_BACKLOG.md`) permanece o documento técnico detalhado. Este handoff consolida continuidade e decisões; evita cópia integral dos tickets.
