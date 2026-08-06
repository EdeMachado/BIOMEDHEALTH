# WP-04.2 — Relatório técnico (Trust & Audit Layer)

| Campo | Valor |
|---|---|
| Status | **PR aberto — aguardando gates/revisão** (não mergeado; HML sem 0022) |
| Branch | `feat/wp-04-2-trust-audit-layer` |
| Baseline `main` | `9533563b0f19e6cf4b16a5dc1b4e3181a07a4dd6` (merge **PR #51**) |
| Funcional anterior | `cb61981ccf30c6f765431fab536dbeb17e3bf114` (PR #50 WP-04.1) |
| Migration | `0022_trust_audit_layer.sql` + rollback |
| HML | **0001–0021** — 0022 **não** aplicada |
| D02-A | **BLOCKED** — não iniciar |
| Engineering Book | `docs/BIOMED_HEALTH_ENGINEERING_BOOK_v1.md` |
| Testes locais | **393** passed |
| `supabase:verify` | PASS (reset + lint + WP-02/03.2/04.1/04.2) |

## Objetivo

Fechar a camada Trust & Audit (E01.x): mutações coletivas auditadas, sanitização allowlist, append-only da trilha, inventário E01 e remoto HML — sem D02-A e sem alterar 0001–0021.

## Migration 0022

| Item | Conteúdo |
|---|---|
| Schema | Coluna `correlation_id` (nullable para legado) |
| Grants | `authenticated`: SELECT only |
| RLS | FORCE; deny UPDATE/DELETE; sem INSERT policy |
| RPC | endurecida (actor=`auth.uid()`, result enum, reject PHI, org link, corr obrigatória) |

## Sinks entregues

| Área | Estado |
|---|---|
| Consent + clínico (WP-04.1) | Mantido + correlationId |
| Coletivo create/update/close/delete + action plan | `audited*` + `collectiveAuditSink` (fail-closed) |
| UI Gestão | `ManagementPages` → application wrappers apenas |
| Sanitizer allowlist | códigos + sources + metadata keys |
| Append-only 0022 | No branch; **fora do HML** até autorização |

## Residuais E01 (não concluído integralmente)

| Residual | Nota |
|---|---|
| Login failure pré-auth | Sem `auth.uid()` → RPC não persiste |
| Export demo LGPD | Lacuna de auditoria |
| Pure RLS-deny same-txn | Não afirmar persistência na txn abortada |
| Care-plan fine-grained updates | Updates/ações sem sink completo |

## Gates locais (este ciclo)

| Gate | Resultado |
|---|---|
| typecheck / lint / build | PASS |
| vitest | **393** PASS |
| db reset / db lint | PASS |
| WP-02 / WP-03.2 / WP-04.1 / WP-04.2 | PASS |
| Fixtures residuais | 0 |

## Pendente humano

- Quality Gate + Database Gate no PR
- Merge
- Autorização + apply 0022 no HML + inventário remoto preenchido
- **D02-A** permanece bloqueado

## Próximas opções (humano decide)

1. Residual E01 (pré-auth / LGPD demo / RLS-deny / care-plan)
2. Gap `unit_id` clínico
3. SUP-B04
4. Issue **#25**
5. D02-A — **somente** se gate humano liberar (**não recomendado automaticamente**)
