# SUP-D02 — Gate D02-0 — Decisões formais (documento canônico)

| Item | Valor |
|---|---|
| Status | **Gate D02-0 documentalmente reauditatado e aprovado com P3** — desenho proposto / especificado; **Gate de implementação não liberado**; **D02-A não autorizado** |
| Baseline de partida desta consolidação | `origin/main` = `b04b4b9e7d0302d2670ed6513c0587bb473ce1d1` (merge do PR #28) |
| Base histórica do PR #28 | `547c60c992c64b9f9038db1029734c3b9c9ec93e` (merge do PR #27) |
| HEAD corretivo do PR #28 | `f9a4ca5d85603178ab6e0ef51f7876e72fbd71dc` (B1–B6 e P05 corrigidos) |
| Reauditoria SUP-D02-G0-RA | Aprovada com P3 em 2026-08-03 (sem P0/P1/P2); nenhum review formal registrado no GitHub no momento auditado |
| Data | 2026-08-03 |
| SPEC | `SUP_D02_TECHNICAL_SPECIFICATION.md` |
| Implementação SUP-D02 / D02-A | **NÃO INICIADA** e **NÃO AUTORIZADA** por este documento |

> **Nenhum conteúdo deste documento autoriza D02-A**, criação de SQL, migration, policy, RPC, UI ou acesso ao Supabase remoto.
> O Gate está **documentalmente reauditatado e aprovado com P3**; o desenho permanece **proposto / especificado**. **Gate de implementação não liberado** enquanto o critério 14 (autorização humana separada) for falso.
> Afirmações de schema/policies referem-se a **migrations e código no repositório**; o **estado remoto de grants/owners/`BYPASSRLS` ainda não foi inventariado** (pendência pré-D02-A).
> Este documento é a **fonte canônica única** do contrato cliente D02 e da política de cardinalidade do piloto.

---

## 1. Objetivo

Resolver formalmente, em modo exclusivamente documental, as decisões bloqueantes do Gate D02-0 necessárias para que uma futura fatia D02-A possa ser *especificada* sem ambiguidade de privilégio, catálogo, contrato, anti-reidentificação, auditoria e `fail-closed`.

## 2. Escopo

- Decisões D02-0.1 a D02-0.10.
- Catálogo piloto fechado baseado apenas em schema comprovado.
- Matriz adversária documental (≥ 30 cenários + limites de banda).
- Critérios de saída do Gate e ordem futura de implementação (**sem executar**).

## 3. Exclusões

- Qualquer implementação (SQL, RLS, RPC, repository, UI, testes executáveis).
- SUP-D03, Fase E / SUP-E01 como substituto da auditoria mínima do D02.
- Issue #25.
- Alteração da branch padrão remota.
- Acesso ou inventário live do Supabase remoto.
- Ratificação automática de D02-A pelo futuro merge deste PR.
- Exposição pública de contagens exatas, `n`, `support_n`, `empty` ou `minGroup`.

## 4. Fontes de evidência

| Fonte | Uso |
|---|---|
| `SUP_D02_TECHNICAL_SPECIFICATION.md` | SPEC pós PR #27 (harmonizada a este Gate) |
| `SUP_D01_TECHNICAL_SPECIFICATION.md` | Contratos de escopo D01; `SafeAggregateResult` com `n` (não reutilizar no cliente D02) |
| `PROJECT_MASTER_HANDOFF.md`, `SUPABASE_IMPLEMENTATION_BACKLOG.md`, `SUPABASE_ARCHITECTURE_PLANNING.md` | Governança |
| `supabase/migrations/0001_init_schema.sql` | Colunas de `assessments`, `user_journeys`, `risk_results`, `audit_events` |
| `supabase/migrations/0002_rls_policies.sql` | `own_data_assessments`, `risk_results_collective_or_owner`, `audit_read_only_for_auditor` |
| `supabase/migrations/0003_tenant_access_foundation.sql` | `user_roles.unit_id` sem vigência histórica |
| `supabase/migrations/0007_assessment_runtime_integrity.sql` | Exemplo DEFINER + `search_path` + revoke/grant (**não** prova isolada de segurança futura) |
| `supabase/migrations/0008_journey_runtime_integrity.sql`, `0010_*.sql` | RLS/grants de jornadas |
| `supabase/migrations/0017_*.sql`, `0018_*.sql` | Padrão INVOKER do D01 (não transferível ao D02) |
| `apps/web/src/domains/collective/types.ts` | `SafeAggregateResult` com `n` no ramo `ok` |
| `apps/web/src/shared/types/access.ts` | Papéis |
| `apps/web/src/features/biomed-gestao/*`, `demoData` | Indicadores demo (não catálogo) |
| `apps/web/src/domains/audit/auditTrail.ts` | Auditoria demo em `sessionStorage` |

**Não verificado:** GRANTs efetivos remotos; igualdade schema remoto ↔ migrations.

---

## 5. Decisões

### D02-0.1 — Modelo de privilégio

| Campo | Conteúdo |
|---|---|
| **ID** | `D02-0.1` |
| **Problema** | Gestores precisam de agregados sem `SELECT` bruto em `assessments` / `user_journeys`; INVOKER do D01 não resolve leitura agregada de fatos pessoais. Ampliar SELECT bruto reabre nominalidade. |
| **Evidência** | Policies `own_data_assessments` (`0002`); jornadas (`0008`/`0010`); RPCs D01-D `SECURITY INVOKER` (`0018`); precedente DEFINER em `create_or_get_active_assessment` (`0007`). |
| **Decisão** | Adotar **camada RPC `SECURITY DEFINER` endurecida** como único modelo canônico do piloto D02 para indicadores de pessoas. Pré-agregação materializada **não** é escolhida neste Gate. |
| **Justificativa** | Agrega com privilégio do owner da função sem conceder linhas-fonte ao gestor. |
| **Alternativas rejeitadas** | (1) `SECURITY INVOKER` + ampliar SELECT — rejeitada. (2) Pré-agregação — diferida. (3) Equivalente genérico sem desenho — rejeitada. |
| **Contrato futuro** | Ver §5.1.1. |
| **Validação** | Cross-tenant; EXECUTE negado a `anon`/PUBLIC; adulteração de org/papel; ausência de linhas/`n`/`support_n` no payload; revisão de ownership/`BYPASSRLS` remoto **antes** do merge da migration. |
| **Risco residual** | Owner DEFINER mal configurado; spoofing se authz interna falhar; estado remoto desconhecido até inventário. |
| **Estado** | **Proposto** (selecionado como proposta; **não** ratificado). |

#### 5.1.1 Contrato obrigatório da RPC DEFINER (futuro)

1. Owner técnico dedicado **sem login de cliente**.
2. Cliente **nunca** usa o papel proprietário.
3. `SET search_path = pg_catalog, public` (ou mínimo equivalente) + objetos **totalmente qualificados**.
4. **Proibido** SQL dinâmico.
5. `REVOKE EXECUTE … FROM PUBLIC` e `anon`; `GRANT EXECUTE` mínimo.
6. Exigir `auth.uid()` não nulo.
7. Autorização no banco (helpers `app_auth.*` / membership ativa); **não** confiar isoladamente em JWT potencialmente obsoleto.
8. Tenant efetivo derivado/validado no servidor.
9. Parâmetros limitados por whitelist; rejeitar `unitId`/`unitIds`/filtros não listados com erro seguro.
10. Retorno **somente** contrato §5.5; nenhuma linha bruta, ID individual, `n`, `support_n`, valor bruto ou `minGroup`.
11. Erros sem metadados internos.
12. Auditoria mínima + **fail-closed** antes de qualquer resposta que exporia agregado.

**Nota:** `SECURITY DEFINER` **não** é automaticamente protegido por RLS das tabelas-fonte. Owner, `BYPASSRLS`, grants e estado remoto **devem** ser inventariados antes da implementação. O precedente `0007` não prova, isoladamente, que o desenho futuro é seguro.

---

### D02-0.2 — Leitura bruta de `risk_results`

| Campo | Conteúdo |
|---|---|
| **ID** | `D02-0.2` |
| **Problema** | Policy `risk_results_collective_or_owner` concede SELECT gerencial bruto. |
| **Evidência** | `0002`: SELECT se org JWT bate e papel ∈ {`gestor_institucional`,`sst`,`admin_cliente`,`admin_biomed`,`auditor`} **ou** owner via assessment. GRANTs de tabela não declarados → remoto **não verificado**. |
| **Decisão** | Redesenhar (migration futura): remover SELECT bruto gerencial/admin/sst/auditor; preservar titular; gestão só via RPC agregada. |
| **Justificativa** | `level`/`message`/`explainability` são nominais por assessment. |
| **Alternativas rejeitadas** | Manter SELECT gerencial + “só UI agrega”; ampliar SELECT de assessments. |
| **Contrato futuro** | (0) inventário remoto; (1) migration ~`0019+`; (2) testes; (3) só então RPCs. |
| **Validação** | Titular lê próprio; gestor não lê linhas; RPC agregada sob limiar. |
| **Risco residual** | Grants/policies extras no remoto. |
| **Estado** | **Proposto** (desenho); implementação **bloqueada**. |

**Papéis a perder SELECT bruto:** `gestor_institucional`, `sst`, `admin_cliente`, `admin_biomed`, `auditor`.
**Preservar:** titular.

---

### D02-0.3 — Catálogo do piloto e política de cardinalidade

| Campo | Conteúdo |
|---|---|
| **ID** | `D02-0.3` |
| **Problema** | Contagens exatas como `value` e distinção `empty`/`suppressed` criam canal de cardinalidade. |
| **Evidência** | Schema `0001`; auditoria independente do PR #28 (achados B3/B6). |
| **Decisão** | Catálogo exposto: **somente** `IND-D02-P01`…`P04` com **bandas** e `support_n` interno. `IND-D02-P05` = **BLOQUEADO/DIFERIDO**. Estado público `empty` **removido**. Contagens exatas **proibidas** no cliente. |
| **Justificativa** | Conservador: impede publicação/renomeação de `n` e canal binário zero vs baixa cardinalidade. |
| **Alternativas rejeitadas** | Publicar contagem exata como `value`; rejeitar banding no piloto; manter `empty` público. |
| **Contrato futuro** | §§5.3.1–5.3.5 e §5.5. |
| **Validação** | Matriz §6; limites de banda; indistinguibilidade 0 vs 1–9. |
| **Estado** | **Proposto**. |

#### 5.3.1 Regra de suporte interno (`support_n`)

Para cada consulta (e cada célula futura, se houver):

- `support_n`: quantidade de **pessoas distintas** que contribuem para o resultado;
- valor bruto do indicador (contagem de linhas ou outra métrica interna).

**Exclusivamente internos.** Nunca em resposta ao cliente, UI, gráfico, exportação, cache exposto, erro, telemetria ou auditoria funcional.

Um resultado só pode ser `ok` quando **todos** forem verdadeiros:

1. `support_n >= 10`;
2. valor bruto contado >= 10;
3. controles anti-diferenciais satisfeitos;
4. sem necessidade de supressão complementar.

Se o schema não permitir calcular `support_n` com segurança, o indicador é excluído do piloto.

Para P01–P04, `support_n` = `COUNT(DISTINCT user_id)` sobre o universo da consulta (schema: `assessments.user_id` / `user_journeys.user_id` comprovados).

#### 5.3.2 Unificação de zero e baixa cardinalidade

Produzem o **mesmo** estado público `suppressed` (payload indistinguível):

- `support_n = 0`;
- `support_n = 1–9`;
- valor bruto < 10;
- supressão complementar;
- bloqueio anti-diferencial.

Indistinguíveis quanto a: status, shape, motivo público (`privacy_protection`), campos, cache, exportação, UI e auditoria funcional.

**`empty` removido** do contrato público D02. Fonte indisponível / indicador não autorizado / falha operacional → `error` genérico `aggregate_unavailable`, **nunca** `empty`.

#### 5.3.3 Bandas obrigatórias (P01–P04)

| Código | Exibição |
|---|---|
| `10_19` | 10–19 |
| `20_49` | 20–49 |
| `50_99` | 50–99 |
| `100_249` | 100–249 |
| `250_499` | 250–499 |
| `500_plus` | 500 ou mais |

A banda é o **único** resultado público coarsened do indicador de volume, determinística para a mesma consulta canônica e `policyVersion`.
**Não** retornar: número exato, limites separados, valor central, estimativa ou aproximação adicional.

Mapeamento (valor bruto elegível a `ok`):

- 10–19 → `10_19`
- 20–49 → `20_49`
- 50–99 → `50_99`
- 100–249 → `100_249`
- 250–499 → `250_499`
- ≥500 → `500_plus`

#### 5.3.4 Indicadores **incluídos** (piloto exposto)

##### `IND-D02-P01` — Avaliações no período (banda)

| Campo | Valor |
|---|---|
| Fonte | `public.assessments` |
| Temporal | `created_at` ∈ mês civil UTC |
| Valor bruto interno | `COUNT(*)` |
| `support_n` | `COUNT(DISTINCT user_id)` |
| Saída pública | Banda do valor bruto se elegível a `ok`; senão `suppressed` |
| Dimensões/filtros | Nenhum além do mês |
| Exportação | **Proibida** |
| Papéis | via RPC: `gestor_institucional`, `admin_cliente`, `admin_biomed`, `sst` (org-wide), `auditor` |

##### `IND-D02-P02` — Pessoas distintas com avaliação (banda)

| Campo | Valor |
|---|---|
| Fonte | `public.assessments` |
| Temporal | `created_at` |
| Valor bruto interno | `COUNT(DISTINCT user_id)` |
| `support_n` | Igual ao valor bruto (pessoas distintas) |
| Demais | Como P01 |

##### `IND-D02-P03` — Jornadas iniciadas (banda)

| Campo | Valor |
|---|---|
| Fonte | `public.user_journeys` |
| Temporal | `started_at` |
| Valor bruto interno | `COUNT(*)` |
| `support_n` | `COUNT(DISTINCT user_id)` |
| Demais | Como P01 |

##### `IND-D02-P04` — Jornadas concluídas (banda)

| Campo | Valor |
|---|---|
| Fonte | `public.user_journeys` |
| Temporal | `completed_at` não nulo ∈ mês |
| Valor bruto interno | `COUNT(*)` |
| `support_n` | `COUNT(DISTINCT user_id)` |
| Demais | Como P01 |
| Limitações | Depende de imutabilidade/`concluida` (`0009`) |

#### 5.3.5 `IND-D02-P05` — BLOQUEADO/DIFERIDO (fora do catálogo exposto)

**Status:** `BLOQUEADO/DIFERIDO — FORA DO CATÁLOGO EXPOSTO DO PILOTO`

Fundamentos: allowlist remota de `risk_results.level` não verificada; leitura bruta gerencial ainda não redesenhada; risco de complemento entre células; política multicélula de supressão primária/complementar não aprovada; contrato multicélula não aprovado.

Pedido de P05 → `error` genérico `aggregate_unavailable` (sem revelar existência de dados).

#### 5.3.6 Superfície de consulta do piloto

Entrada autorizada **somente**:

- `indicatorId` ∈ {P01, P02, P03, P04};
- um mês `YYYY-MM` (mês civil UTC).

Servidor deriva/valida organização e papel.

**Proibidos:** intervalo arbitrário; dias/semanas; unidade/`unitId`/`unitIds`; filtros demográficos; subgrupos; dimensões livres; parâmetros clínicos; totais personalizados; consultas complementares solicitadas pelo cliente; exportação.

---

### D02-0.4 — Escopo organizacional

| Campo | Conteúdo |
|---|---|
| **ID** | `D02-0.4` |
| **Problema** | Fontes sem `unit_id` / membership sem vigência. |
| **Evidência** | `0001`; `0003`; SPEC. |
| **Decisão** | Piloto exclusivamente escopo `organization`. Rejeitar com **erro seguro**: `unit`, `unitId`, `unitIds` e equivalentes. Tenant só do servidor. Sem membership/`user_profiles.unit_id` retroativos. Sem vocabulário `organization_only`. Unidade futura só com fato/snapshot/modelo temporal aprovado. |
| **Estado** | **Proposto** (selecionado como proposta; **não** ratificado). |

---

### D02-0.5 — Contrato canônico sem exposição de cardinalidade

| Campo | Conteúdo |
|---|---|
| **ID** | `D02-0.5` |
| **Problema** | `SafeAggregateResult` D01 expõe `n`; contratos divergentes e `empty` criam canais. |
| **Evidência** | `types.ts`; auditoria PR #28 (B2/B5/B6). |
| **Decisão** | Este documento (§5.5.1) é a **única** fonte canônica do contrato cliente D02. SPEC deve referenciar esta seção sem interface concorrente. |
| **Estado** | **Proposto**. |

#### 5.5.1 Forma canônica (documental — não autoriza código)

```ts
type D02CountBand =
  | '10_19'
  | '20_49'
  | '50_99'
  | '100_249'
  | '250_499'
  | '500_plus';

type D02PilotIndicator =
  | 'IND-D02-P01'
  | 'IND-D02-P02'
  | 'IND-D02-P03'
  | 'IND-D02-P04';

type D02AggregateClientResult =
  | {
      status: 'ok';
      requestId: string;
      indicatorId: D02PilotIndicator;
      valueKind: 'count_band';
      band: D02CountBand;
      grain: 'calendar_month_utc';
      period: { month: string };
      scope: { kind: 'organization' };
      policyVersion: string;
    }
  | {
      status: 'suppressed';
      requestId: string;
      indicatorId: D02PilotIndicator;
      reason: 'privacy_protection';
      grain: 'calendar_month_utc';
      period: { month: string };
      scope: { kind: 'organization' };
      policyVersion: string;
    }
  | {
      status: 'error';
      requestId: string;
      code: 'aggregate_unavailable';
      policyVersion: string;
    };
```

**Proibido no cliente:** `empty`; `value` numérico; `n`; `support_n`; `minGroup`; valor bruto; `organizationId`; unidade; limites numéricos adicionais; mensagens internas; detalhes de autorização; diferença contratual entre cache hit e cálculo.

Mesmo contrato em API, UI, gráfico e canal futuro. Cache hit e miss devolvem o **mesmo** shape.

#### 5.5.2 Exemplos normativos (sem cardinalidade)

- `support_n = 0` → `{ status: 'suppressed', reason: 'privacy_protection', … }` (sem `support_n`/`n`/`minGroup`).
- `support_n = 1–9` → **exatamente o mesmo** payload `suppressed`.
- `support_n = 10` e valor bruto 10 → `{ status: 'ok', valueKind: 'count_band', band: '10_19', … }`.
- `support_n = 11` e valor bruto 11 → `{ status: 'ok', valueKind: 'count_band', band: '10_19', … }`.
- valor bruto < 10 (mesmo com `support_n` ≥ 10) → mesmo `suppressed`.
- falha operacional / P05 / indicador inválido → `{ status: 'error', code: 'aggregate_unavailable', … }`.

---

### D02-0.6 — Controles anti-diferenciais

| Campo | Conteúdo |
|---|---|
| **ID** | `D02-0.6` |
| **Problema** | `k = 10` necessário mas insuficiente. |
| **Decisão** | Controles obrigatórios antes da primeira exposição. |
| **Estado** | **Proposto**. |

| Controle | Parâmetro / regra |
|---|---|
| Limiar `k` / `support_n` | 10 (necessário ≠ suficiente) |
| Whitelist | Só P01–P04 + mês `YYYY-MM` |
| Grain | **Mês civil UTC** — desenho proposto / especificado; **D02-A não autorizado** até critério 14 |
| Normalização | Mês → `YYYY-MM`; indicador canônico; escopo org |
| Fingerprint | `policyVersion\|actorId\|orgId\|role\|indicatorId\|month\|channel` — `channel` é atributo de **auditoria**; **não** pode particionar nem reiniciar a cota (**A1**) |
| Quase idênticas | Mesmo fingerprint em 15 min → mesma resposta safe + auditoria |
| Complementares | Cliente não solicita; se surgirem vias internas, aplicar supressão complementar |
| Séries / orçamento individual | Máx. 30 consultas / ator / org / hora (não substitui o orçamento organizacional) |
| Orçamento organizacional (**A1**/**A3**) | Limite compartilhado e atômico por **organização + indicador + mês**, independente de ator, papel, sessão e canal; adicional ao limite individual; isolamento de autorização/cache por tenant/ator/papel **preservado** |
| Indistinguibilidade 0 vs 1–9 (**A2**) | Mesmo status, schema, campos e **tamanho serializado**; D02-A deve definir e testar mitigação mensurável de diferenças temporais (sem prometer constant-time absoluto sem especificação técnica) |
| Cache | Isolado por tenant, ator, papel, indicador, policyVersion, fingerprint; só respostas safe; **não** dispensa auditoria; invalidação para dados tardios em meses históricos = **pendência** pré-D02-A |
| Logs | Sem `n`/`support_n`/valores brutos/bandas sensíveis além do necessário operacional sem cardinalidade |
| Canais | Mesmo contrato; séries mensais e comparação de indicadores **não** podem refinar bandas nem distinguir zero de baixa cardinalidade |

---

### D02-0.7 — Auditoria mínima

| Campo | Conteúdo |
|---|---|
| **ID** | `D02-0.7` |
| **Problema** | `audit_events` sem INSERT app via RPC; demo em sessionStorage insuficiente. |
| **Decisão** | Auditoria mínima própria do D02 após inventário. Disparar em: miss/hit de cache, `ok`/`suppressed`, negado, `INVALID_QUERY` relevante, export (se houver). |
| **Estado** | **Proposto**. |

**Registrar:** timestamp; ator; organização efetiva; papel; `indicatorId`; fingerprint; período canônico (mês); canal; estado (`ok`/`suppressed`/`error`/`denied`); `policyVersion`; correlation/request id; autorização (`allow`/`deny`).

**Não registrar:** payload agregado completo; `n`; `support_n`; valor bruto; banda não necessária; valores/células; params brutos desnecessários; PII/clínico; linhas-fonte.

Storage final (`audit_events` vs estrutura D02) **bloqueado** até inventário remoto. **Não** apresentar INSERT app como disponível hoje.

---

### D02-0.8 — Falha na persistência da auditoria (`fail-closed`)

| Campo | Conteúdo |
|---|---|
| **ID** | `D02-0.8` |
| **Decisão** | **`fail-closed` absoluto** para qualquer operação que possa expor agregado (`ok`/`suppressed`, export, cache fill). Se a auditoria obrigatória não persistir de modo durável **antes** da resposta: não devolver resultado; `error` genérico; cache não contorna; **proibido** best-effort. Telemetria operacional sem conteúdo sensível. |
| **Estado** | **Proposto**. |

---

### D02-0.9 — Ordem futura de implementação

1. Inventário remoto + privilégios.
2. Deny/redesenho de acesso bruto.
3. Camada segura de agregação (RPC DEFINER).
4. Contrato canônico (bandas / sem `n`).
5. Auditoria transacional + fail-closed.
6. Controles anti-diferenciais.
7. Testes adversariais.
8. Serviço/backend.
9. UI sob feature flag server-side.
10. Exportação — somente se aprovada (piloto: proibida).
11. Observabilidade.
12. Revisão de segurança e privacidade.
13. Decisão humana de liberação.

**Proibido:** UI antes de camada segura + auditoria + anti-diff.

---

### D02-0.10 — Critérios de saída do Gate

| # | Critério | Satisfeito agora? |
|---|---|---|
| 1 | Modelo de privilégio selecionado como proposta (DEFINER) | Selecionado como proposta |
| 2 | Acesso bruto redesenhado (desenho) | Sim (proposta; SQL não) |
| 3 | Catálogo fechado com bandas + P05 diferido | Selecionado como proposta |
| 4 | Contrato canônico sem `n`/`empty` | Selecionado como proposta |
| 5 | Escopo organizacional selecionado como proposta | Selecionado como proposta |
| 6 | Anti-diferencial definido | Selecionado como proposta |
| 7 | Auditoria definida | Selecionado como proposta |
| 8 | fail-closed definido | Selecionado como proposta |
| 9 | Testes adversariais especificados | Selecionado como proposta |
| 10 | Ordem de implementação definida | Selecionado como proposta |
| 11 | Sem contradição documental (pós correção) | **Sim** — coerência substantiva confirmada; O1-R corrigido |
| 12 | Reauditoria independente **aprovada** | **Sim** — reauditoria aprovada com P3 em 2026-08-03 |
| 13 | Documentos integrados em `main` | **Sim** — PR #28 integrado em `main` pelo merge `b04b4b9…` |
| 14 | Autorização humana **separada** para D02-A | **Não** — inexiste autorização humana separada para D02-A |

**O critério 14 impede D02-A**, mesmo com 11–13 satisfeitos. A autorização para aplicar migrations `0001`–`0018` no PROJECT-HML **não** constitui autorização para D02-A. **Gate de implementação não liberado.**

---

## 6. Matriz adversária documental

| # | Vetor | Controle | Resultado esperado | Camada | Teste futuro | Situação |
|---|---|---|---|---|---|---|
| 1 | Gestor SELECT bruto assessments/journeys | RLS + não ampliar | Sem linhas / deny | RLS | SQL | Proposto / especificado |
| 2 | Execução direta RPC | Authz + revoke | Deny ou agregado safe | DEFINER | SQL/API | Proposto / especificado |
| 3 | Adulterar organization_id | Tenant servidor | error genérico | DEFINER | API | Proposto / especificado |
| 4 | Vínculo outra org | Membership | Deny | DEFINER | SQL | Proposto / especificado |
| 5 | unitId | D02-0.4 | error seguro | RPC | API | Proposto / especificado |
| 6 | unitIds | D02-0.4 | error seguro | RPC | API | Proposto / especificado |
| 7 | support_n = 0 | Unificação | `suppressed` idêntico | Agg | Unidade | Proposto / especificado |
| 8 | support_n = 1–9 | Unificação | Mesmo payload `suppressed` | Agg | Unidade | Proposto / especificado |
| 9 | support_n = 10 / bruto 10 | Bandas | `ok` + `band: '10_19'` (nunca valor exato) | Agg | Unidade | Proposto / especificado |
| 10 | support_n = 11 / bruto 11 | Bandas | `ok` + mesma banda `10_19` | Agg | Unidade | Proposto / especificado |
| 11 | Quase idênticas | Fingerprint | Mesma resposta + audit | Anti-diff | Integração | Proposto / especificado |
| 12 | Complementares | Proibição + suppress | Sem refinamento de banda | Anti-diff | Unidade | Proposto / especificado |
| 13 | Período ≠ mês único | Grain | error | RPC | API | Proposto / especificado |
| 14 | Subgrupos / filtros livres | Whitelist | error | RPC | API | Proposto / especificado |
| 15 | Mudança de unidade no tempo | Sem unit no fato | Sem reclassificação | Escopo | Doc+SQL | Proposto / especificado |
| 16 | Cartão ≠ gráfico ≠ API | Contrato único | Identidade | App | E2E | Proposto / especificado |
| 17 | Cache cross-tenant | Isolamento | Miss / deny | Cache | Integração | Proposto / especificado |
| 18 | Cache hit | Audit obrigatória | Mesmo contrato + audit | Audit | Integração | Proposto / especificado |
| 19 | Falha persistência audit | fail-closed | error; sem dados | Audit | Chaos | Proposto / especificado |
| 20 | Papel adulterado | Authz DB | Deny | DEFINER | SQL | Proposto / especificado |
| 21 | Claim JWT desatualizado | Membership viva | Deny se inválido | DEFINER | SQL | Proposto / especificado |
| 22 | Indicador fora do catálogo / P05 | Whitelist | `aggregate_unavailable` | RPC | API | Proposto / especificado |
| 23 | Filtro fora da whitelist | Whitelist | error | RPC | API | Proposto / especificado |
| 24 | Erro com metadados internos | Erros seguros | Sem detalhe interno | RPC | API | Proposto / especificado |
| 25 | Exportação | Proibida piloto | Deny | API | API | Proposto / especificado |
| 26 | Pedido de n / support_n / value numérico | Contrato | Campo ausente; sem canal | Contrato | Contrato | Proposto / especificado |
| 27 | Corrida consulta×vínculo | Authz no instante | Deny ou escopo sem unit histórica | DEFINER | Concorrência | Proposto / especificado |
| 28 | anon EXECUTE | Revoke | Deny | Grants | SQL | Proposto / especificado |
| 29 | service_role indevido | Governança ops | Fora do app cliente | Ops | Checklist | Proposto / especificado |
| 30 | Resposta antes do commit audit | fail-closed | Impossível por contrato | Audit | Integração | Proposto / especificado |
| 31 | Limite bruto 9 / 10 | Bandas + support | 9→suppressed; 10→`10_19` | Agg | Unidade | Proposto / especificado |
| 32 | Limite 19 / 20 | Bandas | `10_19` / `20_49` | Agg | Unidade | Proposto / especificado |
| 33 | Limite 49 / 50 | Bandas | `20_49` / `50_99` | Agg | Unidade | Proposto / especificado |
| 34 | Limite 99 / 100 | Bandas | `50_99` / `100_249` | Agg | Unidade | Proposto / especificado |
| 35 | Limite 249 / 250 | Bandas | `100_249` / `250_499` | Agg | Unidade | Proposto / especificado |
| 36 | Limite 499 / 500 | Bandas | `250_499` / `500_plus` | Agg | Unidade | Proposto / especificado |

Séries mensais, repetição, cache e canais diferentes **não** podem refinar bandas nem distinguir zero de baixa cardinalidade.

---

## 7. Declarações uniformes

- **Gate D02-0 documentalmente reauditatado e aprovado com P3**; desenho **proposto / especificado**; **Gate de implementação não liberado**; **D02-A não autorizado**.
- PR #28 **mergeado** em `main` (`b04b4b9…`); 1ª auditoria histórica **reprovou**; B1–B6 e P05 corrigidos no HEAD `f9a4ca5…`; reauditoria pós-merge **aprovada com P3**; nenhum review formal no GitHub no momento auditado.
- D02-A **não** iniciado; implementação **não** autorizada.
- `SECURITY INVOKER` **não** justifica ampliação de SELECT bruto.
- Gestor **não** deve possuir leitura bruta de fatos pessoais.
- Piloto exclusivamente organizacional; `unitId`/`unitIds` rejeitados.
- `k = 10` / `support_n >= 10` não bastam isoladamente.
- Contrato cliente: bandas; sem `n`/`empty`/valor numérico.
- Auditoria antecede exposição; falha → **fail-closed**.
- Cache e exportação sob as mesmas regras; export piloto **proibida**.
- UI depende das camadas seguras.
- SUP-D03 e Fase E **não** iniciados.

---

## 8. Bloqueios remanescentes

1. Autorização humana separada para D02-A (**critério 14**).
2. Inventário remoto (policies/grants/`BYPASSRLS`/owner) — verificação remota obrigatória antes do D02-A.
3. Aceite futuro D02-A deve incorporar **A1** (cota organizacional independente de canal), **A2** (indistinguibilidade serializada + mitigação temporal mensurável) e **A3** (orçamento anti-diferencial organizacional compartilhado/atômico, com testes de concorrência).
4. Invalidação de cache para dados tardios em meses históricos.
5. Redesign SQL do acesso bruto a `risk_results`.
6. Storage final da auditoria.
7. `IND-D02-P05` e contrato multicélula.
8. Pré-agregação, percentuais, elegibilidade, unit histórica, exportação — diferidos.
9. SUP-D03 e Fase E — não iniciados.

---

## 9. Próximo ato (não executar aqui)

Obter **autorização humana separada** para D02-A (critério 14), precedida do inventário remoto de owner/grants/`BYPASSRLS`. A aprovação documental e a aplicação de `0001`–`0018` no PROJECT-HML **não** autorizam D02-A nem a migration `0019`.
