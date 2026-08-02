# SUP-D02 â€” Gate D02-0 â€” DecisÃµes formais (documento canÃ´nico)

| Item | Valor |
|---|---|
| Status | **PROPOSTO â€” PENDENTE DE AUDITORIA INDEPENDENTE E MERGE** |
| Baseline | `origin/main` = `547c60c992c64b9f9038db1029734c3b9c9ec93e` (merge commit do PR #27) |
| HEAD integrado do PR #27 | `7258208d76d49c12bff56543a60d65a86bf0ee7d` |
| Branch deste registro | `docs/sup-d02-gate-d02-0` |
| Data | 2026-08-02 |
| SPEC | `SUP_D02_TECHNICAL_SPECIFICATION.md` |
| ImplementaÃ§Ã£o SUP-D02 / D02-A | **NÃƒO INICIADA** e **NÃƒO AUTORIZADA** por este documento |

> **Nenhum conteÃºdo deste documento autoriza D02-A**, criaÃ§Ã£o de SQL, migration, policy, RPC, UI ou acesso ao Supabase remoto.
> DecisÃµes abaixo sÃ£o **propostas canÃ´nicas** atÃ© auditoria independente, merge em `main` e **autorizaÃ§Ã£o humana separada** para implementaÃ§Ã£o.
> AfirmaÃ§Ãµes de schema/policies referem-se a **migrations e cÃ³digo no repositÃ³rio**; o **estado remoto de produÃ§Ã£o nÃ£o foi verificado**.

---

## 1. Objetivo

Resolver formalmente, em modo exclusivamente documental, as decisÃµes bloqueantes do Gate D02-0 necessÃ¡rias para que uma futura fatia D02-A possa ser *especificada* sem ambiguidade de privilÃ©gio, catÃ¡logo, contrato, anti-reidentificaÃ§Ã£o, auditoria e `fail-closed`.

## 2. Escopo

- DecisÃµes D02-0.1 a D02-0.10.
- CatÃ¡logo piloto fechado baseado apenas em schema comprovado.
- Matriz adversÃ¡ria documental (â‰¥ 30 cenÃ¡rios).
- CritÃ©rios de saÃ­da do Gate e ordem futura de implementaÃ§Ã£o (**sem executar**).

## 3. ExclusÃµes

- Qualquer implementaÃ§Ã£o (SQL, RLS, RPC, repository, UI, testes executÃ¡veis).
- SUP-D03, Fase E / SUP-E01 como substituto da auditoria mÃ­nima do D02.
- Issue #25.
- AlteraÃ§Ã£o da branch padrÃ£o remota.
- Acesso ou inventÃ¡rio live do Supabase remoto.
- RatificaÃ§Ã£o automÃ¡tica de D02-A pelo futuro merge deste PR.

## 4. Fontes de evidÃªncia

| Fonte | Uso |
|---|---|
| `SUP_D02_TECHNICAL_SPECIFICATION.md` | SPEC pÃ³s PR #27 |
| `SUP_D01_TECHNICAL_SPECIFICATION.md` | Contratos de escopo D01; `SafeAggregateResult` com `n` |
| `PROJECT_MASTER_HANDOFF.md`, `SUPABASE_IMPLEMENTATION_BACKLOG.md`, `SUPABASE_ARCHITECTURE_PLANNING.md` | GovernanÃ§a |
| `supabase/migrations/0001_init_schema.sql` | Colunas de `assessments`, `user_journeys`, `risk_results`, `audit_events` |
| `supabase/migrations/0002_rls_policies.sql` | `own_data_assessments`, `risk_results_collective_or_owner`, `audit_read_only_for_auditor` |
| `supabase/migrations/0003_tenant_access_foundation.sql` | `user_roles.unit_id` sem vigÃªncia histÃ³rica |
| `supabase/migrations/0007_assessment_runtime_integrity.sql` | Exemplo DEFINER + `search_path` + revoke/grant |
| `supabase/migrations/0008_journey_runtime_integrity.sql`, `0010_*.sql` | RLS/grants de jornadas |
| `supabase/migrations/0017_*.sql`, `0018_*.sql` | PadrÃ£o INVOKER do D01 (nÃ£o transferÃ­vel ao D02) |
| `apps/web/src/domains/collective/types.ts` | `SafeAggregateResult` com `n` no ramo `ok` |
| `apps/web/src/shared/types/access.ts` | PapÃ©is |
| `apps/web/src/features/biomed-gestao/*`, `demoData` | Indicadores demo (nÃ£o catÃ¡logo) |
| `apps/web/src/domains/audit/auditTrail.ts` | Auditoria demo em `sessionStorage` |

**NÃ£o verificado:** GRANTs efetivos remotes de `assessments` / `risk_results` / `audit_events`; igualdade schema remoto â†” migrations.

---

## 5. DecisÃµes

### D02-0.1 â€” Modelo de privilÃ©gio

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.1` |
| **Problema** | Gestores precisam de agregados sem `SELECT` bruto em `assessments` / `user_journeys`; INVOKER do D01 opera sobre objetos que o caller jÃ¡ pode mutar/ler e **nÃ£o** resolve leitura agregada de fatos pessoais. Ampliar SELECT bruto sÃ³ para â€œfazer INVOKER funcionarâ€ reabre nominalidade. |
| **EvidÃªncia** | Policies `own_data_assessments` (`0002`); `user_journeys_select_self` + clÃ­nica (`0008`/`0010`); RPCs D01-D `SECURITY INVOKER` (`0018`); precedente DEFINER endurecido em `create_or_get_active_assessment` (`0007`: `search_path`, revoke PUBLIC/anon, grant authenticated). |
| **DecisÃ£o** | Adotar **camada RPC `SECURITY DEFINER` endurecida** como Ãºnico modelo canÃ´nico do piloto D02 para indicadores de pessoas. PrÃ©-agregaÃ§Ã£o materializada **nÃ£o** Ã© escolhida neste Gate (sem jobs/ETL existentes; maior superfÃ­cie de `n`/cÃ©lulas). |
| **Justificativa** | Conservador: agrega com privilÃ©gio do owner da funÃ§Ã£o sem conceder linhas-fonte ao gestor; alinhado a precedente B02; evita ampliar RLS de leituras nominais. |
| **Alternativas rejeitadas** | (1) `SECURITY INVOKER` + ampliar SELECT gestor â€” **rejeitada** (nominalidade). (2) PrÃ©-agregaÃ§Ã£o segura â€” **diferida** (pode reabrir-se pÃ³s-piloto com prova equivalente). (3) â€œEquivalenteâ€ genÃ©rico sem desenho â€” **rejeitada** como escolha atual. |
| **Contrato futuro** | Ver Â§5.1.1. |
| **ValidaÃ§Ã£o** | Testes cross-tenant; EXECUTE negado a `anon`/PUBLIC; adulteraÃ§Ã£o de org/papel; ausÃªncia de linhas no payload; EXPLAIN sem vazamento; revisÃ£o de ownership/`BYPASSRLS` no ambiente remoto **antes** do merge da migration. |
| **Risco residual** | Owner DEFINER mal configurado; spoofing se validaÃ§Ã£o interna falhar; estado remoto de grants desconhecido atÃ© inventÃ¡rio prÃ©-D02-A. |
| **Estado** | **Proposto** (canÃ´nico para o Gate; **nÃ£o** autoriza implementaÃ§Ã£o). |

#### 5.1.1 Contrato obrigatÃ³rio da RPC DEFINER (futuro)

1. Owner tÃ©cnico dedicado **sem login de cliente** (papel/usuÃ¡rio DB de serviÃ§o de schema, nÃ£o `authenticated` como owner).
2. Cliente **nunca** usa o papel proprietÃ¡rio.
3. `SET search_path = pg_catalog, public` (ou equivalente mÃ­nimo) + objetos **totalmente qualificados**.
4. **Proibido** SQL dinÃ¢mico (`EXECUTE` de strings montadas a partir de input).
5. `REVOKE EXECUTE â€¦ FROM PUBLIC` e `anon`; `GRANT EXECUTE` apenas ao papel estritamente necessÃ¡rio (`authenticated` se a authz interna negar o restante).
6. AutenticaÃ§Ã£o: exigir `auth.uid()` nÃ£o nulo.
7. AutorizaÃ§Ã£o: validar papel e vÃ­nculo organizacional **no banco** (helpers `app_auth.*` / membership ativa); **nÃ£o** confiar isoladamente em JWT `app.role` / `app.organization_id` potencialmente obsoletos.
8. Tenant efetivo: derivado/validado no servidor a partir do vÃ­nculo; parÃ¢metro de org do cliente, se existir, sÃ³ como **asserÃ§Ã£o** que deve coincidir â€” senÃ£o erro genÃ©rico.
9. ParÃ¢metros limitados por **whitelist** (indicador, perÃ­odo, dimensÃµes); rejeitar `unitId`/`unitIds`/filtros nÃ£o listados com erro seguro de consulta invÃ¡lida.
10. Retorno **somente** contrato agregado seguro (Â§ D02-0.5); **nenhuma** linha bruta, ID de indivÃ­duo, `message`/`explainability` de risco, `n` ou denominador.
11. Erros sem metadados internos de autorizaÃ§Ã£o/contagem.
12. Auditoria mÃ­nima **antes** de devolver qualquer resultado que exponha agregado (Â§ D02-0.7â€“0.8).

---

### D02-0.2 â€” Leitura bruta de `risk_results`

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.2` |
| **Problema** | Policy `risk_results_collective_or_owner` concede SELECT gerencial bruto a papÃ©is coletivos, conflitando com â€œgestÃ£o sÃ³ agregadaâ€. |
| **EvidÃªncia** | `0002` L78â€“91: SELECT se org JWT bate **e** papel âˆˆ {`gestor_institucional`,`sst`,`admin_cliente`,`admin_biomed`,`auditor`} **ou** owner via `assessments.user_id`. GRANTs de tabela **nÃ£o** declarados nas migrations â†’ remoto **nÃ£o verificado**. |
| **DecisÃ£o** | **Redesenhar** (migration futura, **nÃ£o nesta operaÃ§Ã£o**): remover SELECT bruto gerencial/admin/sst/auditor sobre `risk_results`; **preservar** SELECT do titular (owner via assessment); gestÃ£o/auditoria institucional sÃ³ via RPC agregada D02; equipe clÃ­nica **nÃ£o** ganha SELECT amplo nesta policy (permanece sem acesso gerencial bruto). |
| **Justificativa** | Privacidade: `level`/`message`/`explainability` sÃ£o nominais por assessment. Auditor lÃª trilha de consultas/`audit_events`, nÃ£o linhas clÃ­nicas de risco. |
| **Alternativas rejeitadas** | Manter SELECT gerencial + â€œsÃ³ UI agregaâ€ â€” rejeitada (fronteira insegura). Ampliar SELECT de assessments para simetria â€” rejeitada. |
| **Contrato futuro** | Ordem: (0) inventÃ¡rio remoto de policies/grants; (1) migration ~`0019+` substituindo policy; (2) testes pos/neg; (3) sÃ³ entÃ£o RPCs agregadas que leem `risk_results` sob DEFINER. |
| **ValidaÃ§Ã£o** | Positivos: titular lÃª prÃ³prio risco; gestor **nÃ£o** lÃª linhas; RPC agregada ok sob limiar. Negativos: `anon`, papel adulterado, cross-org, gestor SELECT direto. Rollback: restaurar policy anterior **somente** se inventÃ¡rio prÃ©vio documentado. |
| **Risco residual** | Remoto pode ter grants/policies extras; apps que dependam do SELECT bruto gerencial quebrarÃ£o (intencional). |
| **Estado** | **Proposto** (desenho); implementaÃ§Ã£o **bloqueada** atÃ© D02-A autorizado + inventÃ¡rio remoto. |

**PapÃ©is a perder SELECT bruto:** `gestor_institucional`, `sst`, `admin_cliente`, `admin_biomed`, `auditor`.
**Preservar:** titular (owner).
**NÃ£o introduzir:** SELECT gerencial amplo em `assessments` / `user_journeys`.

---

### D02-0.3 â€” CatÃ¡logo do piloto

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.3` |
| **Problema** | Demo (`demoData`) nÃ£o Ã© catÃ¡logo; indicadores inventados ou unit-scoped nÃ£o sÃ£o seguros. |
| **EvidÃªncia** | Schema `0001`; ausÃªncia de `unit_id` nos fatos; demo sem IDs estÃ¡veis; status de assessment parcialmente convenÃ§Ã£o de app. |
| **DecisÃ£o** | CatÃ¡logo **fechado** abaixo. Qualquer outro indicador = **fora do piloto** / diferido. |
| **Justificativa** | SÃ³ mÃ©tricas calculÃ¡veis com colunas comprovadas, escopo `organization`, temporalidade explÃ­cita. |
| **Alternativas rejeitadas** | Adotar labels demo como catÃ¡logo; indicadores de â€œpopulaÃ§Ã£o elegÃ­velâ€ / â€œusuÃ¡rios ativosâ€ sem definiÃ§Ã£o de fato; recortes por unidade. |
| **Contrato futuro** | RPC sÃ³ aceita `indicatorId` âˆˆ catÃ¡logo; demais â†’ consulta invÃ¡lida. |
| **ValidaÃ§Ã£o** | Testes por indicador (ok/empty/suppressed); rejeiÃ§Ã£o fora da lista; ausÃªncia de campos inventados no SQL. |
| **Risco residual** | VocabulÃ¡rio de `status`/`level` requer allowlist validada no remoto antes do go-live. |
| **Estado** | **Proposto**. |

#### Indicadores **incluÃ­dos** (piloto)

##### `IND-D02-P01` â€” AvaliaÃ§Ãµes iniciadas (contagem agregada)

| Campo | Valor |
|---|---|
| Nome | AvaliaÃ§Ãµes no perÃ­odo |
| Finalidade | Volume de registros de assessment na organizaÃ§Ã£o |
| Fonte | `public.assessments` |
| Campo temporal | `created_at` (timestamptz) |
| PopulaÃ§Ã£o | Linhas com `organization_id` = tenant efetivo |
| InclusÃ£o | `created_at` âˆˆ perÃ­odo canÃ´nico (mÃªs UTC) |
| ExclusÃ£o | Soft-delete se `status` allowlisted como excluÃ­do (definir na fatia apÃ³s inventÃ¡rio; default: contar todos os status presentes na allowlist de status do piloto) |
| Numerador | Contagem de linhas (interna) |
| Denominador | N/A (contagem) |
| CÃ¡lculo | `COUNT(*)` interno; cliente recebe sÃ³ estado/`value` se `ok` |
| Arredondamento | Inteiro no servidor **nÃ£o** exposto como `n`; `value` = contagem **somente se** `n â‰¥ 10`, senÃ£o `suppressed`/`empty` |
| DimensÃµes | Nenhuma alÃ©m de org implÃ­cita |
| Filtros | Apenas perÃ­odo (`YYYY-MM` UTC) |
| Granularidade | **MÃªs civil UTC** (mÃ­nimo) |
| PapÃ©is | `gestor_institucional`, `admin_cliente`, `admin_biomed`, `sst` (org-wide), `auditor` â€” via RPC |
| SupressÃ£o | `k = 10`; `n = 0` â†’ `empty`; `1â‰¤n<10` â†’ `suppressed` |
| Contrato saÃ­da | D02-0.5 |
| ExportaÃ§Ã£o | **Proibida** no piloto |
| LimitaÃ§Ãµes | NÃ£o distingue â€œconcluÃ­daâ€ sem allowlist remota de status |
| Testes | Limiar 0/9/10/11; cross-org; unitId rejeitado |

##### `IND-D02-P02` â€” Pessoas distintas com avaliaÃ§Ã£o

| Campo | Valor |
|---|---|
| Nome | Pessoas com â‰¥1 assessment no perÃ­odo |
| Fonte | `public.assessments` |
| Temporal | `created_at` |
| CÃ¡lculo | `COUNT(DISTINCT user_id)` interno |
| Demais regras | Iguais a P01 (org, k=10, sem dimensÃµes, export proibida) |
| LimitaÃ§Ãµes | DeduplicaÃ§Ã£o sÃ³ por `user_id` no fato |

##### `IND-D02-P03` â€” Jornadas iniciadas

| Campo | Valor |
|---|---|
| Nome | Jornadas iniciadas no perÃ­odo |
| Fonte | `public.user_journeys` |
| Temporal | `started_at` |
| CÃ¡lculo | `COUNT(*)` interno |
| Demais | Como P01 |

##### `IND-D02-P04` â€” Jornadas concluÃ­das

| Campo | Valor |
|---|---|
| Nome | Jornadas concluÃ­das no perÃ­odo |
| Fonte | `public.user_journeys` |
| Temporal | `completed_at` **nÃ£o nulo** e âˆˆ perÃ­odo |
| InclusÃ£o | `completed_at IS NOT NULL` |
| CÃ¡lculo | `COUNT(*)` interno |
| Demais | Como P01 |
| LimitaÃ§Ãµes | Depende de imutabilidade/`concluida` (`0009`) |

##### `IND-D02-P05` â€” DistribuiÃ§Ã£o de nÃ­vel de risco (agregado)

| Campo | Valor |
|---|---|
| Nome | DistribuiÃ§Ã£o agregada de `risk_results.level` |
| Fonte | `public.risk_results` |
| Temporal | `created_at` |
| CÃ¡lculo | Por cada `level` âˆˆ **allowlist fechada** validada no remoto (ex.: valores observados em seed/app â€” **nÃ£o inventar** lista clÃ­nica aqui); cÃ©lula = count interno; **suprimir cÃ©lula** se count &lt; 10; se total org &lt; 10, resposta inteira `suppressed` |
| DimensÃµes | Apenas dimensÃ£o `level` allowlisted (sem cruzamentos) |
| SaÃ­da `ok` | Mapa `level â†’ value` **sem** `n` por cÃ©lula; cÃ©lulas suprimidas omitidas ou marcadas `suppressed` **sem** contagem |
| ExportaÃ§Ã£o | Proibida |
| DependÃªncia | **Exige** D02-0.2 (sem SELECT bruto gerencial) + DEFINER |
| LimitaÃ§Ãµes | Sem allowlist remota de `level`, indicador permanece **bloqueado para liberaÃ§Ã£o** mesmo apÃ³s merge documental |

#### Indicadores **excluÃ­dos / diferidos**

| ID diferido | Motivo |
|---|---|
| Demo â€œPopulaÃ§Ã£o elegÃ­velâ€ | Sem tabela/campo de elegibilidade |
| Demo â€œUsuÃ¡rios cadastrados/ativosâ€ | â€œAtivoâ€ sem definiÃ§Ã£o de fato; headcount de membership Ã© outro domÃ­nio (diferido) |
| Filtros unidade Norte/Sul / `selectedUnitId` | Sem `unit_id` no fato |
| DistribuiÃ§Ã£o por programa (demo) | Sem participaÃ§Ã£o programÃ¡tica comprovada no catÃ¡logo |
| Taxas/percentuais compostos demo | Sem numerador/denominador aprovados alÃ©m dos counts acima |
| Qualquer indicador unit-scoped de pessoas | Bloqueado atÃ© modelagem histÃ³rica |

---

### D02-0.4 â€” Escopo organizacional

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.4` |
| **Problema** | Fontes sem `unit_id` / membership sem vigÃªncia â†’ unit histÃ³rica falsa. |
| **EvidÃªncia** | `0001` sem `unit_id` em assessments/journeys/risk_results; `user_roles.unit_id` atual (`0003`); SPEC PR #27. |
| **DecisÃ£o** | Piloto **exclusivamente** escopo `organization` (vocabulÃ¡rio D01 existente). Rejeitar com **erro seguro de consulta invÃ¡lida** (nÃ£o ignorar): `unit`, `unitId`, `unitIds`, filtros de unidade equivalentes. Tenant sÃ³ do servidor. Proibido classificar fatos pela membership/`user_profiles.unit_id` atuais. Sem vocabulÃ¡rio `organization_only`. Unidade futura sÃ³ com fato/snapshot/modelo temporal **aprovado**. |
| **Justificativa** | Evita reclassificaÃ§Ã£o retrospectiva e UI enganosa. |
| **Alternativas rejeitadas** | Ignorar silenciosamente unitIds; inventar unit via membership; `organization_only` como novo enum. |
| **Contrato futuro** | ValidaÃ§Ã£o na RPC antes da agregaÃ§Ã£o. |
| **ValidaÃ§Ã£o** | Testes 5â€“6, 15 da matriz adversÃ¡ria. |
| **Risco residual** | Confiabilidade temporal de `organization_id` no fato (sem histÃ³rico de transferÃªncia de org modelado). |
| **Estado** | **Proposto** (ratificaÃ§Ã£o documental do piloto). |

---

### D02-0.5 â€” Contrato sem exposiÃ§Ã£o de `n`

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.5` |
| **Problema** | `SafeAggregateResult` D01 expÃµe `n` no `ok` â€” inadequado ao cliente D02. |
| **EvidÃªncia** | `apps/web/src/domains/collective/types.ts`; SPEC Â§6â€“8. |
| **DecisÃ£o** | Contrato **exclusivo** `D02AggregateClientResult` (nome ilustrativo). **Proibida** reutilizaÃ§Ã£o inalterada de `SafeAggregateResult` no cliente D02. Estados: `ok` \| `suppressed` \| `empty` \| `error`. |
| **Justificativa** | Impede canal de tamanho de grupo; alinha emptyâ‰ suppressed com limiar. |
| **Alternativas rejeitadas** | Reusar D01 com `n`; retornar faixas/`nâ‰ˆ` no piloto; status sÃ³ `ok`/`suppressed`. |
| **Contrato futuro** | Ver Â§5.5.1. |
| **ValidaÃ§Ã£o** | Contratos de tipo; snapshots JSON sem `n`; UI nÃ£o exibe denominador. |
| **Risco residual** | InferÃªncia empty vs suppressed mitigada por anti-diff (D02-0.6). |
| **Estado** | **Proposto**. |

#### 5.5.1 Forma canÃ´nica (proposta tÃ©cnica)

```ts
/** Proposta â€” contrato cliente D02; nÃ£o Ã© SafeAggregateResult */
type D02AggregateClientResult =
  | {
      status: 'ok';
      indicatorId: string;
      value: number | Record<string, number>; // sem n; histograma sÃ³ levels ok
      scope: { type: 'organization'; organizationId: string };
      period: { start: string; end: string; grain: 'month' };
      policyVersion: string;
    }
  | {
      status: 'suppressed';
      indicatorId: string;
      reason: 'BELOW_MIN_GROUP' | 'COMPLEMENT' | 'POLICY';
      minGroup: 10;
      scope: { type: 'organization'; organizationId: string };
      period: { start: string; end: string; grain: 'month' };
      policyVersion: string;
    }
  | {
      status: 'empty';
      indicatorId: string;
      scope: { type: 'organization'; organizationId: string };
      period: { start: string; end: string; grain: 'month' };
      policyVersion: string;
    }
  | {
      status: 'error';
      code: 'INVALID_QUERY' | 'UNAUTHORIZED' | 'AUDIT_FAILURE' | 'INTERNAL';
      // sem detalhes internos; sem n; sem hint de existÃªncia de dados
    };
```

**Proibido no cliente:** `n`, sampleSize, denominador, contagem aproximada, IDs individuais, stacks de authz, diferenÃ§as de schema entre cartÃ£o/grÃ¡fico/export/cache.

**PrecisÃ£o / coarsening (piloto):**
- Contagens (`value` em `ok`): inteiro â‰¥ 10 (o valor agregado Ã© a prÃ³pria contagem **apenas** quando nÃ£o suprimida â€” isto **Ã©** o indicador; nÃ£o hÃ¡ campo `n` separado).
- Histogramas: apenas cÃ©lulas â‰¥ 10; sem totais auxiliares que permitam complementar.
- Percentuais: **fora do piloto** (diferidos).
- Faixas/buckets de `n`: **nÃ£o** no piloto.

> Nota: expor a contagem como `value` quando `nâ‰¥10` Ã© intrinsicamente o indicador de volume; o que se proÃ­be Ã© metadado `n` adicional, denominadores e vazamento em `suppressed`/`error`.

---

### D02-0.6 â€” Controles anti-diferenciais

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.6` |
| **Problema** | `k=10` necessÃ¡rio mas insuficiente; consultas prÃ³ximas reidentificam. |
| **EvidÃªncia** | SPEC Â§7; ordem Gate. |
| **DecisÃ£o** | Controles **obrigatÃ³rios antes da primeira exposiÃ§Ã£o** (lista abaixo). ParÃ¢metros objetivos do piloto; o que faltar permanece **bloqueio nomeado** para D02-A. |
| **Justificativa** | Privacidade por desenho. |
| **Alternativas rejeitadas** | SÃ³ limiar; controles sÃ³ na UI; adiar anti-diff para D02-D. |
| **Contrato futuro** | Implementar na mesma fatia da agregaÃ§Ã£o (D02-A), antes de B/C. |
| **ValidaÃ§Ã£o** | Matriz Â§6 cenÃ¡rios 7â€“14, 16â€“17, 25â€“26. |
| **Risco residual** | OrÃ§amento de consultas e detecÃ§Ã£o de sÃ©ries avanÃ§adas exigem telemetria; parÃ¢metros podem endurecer apÃ³s evidÃªncia. |
| **Estado** | **Proposto** (com bloqueios parametrizÃ¡veis listados). |

#### Controles e parÃ¢metros do piloto

| Controle | ParÃ¢metro / regra |
|---|---|
| Limiar `k` | **10** (necessÃ¡rio â‰  suficiente) |
| Whitelist | SÃ³ catÃ¡logo D02-0.3 + filtros/dimensÃµes nele |
| NormalizaÃ§Ã£o | PerÃ­odo â†’ mÃªs UTC fechado; indicador canÃ´nico; escopo org |
| Fingerprint | Hash canÃ´nico: `policyVersion\|actorId\|orgId\|role\|indicatorId\|period\|dims\|channel` |
| Quase idÃªnticas | Mesmo fingerprint em janela **15 min** â†’ mesma resposta cacheada **safe** + auditoria; variaÃ§Ã£o de 1 dia/filtro nÃ£o allowlisted â†’ `INVALID_QUERY` |
| Complementares | Se `total` e `totalâˆ’subset` ambos consultÃ¡veis, aplicar **supressÃ£o complementar**: se cÃ©lula ou complemento &lt; 10, suprimir ambos os lados sensÃ­veis |
| SÃ©ries repetidas | MÃ¡x. **30** consultas agregadas / ator / org / **hora** (proposta); excesso â†’ `error` genÃ©rico |
| Janelas sobrepostas | Apenas grain mÃªs; perÃ­odos custom &lt; 1 mÃªs â†’ rejeitar |
| Filtros incrementais | SÃ³ dims allowlisted; demais rejeitar |
| Totais/subtotais | Um Ãºnico endpoint canÃ´nico; UI/export/cache **obrigados** a usÃ¡-lo |
| PrecisÃ£o | Conforme D02-0.5 |
| Cache | Isolado por tenant, ator, papel, indicador, policyVersion, fingerprint; sÃ³ respostas jÃ¡ safe; **nÃ£o** dispensa auditoria |
| Logs | Sem `n`, valores suprimidos, linhas, params brutos alÃ©m do fingerprint |
| Erros | Sem vazamento |
| Rate limit avanÃ§ado / DP | **Diferido** (nÃ£o bloqueia se whitelist+k+anti-complemento+orÃ§amento mensal/hora ativos) |

**Bloqueios nomeados antes de D02-A (devem constar no plano da fatia):** allowlist remota de `risk_results.level`; confirmaÃ§Ã£o de vocabulÃ¡rio de `assessments.status` se P01 for filtrado por status.

---

### D02-0.7 â€” Auditoria mÃ­nima

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.7` |
| **Problema** | `audit_events` existe sem INSERT app via RPC; demo em sessionStorage insuficiente. |
| **EvidÃªncia** | `0001` audit_events; `0002` SELECT auditor/admin_biomed; ausÃªncia de INSERT RPC; SPEC Â§12. |
| **DecisÃ£o** | Auditoria mÃ­nima **prÃ³pria do D02** (RPC/append DEFINER ou extensÃ£o comprovada de `audit_events` **apÃ³s** inventÃ¡rio). Campos mÃ­nimos abaixo. Disparar em: miss/hit de cache, `ok`/`empty`/`suppressed`, export (se houver), negado, `INVALID_QUERY` relevante. |
| **Justificativa** | Accountability antes da exposiÃ§Ã£o; E01 pode ampliar depois. |
| **Alternativas rejeitadas** | Adiar tudo a E01; auditar sÃ³ `ok`; confiar sÃ³ no cliente. |
| **Contrato futuro** | Preferir mapear a `audit_events` **se** inventÃ¡rio confirmar AdequaÃ§Ã£o (colunas/`action`/`entity`/`result`); senÃ£o tabela/RPC D02 dedicada na mesma migration da agregaÃ§Ã£o. |
| **ValidaÃ§Ã£o** | Todo caminho de exposiÃ§Ã£o deixa 1 evento; conteÃºdo sem `n`/valores. |
| **Risco residual** | Schema atual de `audit_events` pode precisar de campos extras (fingerprint, policyVersion) â€” acomodar em `reason`/`origin` JSON **ou** migration de extensÃ£o **na fatia**, apÃ³s inventÃ¡rio. |
| **Estado** | **Proposto**. |

**Registrar:** timestamp; ator (`actor_user_id`); organizaÃ§Ã£o efetiva; papel efetivo; `indicatorId`; fingerprint; dimensÃµes/perÃ­odo canÃ´nicos; canal (`api`/`ui`/`export`/`cache`); estado do resultado (`ok`/`empty`/`suppressed`/`error`/`denied`); `policyVersion`; correlation/request id; resultado da autorizaÃ§Ã£o (`allow`/`deny`).

**NÃ£o registrar:** payload agregado completo; `n`; valores/cÃ©lulas suprimidas; params brutos desnecessÃ¡rios; PII/clÃ­nico; linhas-fonte.

---

### D02-0.8 â€” Falha na persistÃªncia da auditoria (`fail-closed`)

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.8` |
| **Problema** | P3 da auditoria do PR #27: comportamento indefinido se auditoria falhar. |
| **EvidÃªncia** | RelatÃ³rio de auditoria independente; SPEC sem fail-closed explÃ­cito. |
| **DecisÃ£o** | **`fail-closed` absoluto** para qualquer operaÃ§Ã£o que possa **expor** agregado protegido (`ok`/`empty`/`suppressed` ao cliente, export, cache fill que alimente cliente). Se a auditoria obrigatÃ³ria **nÃ£o** persistir de modo durÃ¡vel **antes** da resposta: **nÃ£o** devolver resultado; resposta `error` genÃ©rico `AUDIT_FAILURE` **sem** revelar existÃªncia de dados; cache **nÃ£o** contorna; **proibido** best-effort silencioso. Telemetria operacional segura (mÃ©trica/log sem conteÃºdo sensÃ­vel). Tentativas **negadas** que **nÃ£o** exponham agregado podem usar canal operacional separado **desde que** nÃ£o enfraqueÃ§am a regra de exposiÃ§Ã£o. |
| **Justificativa** | Sem trilha, nÃ£o hÃ¡ accountability de acesso a dados protegidos. |
| **Alternativas rejeitadas** | Best-effort; falhar aberto; auditar sÃ³ assÃ­ncrono pÃ³s-resposta para caminhos de exposiÃ§Ã£o. |
| **Contrato futuro** | TransaÃ§Ã£o: persistir auditoria â†’ commit â†’ entÃ£o retornar; ou padrÃ£o equivalente com garantia de nÃ£o exposiÃ§Ã£o se audit falhar. |
| **ValidaÃ§Ã£o** | CenÃ¡rios 18, 19, 30 da matriz. |
| **Risco residual** | Disponibilidade: outage de escrita de auditoria derruba indicadores (aceitÃ¡vel vs vazamento silencioso). |
| **Estado** | **Proposto** â€” resolve o P3 documentalmente. |

---

### D02-0.9 â€” Ordem futura de implementaÃ§Ã£o

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.9` |
| **Problema** | Ordem incorreta (UI primeiro) expÃµe dados. |
| **EvidÃªncia** | SPEC fases; esta ordem Gate. |
| **DecisÃ£o** | SequÃªncia **obrigatÃ³ria** abaixo; **nenhuma** executada por este PR. |
| **Estado** | **Proposto**. |

1. ValidaÃ§Ã£o do estado remoto + inventÃ¡rio de privilÃ©gios/policies/grants.
2. Migration de deny/redesenho do acesso bruto (`risk_results` e confirmaÃ§Ã£o assessments/journeys).
3. Camada segura de agregaÃ§Ã£o (RPC DEFINER).
4. Contrato cliente sem `n`.
5. Auditoria transacional + `fail-closed`.
6. Controles anti-diferenciais (mesma fundaÃ§Ã£o).
7. Testes adversariais.
8. ServiÃ§o/backend/repository.
9. UI sob feature flag **server-side** (sÃ³ apÃ³s 3â€“7).
10. ExportaÃ§Ã£o â€” **somente se** aprovada (piloto: proibida).
11. Observabilidade.
12. RevisÃ£o de seguranÃ§a e privacidade.
13. DecisÃ£o humana de liberaÃ§Ã£o (D02-D).

**Proibido:** UI antes de camada segura + auditoria + anti-diff.

---

### D02-0.10 â€” CritÃ©rios de saÃ­da do Gate

| Campo | ConteÃºdo |
|---|---|
| **ID** | `D02-0.10` |
| **DecisÃ£o** | Gate D02-0 sÃ³ se considera **satisfeito para desbloqueio documental** quando **todos** os critÃ©rios binÃ¡rios abaixo forem verdadeiros. O merge deste PR **nÃ£o** satisfaz sozinho os itens de auditoria/autorizaÃ§Ã£o humana de implementaÃ§Ã£o. |
| **Estado** | **Proposto**. |

| # | CritÃ©rio | Satisfeito por este PR? |
|---|---|---|
| 1 | Modelo de privilÃ©gio escolhido (DEFINER) | Proposto â€” sim documentalmente |
| 2 | Acesso bruto redesenhado (desenho) | Proposto â€” sim; SQL **nÃ£o** |
| 3 | CatÃ¡logo fechado | Sim (piloto) |
| 4 | Contrato sem `n` | Sim |
| 5 | Escopo organizacional ratificado | Sim (proposta) |
| 6 | Anti-diferencial definido | Sim |
| 7 | Auditoria definida | Sim |
| 8 | `fail-closed` definido | Sim |
| 9 | Testes adversariais especificados | Sim (Â§6) |
| 10 | Ordem de implementaÃ§Ã£o definida | Sim |
| 11 | Sem contradiÃ§Ã£o documental (pÃ³s harmonizaÃ§Ã£o) | A validar neste PR |
| 12 | Auditoria independente **aprovada** | **NÃ£o** (pendente) |
| 13 | Documentos integrados em `main` | **NÃ£o** (PR draft) |
| 14 | AutorizaÃ§Ã£o humana **separada** para D02-A | **NÃ£o** |

Enquanto 12â€“14 forem falsos: **Gate nÃ£o libera D02-A**.

---

## 6. Matriz adversÃ¡ria documental

| # | Vetor | Controle | Resultado esperado | Camada | Teste futuro | SituaÃ§Ã£o |
|---|---|---|---|---|---|---|
| 1 | Gestor `SELECT` bruto assessments/journeys | RLS atual + nÃ£o ampliar | Sem linhas / deny | RLS | SQL neg | Decidido |
| 2 | ExecuÃ§Ã£o direta RPC | Authz interna + revoke | Deny ou agregado safe | DEFINER | SQL/API | Decidido |
| 3 | Adulterar `organization_id` | Tenant servidor | `UNAUTHORIZED`/`INVALID_QUERY` | DEFINER | API | Decidido |
| 4 | VÃ­nculo de outra org | Membership check | Deny | DEFINER | SQL | Decidido |
| 5 | `unitId` | D02-0.4 | `INVALID_QUERY` | RPC | API | Decidido |
| 6 | `unitIds` | D02-0.4 | `INVALID_QUERY` | RPC | API | Decidido |
| 7 | `n=0` | D02-0.5 | `empty` sem `n` | Agg | Unidade | Decidido |
| 8 | `n=1â€“9` | k=10 | `suppressed` sem `n` | Agg | Unidade | Decidido |
| 9 | `n=10` | k=10 | `ok` com `value`, sem campo `n` | Agg | Unidade | Decidido |
| 10 | `n=11` | k=10 | `ok` | Agg | Unidade | Decidido |
| 11 | Quase idÃªnticas | Fingerprint/cache 15min | Mesma resposta safe + audit | Anti-diff | IntegraÃ§Ã£o | Decidido |
| 12 | Complementares | SupressÃ£o complementar | Ambos lados seguros | Anti-diff | Unidade | Decidido |
| 13 | Janelas sobrepostas &lt; mÃªs | Grain mÃªs | `INVALID_QUERY` | RPC | API | Decidido |
| 14 | Subgrupos nÃ£o allowlisted | Whitelist | `INVALID_QUERY` | RPC | API | Decidido |
| 15 | MudanÃ§a de unidade no tempo | Sem unit no fato | Sem reclassificaÃ§Ã£o | Escopo | Doc+SQL | Decidido |
| 16 | CartÃ£oâ‰ grÃ¡ficoâ‰ export | Endpoint canÃ´nico | Identidade de resultado | App | E2E | Decidido |
| 17 | Cache cross-tenant | Isolamento chave | Miss / deny | Cache | IntegraÃ§Ã£o | Decidido |
| 18 | Cache hit sem auditoria | Audit obrigatÃ³ria | Audit + ou fail-closed | Audit | IntegraÃ§Ã£o | Decidido |
| 19 | Falha persistÃªncia audit | fail-closed | `AUDIT_FAILURE`, sem dados | Audit | Chaos | Decidido |
| 20 | Papel adulterado | Authz DB | Deny | DEFINER | SQL | Decidido |
| 21 | Claim JWT desatualizado | Membership viva | Deny se vÃ­nculo invÃ¡lido | DEFINER | SQL | Decidido |
| 22 | Indicador fora do catÃ¡logo | Whitelist | `INVALID_QUERY` | RPC | API | Decidido |
| 23 | Filtro fora da whitelist | Whitelist | `INVALID_QUERY` | RPC | API | Decidido |
| 24 | Erro com metadados internos | Erros seguros | Mensagem genÃ©rica | RPC | API | Decidido |
| 25 | Export grupo suppressed | Export proibida piloto | Deny / sem export | API | API | Decidido |
| 26 | Pedido explÃ­cito de `n` | Contrato | Campo ausente / ignore | Contrato | Contrato | Decidido |
| 27 | Corrida consultaÃ—vÃ­nculo | Authz no instante | Deny ou escopo atual sem unit histÃ³rica | DEFINER | ConcorrÃªncia | Decidido |
| 28 | `anon` EXECUTE | Revoke | Deny | Grants | SQL | Decidido |
| 29 | `service_role` indevido | GovernanÃ§a ops | Fora do app cliente; runbooks | Ops | Checklist | Decidido |
| 30 | Resposta antes do commit audit | Ordem transacional | ImpossÃ­vel por contrato fail-closed | Audit | IntegraÃ§Ã£o | Decidido |

---

## 7. DeclaraÃ§Ãµes uniformes (obrigatÃ³rias)

- Este Gate permanece **nÃ£o ratificado** enquanto o PR estiver draft / sem auditoria+merge.
- D02-A **nÃ£o** iniciado; implementaÃ§Ã£o **nÃ£o** autorizada.
- `SECURITY INVOKER` **nÃ£o** justifica ampliaÃ§Ã£o de SELECT bruto.
- Gestor **nÃ£o** deve possuir leitura bruta de fatos pessoais.
- Piloto exclusivamente organizacional; unidade histÃ³rica bloqueada; `unitId`/`unitIds` rejeitados.
- `k=10` nÃ£o basta isoladamente.
- Contrato cliente **nÃ£o** expÃµe `n`.
- Auditoria antecede exposiÃ§Ã£o; falha â†’ **fail-closed**.
- Cache e exportaÃ§Ã£o (se existirem) obedecem Ã s mesmas regras; export piloto **proibida**.
- UI depende das camadas seguras.
- SUP-D03 e Fase E **nÃ£o** iniciados.

---

## 8. Bloqueios remanescentes (nÃ£o ocultar)

1. Auditoria independente + merge deste pacote documental.
2. AutorizaÃ§Ã£o humana **separada** para D02-A.
3. InventÃ¡rio do estado remoto (policies/grants/`BYPASSRLS`/owner).
4. Allowlist remota de `risk_results.level` antes de liberar `IND-D02-P05`.
5. ConfirmaÃ§Ã£o remota de vocabulÃ¡rio de `assessments.status` se filtragem por status for introduzida.
6. Escolha final do storage de auditoria (`audit_events` vs estrutura D02) apÃ³s inventÃ¡rio.
7. PrÃ©-agregaÃ§Ã£o materializada permanece **diferida** (nÃ£o canÃ´nica agora).
8. Percentuais, elegibilidade, atividade, programas, unit histÃ³rica â€” **diferidos**.
9. ExportaÃ§Ã£o â€” **fora do piloto**.
10. DP / rate limit avanÃ§ado â€” **diferidos** sob controles mÃ­nimos do D02-0.6.

---

## 9. PrÃ³ximo ato (nÃ£o executar aqui)

Submeter o HEAD deste PR a **auditoria independente exclusivamente documental**. D02-A permanece **proibido** atÃ©: aprovaÃ§Ã£o da auditoria, integraÃ§Ã£o em `main`, e autorizaÃ§Ã£o humana separada.
