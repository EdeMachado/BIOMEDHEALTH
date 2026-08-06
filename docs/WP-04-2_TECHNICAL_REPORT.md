# WP-04.2 — Relatório técnico (Trust & Audit Layer)

| Campo | Valor |
|---|---|
| Status | **DONE** (residuais E01 documentados; E01 **não** 100%) |
| PR | **#52 MERGED** |
| SHA `main` | `cc6252059ce7746b0369f892c445c74860bf1481` |
| Baseline anterior | `9533563…` (PR #51) |
| Migration | `0022_trust_audit_layer.sql` + rollback |
| HML | **0001–0022** alinhadas local/remoto |
| Evidência HML | `docs/WP-04-2_HML_0022_EVIDENCE.md` |
| Inventário remoto | `docs/WP-04-2_HML_REMOTE_INVENTORY.md` (**real**) |
| D02-A | **BLOCKED** — não iniciar |
| Engineering Book | `docs/BIOMED_HEALTH_ENGINEERING_BOOK_v1.md` |
| Testes (PR #52) | **393** passed |
| Rollback HML | **Não usado** |

## Objetivo

Consolidar Trust & Audit (E01.x): mutações coletivas auditadas, sanitização allowlist, append-only, inventário E01 e remoto HML — sem D02-A e sem alterar 0001–0021.

## Migration 0022 (aplicada no HML)

| Item | Conteúdo |
|---|---|
| Schema | Coluna `correlation_id` (nullable para legado) |
| Grants | `authenticated`: SELECT; sem INSERT/UPDATE/DELETE |
| RLS | FORCE; deny UPDATE/DELETE; sem INSERT policy |
| RPC | endurecida (actor=`auth.uid()`, result enum, reject PHI, org link, corr obrigatória) |
| EXECUTE | authenticated sim; PUBLIC/anon não |

## Sinks entregues

| Área | Estado |
|---|---|
| Consent + clínico (WP-04.1) | Mantido + correlationId |
| Coletivo create/update/close/delete + action plan | `audited*` + fail-closed |
| UI Gestão | application wrappers apenas |
| Sanitizer allowlist | códigos + sources + metadata keys |
| Append-only 0022 | **Operacional no HML** |

## Apply HML (autorizado)

1. Backup `hml-pre-0022-20260806-104024`
2. Dry-run = somente 0022
3. `db push` OK
4. Validação WP-04.2 PASS
5. Inventário remoto real preenchido
6. Fixtures residuais = 0

### Honestidade A–R

| Caso | Nota |
|---|---|
| A–N, P–Q | Validados no HML via `WP_04_2_TRUST_AUDIT_VALIDATION.sql` |
| O (falha repo ≠ sucesso) | Coberto por **testes de aplicação** |
| R (WPs anteriores) | Validado no **CI/local**; **não** reexecutado integralmente no HML no apply 0022 |
| RLS-deny same-txn | **Não** declarado como auditável na mesma transação abortada |

## Residuais E01 (não 100%)

| Residual | Nota |
|---|---|
| Login failure pré-auth | Sem `auth.uid()` → RPC não persiste |
| Export demo LGPD | Lacuna de auditoria |
| Pure RLS-deny same-txn | Limite arquitetural documentado |
| Care-plan fine-grained | Updates/ações sem sink completo |
| service_role/postgres write | Esperado (fora do caminho app) |

## Próximas opções (humano decide — sem auto D02-A)

A. Residual E01 · B. Gap `unit_id` · C. SUP-B04 · D. Issue **#25** · E. D02-A só com gate humano
