# SUP-D02 — Especificação Técnica (Indicadores Agregados e Anti-Drilldown)

| Item | Valor |
|---|---|
| Ticket | `SUP-D02` |
| Título | Camada de indicadores agregados e políticas anti-drilldown |
| Status deste documento | **PLANEJAMENTO / ESPECIFICAÇÃO** — Gate D02-0 **PROPOSTO** (`SUP_D02_GATE_D02_0_DECISIONS.md`); 1ª auditoria **reprovou**; correções B1–B6/O1 neste PR; **pendente de reauditoria**; **não** ratificado enquanto draft |
| Baseline corrente | `origin/main` = `547c60c992c64b9f9038db1029734c3b9c9ec93e` (merge PR #27) |
| Gate D02-0 (canônico) | `SUP_D02_GATE_D02_0_DECISIONS.md` — **PROPOSTO**; contrato cliente canônico único; bandas; `support_n` interno; sem `empty`; P05 diferido; DEFINER; fail-closed |
| Dependência D01 | **Satisfeita** — ciclo SUP-D01-A/B/C/D em `main` (PRs #20–#24; docs #23/#26/#27) |
| Implementação | **NÃO INICIADA** e **NÃO AUTORIZADA** por este documento nem pelo Gate proposto |
| Documento mestre | `PROJECT_MASTER_HANDOFF.md` |
| Backlog | `SUPABASE_IMPLEMENTATION_BACKLOG.md` (SUP-D02) |
| SPEC relacionada | `SUP_D01_TECHNICAL_SPECIFICATION.md` (contratos de escopo + `SafeAggregateResult` preparado no D01 — **não** reutilizar `n` no cliente D02) |
| Data | 2026-08-02 |

> **Natureza:** especificação técnica para implementação **futura** em fatias controladas.
> **Esta SPEC não implementa o SUP-D02.** Não cria SQL, RPCs, repositories, UI nem testes.
> Cada fatia de implementação exigirá **autorização mutável específica**.
> Não autoriza SUP-D03, Fase E, correção da issue #25, nem reabertura do D01.

### Legenda

| Rótulo | Significado |
|---|---|
| **Fato confirmado** | Verificado no código / migrations / docs em `main` no baseline |
| **Decisão ratificada** | Já aprovada (architecture / handoff / SPEC D01) |
| **Contrato desta SPEC** | Norma proposta para implementação controlada (sujeita a aprovação formal e nova auditoria) |
| **Proposta técnica** | Nome/estrutura ilustrativa; pode mudar na implementação |
| **Decisão pendente** | Requer aprovação humana; pode ser **bloqueante** |
| **Bloqueante para D02-A** | Impede qualquer ordem de implementação da fatia A |
| **Fora do escopo** | Explicitamente excluído do D02 |

---

## 1. Identificação e status

### 1.1 Relação com outros tickets

| Ticket | Relação |
|---|---|
| **SUP-D01** | Pré-requisito concluído: escopo `organization`/`unit`, `all_units`/`selected_units`, RLS coletiva, RPCs atômicas, contrato tipado `SafeAggregateResult` (preparação; **não** enforcement) |
| **SUP-D03** | Migração progressiva de UI/adapters de indicadores mock → real; **depende** de D02 liberado; **não** iniciado |
| **Fase E / SUP-E01** | Auditoria append-only plena e hardening; pode **ampliar** a trilha depois. O D02 exige **auditoria mínima própria** antes da exposição (não adiável integralmente para E01) |
| **Issue #25** | P3 UI de campanhas/planos; **fora** do D02; permanece aberta |

### 1.2 Estado canônico

- Planejamento e especificação: **autorizados** (documento); PR #27 **integrado** em `main` (`547c60c…`).
- Gate D02-0: **PROPOSTO** em `SUP_D02_GATE_D02_0_DECISIONS.md` — 1ª auditoria independente **reprovou**; correções documentais B1–B6/O1 neste PR; **pendente de reauditoria** + merge; **não ratificado** enquanto draft.
- Implementação: **não iniciada** / **não autorizada**.
- Fatias D02-A…D: **não iniciadas** / **não autorizadas**.
- SUP-D03 / Fase E: **não iniciados**.
- Issue #25: **aberta**, fora do D02.
- Fase D do projeto: permanece **parcial**.

---

## 2. Problema e objetivo

### 2.1 Necessidade (**decisão ratificada** + backlog)

A BioMed Gestão precisa de **leitura coletiva segura**: cartões, séries e tabelas agregadas por organização — sem expor indivíduos.

### 2.2 Por que agregar

Dados-fonte (`assessments`, `user_journeys`, `risk_results`, metadados de `campaigns`/`action_plans`, etc.) são nominais ou vinculáveis. Gestão institucional **não** é destinatária de prontuário nem de listas nominais (**decisão ratificada**).

### 2.3 Riscos a controlar

- Grupos pequenos (reidentificação).
- Combinação de filtros / inferência por diferença / exposição de `n` exato.
- Drill-down, exportação ou logs que revelem indivíduos.
- Bypass de limiar no cliente.
- Leitura raw de tabelas-fonte por papéis gerenciais.
- Atribuição estatística incorreta por unidade sem histórico confiável.

### 2.4 Objetivo do D02

Entregar a **camada de agregação com limiar e anti-drilldown** de modo que:

1. toda resposta gerencial de indicador seja `ok` (banda), `suppressed` (unificado) ou `error`;
2. o limiar mínimo de **10** indivíduos no recorte efetivo seja enforced no **servidor**;
3. o limiar 10 seja **necessário, mas não suficiente** — controles anti-diferenciais são obrigatórios **antes** de qualquer exposição à aplicação;
4. nenhum ID/nome/campo clínico individual, nem `n`/denominador exato, retorne ao cliente;
5. o piloto use apenas escopo `organization` para fontes sem unidade histórica confiável.

---

## 3. Estado atual inventariado (**fato confirmado**)

### 3.1 Banco / migrations

| Artefato | Estado |
|---|---|
| `0017` / `0018` | Escopo coletivo + RPCs mutação `SECURITY INVOKER` (padrão D01; **não** resolve o problema de leitura agregada do D02) |
| Views/funções de agregação gerencial | **Ausentes** |
| Enforcement SQL de limiar / `suppressed` | **Ausente** |
| Próximo número de migration previsto | **`0019`** (previsão; não criar neste ato) |

### 3.2 Policies e privilégios das fontes candidatas (**fato confirmado**)

| Fonte | `unit_id` no fato? | SELECT típico (baseline) | Implicação D02 |
|---|---|---|---|
| `assessments` | **Não** | Titular e/ou papéis clínicos (`own_data_assessments` em `0002`) | Gestor **não** vê linhas; INVOKER do gestor **não** agrega sozinho |
| `user_journeys` | **Não** | Titular (`user_journeys_select_self`) + leitura clínica vinculada (`0010`) | Idem |
| `risk_results` | **Não** | Owner **ou** papéis gerenciais (`gestor_institucional`, `sst`, `admin_cliente`, `admin_biomed`, `auditor`) via `risk_results_collective_or_owner` | Existe **leitura bruta gerencial** — risco nominal a avaliar/restringir no D02 |
| `campaigns` / `action_plans` | Escopo D01 (não é fato pessoal) | RLS coletiva D01 | Metadados; indicadores de pessoas **não** derivam só daqui |

**Conclusão inventariada:** ampliar `GRANT SELECT` / policies de linhas-fonte “só para viabilizar INVOKER” é **proibido**. Modelo de execução canônico **proposto** no Gate (`D02-0.1`): RPC **`SECURITY DEFINER` endurecida** — ver `SUP_D02_GATE_D02_0_DECISIONS.md`. Proposta **não** autoriza implementação.

### 3.3 Domínio / repositories / UI / auth / auditoria

| Artefato | Estado |
|---|---|
| `SafeAggregateResult` | Contrato D01 com `minGroup: 10`; **não calculado**; inclui `n` no ramo `ok` — o **contrato cliente D02** **não** exporá `n` (§8) |
| `CollectiveRepository` | Só campanhas/planos |
| Overview / Indicadores | **Demo** (`demoData`) |
| `selectedUnitId` | Sempre `null` |
| `audit_events` | Tabela existe; SELECT restrito; **sem** INSERT app via RPC; app usa demo sessionStorage |
| SUP-E01 | Não iniciado |

### 3.4 Lacunas que impedem implementação imediata

1. Aprovação formal desta SPEC corrigida + nova auditoria independente.
2. Modelo de privilégio/execução (**bloqueante**).
3. Catálogo piloto aprovado (**bloqueante**).
4. Desenho deny de leitura bruta (incl. avaliação explícita de `risk_results`).
5. Controles anti-diferenciais + política de `n` + auditoria mínima **antes** da UI.
6. Sem unidade histórica em `assessments` / `user_journeys` → piloto só `organization`.
7. Timezone / intervalos; filtros allowlisted.

---

## 4. Escopo funcional

### 4.1 Incluído (**contrato desta SPEC**)

- Agregação **server-side** com limiar 10 e anti-diferencial **na fundação** (D02-A).
- Estados `ok` (banda) / `suppressed` (unificado; inclui zero) / `error` — contrato canônico no Gate; **sem** `empty`/`n`/valor numérico.
- Piloto organizacional para indicadores baseados em fontes sem unidade histórica.
- Whitelist de indicadores, dimensões e filtros.
- Auditoria mínima de consultas **no D02** (antes da exposição).
- Repository/tipos e **uma** tela piloto só após D02-A/B auditados.
- Testes de limiar, isolamento, anti-nominal, anti-diferença e regressão D01.

### 4.2 Indicadores e elegibilidade de escopo

| Classe | Tratamento |
|---|---|
| Fixtures demo | **Não** são catálogo aprovado |
| Indicadores de pessoas sobre `assessments` / `user_journeys` | Piloto exposto: `IND-D02-P01`…`P04` (Gate); escopo **`organization`**; `unit`/`unitId`/`unitIds` → erro seguro. Bandas obrigatórias; sem contagem exata; sem `empty` público. `IND-D02-P05` (**risk_results**) = **BLOQUEADO/DIFERIDO** |
| Metadados de campanhas/planos sem indivíduos | Podem não aplicar limiar de pessoas; escopo segue RLS D01 |
| Futuro `unit` | Só com `unit_id` no fato, snapshot imutável ou modelo temporal **aprovado** |

**Não** criar vocabulário `organization_only`. Usar escopo existente `organization` + restrição de elegibilidade do indicador.

### 4.3 Membership atual e `selectedUnitId`

- Membership/`user_roles.unit_id` atuais **não** podem classificar fatos históricos retroativamente.
- `selectedUnitId` **não** é necessário ao piloto organizacional e **não** será ativado para esses indicadores.
- Ativação de seletor de unidade = dependência futura do recorte por unidade (após modelo histórico).

### 4.4 Dimensões / filtros / multi-unit

- Organização: sempre do contexto autenticado (cliente não impõe org estrangeira).
- Unidade no piloto de pessoas: **não aplicável** (rejeitar com erro).
- Período: **um** mês civil UTC por consulta, canônico `YYYY-MM` (Gate `D02-0.6`). Sem intervalos arbitrários, dias/semanas, janelas móveis ou sobreposição configurável pelo cliente.
- Múltiplas units no piloto de pessoas: **não** inferir da membership atual.
- Filtros demográficos / dimensões livres / subgrupos: **proibidos** no piloto.

### 4.5 Exportação e drill-down

- Drill-down nominal: **proibido**.
- Exportação: **proibida** no piloto.

### 4.6 Fora do escopo

Ver §18.

---

## 5. Modelo de autorização

Papéis reais: `apps/web/src/shared/types/access.ts`.

| Papel | Indicadores agregados (piloto org) | Nominal |
|---|---|---|
| `gestor_institucional`, `admin_cliente`, `admin_biomed`, `sst` (org-wide), `auditor` | Leitura agregada autorizada na própria org | **Não** |
| `sst` unit-scoped | No piloto de pessoas: recorte permanece organizacional do indicador elegível **ou** deny conforme catálogo — **nunca** inventar recorte unitário sem fato histórico | **Não** |
| Clínicos / `usuario` | **Não** no painel D02 | **Não** via D02 |

**Regra esperada (decisão ratificada):** ausência total de acesso nominal no D02.

Frontend **não** é fronteira de segurança.

---

## 6. Limiar de privacidade e cardinalidade

### 6.1 Valor

| Tema | Status |
|---|---|
| `support_n` / limiar interno = 10 | **Decisão ratificada** (architecture/D01); aplicação detalhada no Gate |
| Contagem exata ao cliente | **Proibida** (Gate `D02-0.3`/`0.5`) |
| Bandas P01–P04 | **Obrigatórias** (proposta Gate) |
| Estado público `empty` | **Removido** (proposta Gate) |
| Suficiência | Limiar 10 é **necessário, mas não suficiente** |

### 6.2 Momento e autoridade

- Aplicado **no servidor**, após montar o universo e **antes** da resposta.
- Cliente **não** controla limiar/`support_n`.

### 6.3 Tratamentos (contrato Gate — fonte canônica)

| Caso interno | Resposta pública |
|---|---|
| `support_n = 0` | `suppressed` (`reason: 'privacy_protection'`) — **mesmo** payload que 1–9 |
| `support_n = 1–9` | Mesmo `suppressed` |
| valor bruto &lt; 10 | Mesmo `suppressed` |
| `support_n ≥ 10` e bruto ≥ 10 e anti-diff ok | `ok` + **banda** (`valueKind: 'count_band'`) — **nunca** número exato |
| Falha / indicador indisponível (ex.: P05) | `error` `aggregate_unavailable` |

Detalhe normativo: `SUP_D02_GATE_D02_0_DECISIONS.md` §§5.3 e 5.5.

### 6.4 Política obrigatória

- **Não** retornar `n`, `support_n`, `minGroup`, valor bruto ou contagem aproximada.
- **Não** distinguir publicamente zero de baixa cardinalidade.
- Bandas determinísticas; sem faixas adicionais/estimativas.
- Qualquer exceção exige aprovação humana específica.

---

## 7. Prevenção de reidentificação

| Controle | Classificação |
|---|---|
| Whitelist fechada de indicadores (P01–P04) | **Obrigatório antes da exposição** (D02-A) |
| Whitelist de dimensões/filtros; rejeitar combos não autorizados | **Obrigatório (D02-A)** |
| Granularidade temporal | **Decisão selecionada como proposta no Gate D02-0: mês civil UTC.** Vigência depende de reauditoria independente aprovada, merge documental e autorização posterior para D02-A. Um mês `YYYY-MM` por consulta; sem intervalos/dias/semanas/janelas móveis |
| Categorias raras / células | **Obrigatório (D02-A)**; P05 diferido |
| Bloqueio de complemento previsível | **Obrigatório (D02-A)** |
| Sem `n`/contagem exata; bandas obrigatórias | **Obrigatório (D02-A)** — Gate |
| Sem drill-down nominal | **Obrigatório** |
| Cache segregado; só respostas já safe; mesmo contrato | **Obrigatório se houver cache** |
| Logs sem cardinalidade sensível | **Obrigatório** |
| Testes de consultas repetidas e limites de banda | **Obrigatório (D02-A)** |
| Consistência cartões/gráficos/API | **Obrigatório** |
| Rate limit / DP avançado | **Pendente (follow-up)** |

**Proibido:** transferir a primeira implantação desses controles para depois da UI.

---

## 8. Contrato de dados

### 8.1 Fonte canônica única

O contrato cliente D02 é definido **somente** em:

`SUP_D02_GATE_D02_0_DECISIONS.md` § **5.5.1** (`D02AggregateClientResult`).

Esta SPEC **não** mantém interface concorrente. Tipos D01 `SafeAggregateResult` (com `n`) **não** podem ser reutilizados inalterados no cliente D02.

### 8.2 Entrada do piloto (resumo)

Somente: `indicatorId` ∈ {P01…P04} + `month` `YYYY-MM`. Organização/papel pelo servidor. `unitId`/`unitIds`/filtros livres → erro seguro.

### 8.3 Exemplos (alinhados ao Gate; sem cardinalidade)

- `support_n = 0` → `suppressed` / `privacy_protection` (sem `support_n`/`n`/`minGroup`).
- `support_n = 1–9` → **exatamente o mesmo** `suppressed`.
- `support_n = 10` e bruto 10 → `ok` / `band: '10_19'`.
- `support_n = 11` e bruto 11 → `ok` / mesma banda `10_19`.
- bruto &lt; 10 → mesmo `suppressed`.
- falha / P05 → `error` / `aggregate_unavailable`.

**Proibido:** exemplos com valor numérico exato ou estado público `empty`.

## 9. Arquitetura de segurança e modelo de privilégio

### 9.1 Camadas

| Camada | Responsabilidade |
|---|---|
| Auth / membership | Identidade e vínculo ativo |
| Execução SQL | **Proposta canônica Gate:** RPC `SECURITY DEFINER` endurecida (`D02-0.1`) — **não** ratificar INVOKER; proposta **não** autoriza SQL ainda |
| RLS / grants | Sem ampliar SELECT bruto; redesenho de `risk_results` (`D02-0.2`) |
| Repository | Traduz erros; sem fallback mock; contrato canônico Gate (bandas; sem `n`) |
| UI | Só após D02-A/B; feature flag server-side se construída cedo |
| Auditoria mínima | Parte do D02 antes da exposição; **fail-closed** (`D02-0.8`) |

### 9.2 Por que o padrão INVOKER do D01 não resolve o D02

**Fato confirmado:** RPCs D01-D são `SECURITY INVOKER` sobre objetos que o caller **já** pode mutar/ler sob RLS coletiva.

No D02, o caller gerencial tipicamente:

- **não** vê `assessments` / `user_journeys` (policies de titular/clínico);
- **pode** ver `risk_results` em bruto (policy coletiva) — o que é risco, não solução.

Portanto:

- INVOKER **sem** linhas visíveis → agregação vazia/inútil;
- INVOKER **com** SELECT ampliado nas fontes → reabre leitura nominal fora da RPC;
- A existência da RPC **não** impede PostgREST/SQL direto se houver GRANT+policy permissiva.

**Classificação:** `SECURITY INVOKER` **não** é solução preferencial, ratificada nem resolvida para o D02.

**Proibido:** ampliar `SELECT` bruto apenas para viabilizar INVOKER.

### 9.3 Decisão canônica proposta (Gate D02-0)

**Fonte:** `SUP_D02_GATE_D02_0_DECISIONS.md` § D02-0.1.

| Alternativa | Status no Gate |
|---|---|
| **A. `SECURITY DEFINER` endurecida** | **Escolhida (proposta canônica)** — único modelo do piloto |
| **B. Pré-agregação segura** | **Rejeitada para o piloto** / diferida pós-piloto com prova equivalente |
| **C. Mecanismo equivalente** | **Rejeitada** como escolha atual (sem desenho) |
| `SECURITY INVOKER` + ampliar SELECT | **Rejeitada** |

Requisitos obrigatórios da DEFINER: owner sem login de cliente; `search_path` seguro; objetos qualificados; sem SQL dinâmico; `REVOKE` PUBLIC/anon; `GRANT EXECUTE` mínimo; authz no banco (não só JWT); tenant servidor; whitelist; retorno só contrato Gate (bandas; sem linhas/`n`/`support_n`); auditoria + **fail-closed** antes da resposta. DEFINER **não** é automaticamente protegido por RLS — inventariar owner/`BYPASSRLS` remoto. Detalhe: documento do Gate.

**Estado:** proposta documental — **não** autoriza D02-A nem migration; INVOKER **não** ratificado; ampliação de leitura bruta **proibida**.

---

## 10. Consistência estatística e temporal

| Tema | Diretriz |
|---|---|
| Numerador / denominador | No catálogo; denominador **não** vai ao cliente |
| Deduplicação | Por pessoa no recorte |
| Timezone / intervalos | **Pendente (Gate D02-0)** |
| Unit histórica | Piloto: **não aplica** (só org). Futuro: fato/snapshot temporal aprovado |
| Membership atual | **Não** usar como unit do fato |
| Cartões / gráficos / export | Mesma função canônica |

---

## 11. Desempenho (**conceitual**)

Sob demanda primeiro; matviews só com evidência; cache só de respostas safe; EXPLAIN na fatia SQL. Sem escolha definitiva agora.

---

## 12. Observabilidade e auditoria mínima do D02

### 12.1 Obrigatoriedade

Auditoria de consultas agregadas é **controle obrigatório do D02 antes da exposição**.

- Preferência: estender uso de `audit_events` **se** o inventário da fatia confirmar adequação (hoje: sem INSERT app via RPC).
- Se insuficiente: **dependência própria do D02** (RPC/append mínima), não adiável para E01.
- E01 pode consolidar/ampliar depois; **não** substitui o mínimo do D02.

### 12.2 Campos permitidos

Incluir: usuário, organização, papel, indicador, fingerprint, dimensões/período canônicos, canal, estado (`ok`/`suppressed`/`error`/`denied`), `policyVersion`, timestamp, correlação, resultado da autorização.

**Não** incluir: linhas clínicas; IDs de pacientes; valores individuais; `n`; `support_n`; valor bruto; contagens/bandas desnecessárias; denominadores; payload agregado completo.

### 12.3 Falha de persistência — **fail-closed** (`D02-0.8`)

Se a auditoria obrigatória **não** puder ser persistida de modo durável **antes** da resposta que exporia agregado protegido: **não** devolver resultado; `error` genérico sem revelar existência de dados; cache **não** contorna; **proibido** best-effort silencioso. Telemetria operacional segura permitida. Detalhe: Gate `D02-0.8`.

---

## 13. Estratégia de implementação futura

Nenhuma fatia iniciada ou autorizada. Ordem normativa futura: Gate `D02-0.9`.

### Gate D02-0 — antes de qualquer implementação

Documento canônico: `SUP_D02_GATE_D02_0_DECISIONS.md` (**PROPOSTO**; 1ª auditoria reprovou; correções B1–B6/O1 neste PR; **pendente de reauditoria**).

O Gate **não** está ratificado até reauditoria + merge + critérios 12–14 de `D02-0.10`. **Merge documental futuro não autoriza D02-A.**

### D02-A — fundação segura (inseparável)

Agregação server-side DEFINER; `support_n` ≥ 10; bandas; `suppressed` unificado (inclui zero); anti-diferencial; grain mês UTC; sem nominal; sem `n`/`empty`; auditoria + **fail-closed**; P01–P04 apenas; P05 diferido; piloto **organization**.

### D02-B — tipos e repository

Somente após D02-A aprovado/auditado: tipos cliente sem `n`; factory fail-closed; testes contratuais.

### D02-C — interface

Somente após A+B: uma tela piloto; sem drill-down; sem denominador/`n`; sem exportação irrestrita; se UI existir cedo, **inacessível** em produção por flag **server-side** (ocultação visual insuficiente).

### D02-D — auditoria final e liberação

Regressão; testes de inferência; isolamento; logs/cache; auditoria independente; liberação controlada.

**D02-D não é o primeiro momento dos controles anti-diferenciais** — eles existem desde D02-A.

**SUP-D03** = migração ampla mock→real.

---

## 14. Estratégia de testes (planejada)

Limiar 9/10; bandas 19/20…499/500; `suppressed` idêntico para 0 e 1–9; sem `n`/`value` numérico; anti-diff; isolamento org; unitId rejeitado; P05 indisponível; grants do modelo escolhido; fail-closed; regressão D01; rollback.

---

## 15. Migration e rollback futuros

Previsão `0019_…`; objetos conforme modelo de privilégio aprovado; UI demo até liberação; rollback simétrico. **Nenhum SQL neste ato.**

---

## 16. Critérios de aceite globais

1. Sem identificadores pessoais/clínicos na resposta.
2. `support_n` ≥ 10 e bruto ≥ 10 no servidor; cliente não contorna; limiar **não suficiente** sozinho.
3. `suppressed` unificado (inclui zero); `ok` só com **banda**; sem `empty`/`n`/valor numérico.
4. Isolamento cross-org.
5. Modelo de privilégio aprovado por ordem humana; sem SELECT bruto ampliado; `risk_results` reavaliado; P05 diferido até então.
6. Piloto só `organization`; `unitId`/`unitIds` rejeitados.
7. Anti-diferencial e auditoria mínima **antes** da exposição; fail-closed.
8. Sem fallback Supabase→mock.
9. Regressão D01; rollback testado.
10. Docs alinhados; reauditoria independente.
11. UI não trata demo como real na superfície liberada.
12. Fase D não marcada concluída prematuramente.

---

## 17. Decisões e pendências

| Tema | Evidência | Decisão | Status | Bloqueia? |
|---|---|---|---|---|
| Limiar interno = 10 | Architecture/D01 | `support_n` / bruto | **Ratificado** (limiar) | Não |
| Bandas; sem contagem exata; sem `empty` | Gate pós-auditoria | Contrato canônico | **Proposto** | Impl. sim |
| Anti-diff antes da UI | Gate `D02-0.6` | Controles em D02-A | **Proposto** | Impl. sim |
| Piloto só `organization` | Gate `D02-0.4` | Rejeitar unitIds | **Proposto** | Unit-scoped |
| INVOKER como solução D02 | Policies + Gate | **Não** | **Rejeitado** | — |
| Modelo privilégio | Gate `D02-0.1` | DEFINER endurecida | **Proposto** | Até reauditoria+auth humana |
| Catálogo | Gate `D02-0.3` | P01–P04; **P05 diferido** | **Proposto** | P05 |
| Deny `risk_results` | Gate `D02-0.2` | Remover SELECT gerencial | **Proposto** (SQL futuro) | D02-A |
| Auditoria + fail-closed | Gate `D02-0.7`/`0.8` | Antes da exposição | **Proposto** | D02-A |
| Granularidade | Gate | Mês civil UTC (proposta) | **Proposto** | — |
| Exportação | Gate | **Proibida** no piloto | **Proposto** | — |
| Reauditoria + merge + ordem D02-A | Governança | Obrigatórias | **Pendente** | **D02-A** |

---

## 18. Fora do escopo

- Prontuário / ficha / evoluções nominais.
- Acesso nominal no painel gestão.
- Implementação neste PR.
- SUP-D03; Fase E como substituto da auditoria mínima do D02.
- Issue #25.
- Ativar `selectedUnitId` no piloto organizacional.
- Usar membership atual como unidade histórica.
- Vocabulário `all_active_units` / `organization_only`.
- Ampliar SELECT bruto para “fazer INVOKER funcionar”.
- Alteração retrospectiva da SPEC D01.

---

## 19. Autorização de trabalho

| Etapa | Estado |
|---|---|
| Inventário / planejamento / SPEC | Integrados via PR #27 (`547c60c…`) |
| Gate D02-0 (decisões) | **PROPOSTO** — 1ª auditoria reprovou; correções B1–B6/O1 neste PR; **pendente de reauditoria** |
| Reauditoria independente do Gate + merge | **Pendente** |
| Autorização humana separada para D02-A | **Pendente** — **proibida** até lá |
| D02-A…D / SUP-D03 / Fase E / #25 | Não iniciados / fora |

> **Próximo ato:** nova auditoria independente documental do PR #28 (HEAD corretivo). **D02-A permanece proibido.**
