# BIOMED HEALTH — WP Status

Atualizado: **2026-08-06**

| WP | Título | Status | Evidência |
|---|---|---|---|
| WP-02 | Security hardening (0019) | **DONE** | `main` + HML 0019 |
| WP-03.1 | Domínio coletivo + application adapter | **DONE** | PRs #45–#47 · merge `d337596…` |
| WP-03.2 | Operational reliability (0020, fail-closed, audit) | **DONE** | PR #48 · merge `cc560ac…` · HML 0020 |
| WP-04.0 | Architecture Baseline v1.0 · fim Foundation | **DONE** | PR #49 · `6aa954b…` |
| **WP-04.1** | Platform Readiness (JWT→app_auth, search_path, E01 sinks) | **IN PR** | branch `feat/wp-04-1-platform-readiness` · migration **0021** · **sem merge/HML até autorização** |
| D02-A | Analytics agregados | **BLOCKED** | Gate impl. não liberado |

## Registro WP-04.1 (pré-merge)

| Item | Valor |
|---|---|
| Base | `6aa954b4d3e951d1015d01f54de99ad48628dc2e` |
| Migration | `0021_platform_readiness.sql` |
| Validação local | WP-02 + WP-03.2 + WP-04.1 PASS |
| Testes | 379 PASS |
| HML 0021 | **Não aplicada** (aguardando merge + autorização humana) |
