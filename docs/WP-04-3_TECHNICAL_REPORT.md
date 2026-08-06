# WP-04.3 — Relatório técnico (E01 Residual Closure)

| Campo | Valor |
|---|---|
| Status | **READY FOR REVIEW** (PR; sem merge; sem HML apply) |
| Baseline início | `a21a184174bb901de3199a1051705bd59dd1b9da` |
| Branch | `feat/wp-04-3-e01-residual-closure` |
| Migration | **Nenhuma** — justificativa abaixo |
| HML | permanece **0001–0022**; **não** aplicar até merge + autorização |
| D02-A | **BLOCKED** — não iniciado |
| Inventário | `docs/WP-04-3_E01_FINAL_INVENTORY.md` |

## Objetivo

Fechar residuais tratáveis do SUP-E01 com honestidade técnica: rastreabilidade, auditoria, consistência app/repo/RPC/DB — sem cobertura artificial de 100%.

## Por que não há migration 0023

A migration **0022** já entrega: append-only, FORCE RLS, deny UPDATE/DELETE, RPC endurecida, `correlation_id`, rejeição PHI, grants mínimos.  
Provenance e actions novas neste WP vivem no **contrato de aplicação** + metadata allowlist (`provenance`, `request_kind`, `field_category`, `email_fp`) — sem alteração de schema.  
Abrir 0023 sem mudança de banco seria cosmética e violaria a regra de migrations significativas.

## Entregas por fase

### A — Login pré-auth

| Antes | Depois |
|---|---|
| Falha pré-auth sem path claro / risco de falso persist | `recordPreAuthLoginFailure`: Supabase **não** chama RPC; retorna `limit=pre_auth_rpc_requires_auth_uid` |
| Membership deny após signOut perdia `auth.uid` | Audit **antes** de `signOut` |
| `rota_negada` fora do contrato | `access_denied` via sanitizer |

Princípios respeitados: sem senha/token/e-mail completo em reason; sem actor/org arbitrários do cliente na RPC; sem INSERT anon; sem ampliar EXECUTE.

### B — LGPD

| Antes | Depois |
|---|---|
| UI demo com toast de “sucesso” enganoso | `lgpdRequestService` + UI de **indisponível** |
| Sem audit | `lgpd_capability_unavailable` quando actor presente |
| Delete simplista | Retenção legal explícita; sem fingir apagamento |

### C — RLS deny same-transaction

| Antes | Depois |
|---|---|
| Residual sem classificação | `classifyPrivilegeDenial` → `database_rls_denied_inferred` / `repository_privilege_denied` / `application_precheck_denied` |
| Risco de “confirmed” falso | **Nunca** emite `database_rls_denied_confirmed` automaticamente |
| Limite same-txn | Documentado como **controlado**; outbox = futuro |

### D — Care-plan fine-grained

Actions distintas: created / updated / closed / suspended / note_added / reassessment_added / action_created / updated / status_changed.  
Metadata: status enums + field_category; **sem** texto clínico.

### E–H — Contrato, validação, testes, docs

- Contrato consolidado em `auditContract.ts` + sanitizer.
- `supabase/policies/WP_04_3_E01_RESIDUAL_VALIDATION.sql`
- Testes `wp043E01ResidualClosure.test.ts` + ajuste guards.
- Docs sincronizados (handoff, backlog, baseline, Engineering Book, roadmap, WP_STATUS, métricas).

## Actions adicionadas (allowlist)

- `login_failure_pre_auth`
- `access_denied` (canônico; substitui uso de `rota_negada`)
- `lgpd_capability_unavailable`
- `care_plan_updated`, `care_plan_suspended`, `care_plan_reassessment_added`
- `care_plan_action_created`, `care_plan_action_updated`, `care_plan_action_status_changed`

## Provenance adicionada

- `application_precheck_denied`
- `repository_privilege_denied`
- `database_rls_denied_inferred`
- `database_rls_denied_confirmed` (reservado; não auto)
- `application` / `repository`
- `pre_auth_unpersistable`

## Validação local (pré-PR)

| Gate | Resultado |
|---|---|
| typecheck | PASS |
| lint | PASS |
| tests | **401** passed |
| build | PASS |
| `supabase db reset` | PASS (0001–0022) |
| `supabase db lint` | PASS |
| WP-02 / 03.2 / 04.1 / 04.2 / **04.3** | PASS |
| fixtures residuais | **0** (cleanup no script 04.3) |

## Riscos / limites remanescentes

1. Persistência pré-auth em modo Supabase exige backend confiável (Edge) — não improvisado.
2. RLS deny confirmed / same-txn audit atômico — outbox/trigger futuro.
3. LGPD operacional completa — dependência jurídica + backend de solicitações.
4. Gap clínico `unit_id`, B04, issue #25 — fora deste WP.

## Próxima fase

**Não** recomendar D02-A automaticamente. Decisão humana entre: gap `unit_id` · B04 · #25 · gate D02-A · outro residual estrutural.
