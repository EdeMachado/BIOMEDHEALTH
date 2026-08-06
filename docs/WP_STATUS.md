# BIOMED HEALTH — WP Status

Atualizado: **2026-08-06**

| WP | Título | Status | Evidência |
|---|---|---|---|
| WP-02 | Security hardening (0019) | **DONE** | `main` + HML 0019 |
| WP-03.1 | Domínio coletivo + application adapter | **DONE** | PRs #45–#47 · merge `d337596…` |
| WP-03.2 | Operational reliability (0020, fail-closed, audit) | **DONE** | PR #48 · merge `cc560ac…` · HML 0020 |
| WP-04.0 | Architecture Baseline v1.0 · fim Foundation | **DONE** | PR #49 · `6aa954b…` |
| WP-04.1 | Platform Readiness (JWT→app_auth, search_path, E01 sinks) | **DONE** | PR #50 · `cb61981…` · HML **0021** |
| **WP-04.2 / E01.x** | Trust & Audit Layer | **DONE** (residuais E01 documentados) | PR #52 · `cc62520…` · HML **0022** |
| D02-A | Analytics agregados | **BLOCKED** | Gate impl. não liberado — **não iniciar** |

## Registro PR #52 / WP-04.2 (encerrado)

| Item | Valor |
|---|---|
| PR #52 | **MERGED** |
| SHA `main` | `cc6252059ce7746b0369f892c445c74860bf1481` |
| Baseline anterior (PR #51) | `9533563b0f19e6cf4b16a5dc1b4e3181a07a4dd6` |
| Migration | `0022_trust_audit_layer.sql` + rollback |
| HML 0022 | **Aplicada e validada** — `docs/WP-04-2_HML_0022_EVIDENCE.md` |
| Migrations alinhadas | **0001–0022** local = remoto |
| Backup pré-0022 | `.local-backups/hml-pre-0022-20260806-104024/` |
| Dry-run | somente `0022_trust_audit_layer.sql` |
| Validações | A–R conforme relatório (O = testes app; R = CI/local, não reexecutado integralmente no HML no apply) |
| Inventário remoto | **real** — `docs/WP-04-2_HML_REMOTE_INVENTORY.md` |
| Append-only | comprovado (sem INSERT/UPDATE/DELETE app; RPC canônica) |
| Fixtures residuais | **0** |
| Rollback | **Não utilizado** |
| E01 | **não** 100% — residuais documentados |
| D02-A | **BLOCKED** |

## Registro PR #51 (baseline pré-WP-04.2)

| Item | Valor |
|---|---|
| PR #51 | **MERGED** |
| SHA `main` (à época) | `9533563b0f19e6cf4b16a5dc1b4e3181a07a4dd6` |
| Funcional WP-04.1 | `cb61981ccf30c6f765431fab536dbeb17e3bf114` |

## Registro WP-04.1 (encerrado)

| Item | Valor |
|---|---|
| PR #50 | MERGED |
| SHA `main` (à época) | `cb61981ccf30c6f765431fab536dbeb17e3bf114` |
| Migration | `0021_platform_readiness.sql` |
| HML 0021 | **Aplicada e validada A–L** — `docs/WP-04-1_HML_0021_EVIDENCE.md` |
| Rollback | Não utilizado |

## Próxima decisão humana (não automática)

A. residual E01 · B. gap `unit_id` · C. B04 · D. issue #25 · E. D02-A (somente gate humano)
