# BIOMED HEALTH — WP Status

Atualizado: **2026-08-06**

| WP | Título | Status | Evidência |
|---|---|---|---|
| WP-02 | Security hardening (0019) | **DONE** | `main` + HML 0019 |
| WP-03.1 | Domínio coletivo + application adapter | **DONE** | PRs #45–#47 · merge `d337596…` |
| WP-03.2 | Operational reliability (0020, fail-closed, audit) | **DONE** | PR #48 · merge `cc560ac…` · HML 0020 |
| WP-04.0 | Architecture Baseline v1.0 · fim Foundation | **DONE** | PR #49 · `6aa954b…` |
| WP-04.1 | Platform Readiness (JWT→app_auth, search_path, E01 sinks) | **DONE** | PR #50 · `cb61981…` · HML **0021** |
| **WP-04.2 / E01.x** | Trust & Audit Layer | **IN PROGRESS** | Branch `feat/wp-04-2-trust-audit-layer`; baseline `main` PR #51 `9533563…`; HML ainda **0021** (0022 não aplicada) |
| D02-A | Analytics agregados | **BLOCKED** | Gate impl. não liberado — **não iniciar** |

## Registro PR #51 (baseline)

| Item | Valor |
|---|---|
| PR #51 | **MERGED** |
| SHA `main` | `9533563b0f19e6cf4b16a5dc1b4e3181a07a4dd6` |
| Funcional anterior (WP-04.1) | `cb61981ccf30c6f765431fab536dbeb17e3bf114` |

## Registro WP-04.1 (encerrado)

| Item | Valor |
|---|---|
| PR #50 | MERGED |
| SHA `main` (à época) | `cb61981ccf30c6f765431fab536dbeb17e3bf114` |
| Migration | `0021_platform_readiness.sql` |
| HML 0021 | **Aplicada e validada A–L** — `docs/WP-04-1_HML_0021_EVIDENCE.md` |
| Rollback | Não utilizado |
| Divergência local/HML | Nenhuma até 0021 |

## Registro WP-04.2 (em curso)

| Item | Valor |
|---|---|
| Branch | `feat/wp-04-2-trust-audit-layer` (**não mergeada**) |
| Migration | `0022_trust_audit_layer.sql` + rollback (no branch) |
| HML 0022 | **Não aplicada** — HML permanece **0001–0021** |
| Inventários | `docs/WP-04-2_E01_EVENT_INVENTORY.md`, `docs/WP-04-2_HML_REMOTE_INVENTORY.md` |
| Relatório | `docs/WP-04-2_TECHNICAL_REPORT.md` |
| Engineering Book | `docs/BIOMED_HEALTH_ENGINEERING_BOOK_v1.md` |
| D02-A | **BLOCKED** |
