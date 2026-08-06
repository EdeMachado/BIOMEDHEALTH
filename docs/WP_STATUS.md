# BIOMED HEALTH — WP Status

Atualizado: **2026-08-06**

| WP | Título | Status | Evidência |
|---|---|---|---|
| WP-02 | Security hardening (0019) | **DONE** | `main` + HML 0019 |
| WP-03.1 | Domínio coletivo + application adapter | **DONE** | PRs #45–#47 · merge `d337596…` |
| WP-03.2 | Operational reliability (0020, fail-closed, audit) | **DONE** | PR #48 · merge `cc560ac…` · HML 0020 |
| WP-04.0 | Architecture Baseline v1.0 · fim Foundation | **DONE** | PR #49 · `6aa954b…` |
| **WP-04.1** | Platform Readiness (JWT→app_auth, search_path, E01 sinks) | **DONE** | PR #50 · `cb61981…` · HML **0021** |
| WP-04.2 / E01.x | Auditoria persistente residual | **NEXT** | Sem D02-A |
| D02-A | Analytics agregados | **BLOCKED** | Gate impl. não liberado |

## Registro WP-04.1 (encerrado)

| Item | Valor |
|---|---|
| PR #50 | MERGED |
| SHA `main` | `cb61981ccf30c6f765431fab536dbeb17e3bf114` |
| Migration | `0021_platform_readiness.sql` |
| HML 0021 | **Aplicada e validada A–L** — `docs/WP-04-1_HML_0021_EVIDENCE.md` |
| Rollback | Não utilizado |
| Divergência local/HML | Nenhuma (0001–0021) |
