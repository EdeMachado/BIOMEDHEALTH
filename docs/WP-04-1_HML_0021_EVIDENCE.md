# HML — evidência aplicação migration 0021 (pós PR #50)

| Item | Valor |
|---|---|
| Projeto | `biomedhealth-hml` (`nwsqhbdusdxcwquayase`) |
| Data | 2026-08-06 |
| SHA operacional | `cb61981ccf30c6f765431fab536dbeb17e3bf114` |
| PR | #50 MERGED |
| Rollback | **Não usado** |
| Divergência local/HML | **Nenhuma** (migrations **0001–0021**) |

## Procedimento

1. Sync `main` = `cb61981…` (worktree limpa)
2. Backup `.local-backups/hml-pre-0021-20260806-095557/` — schema/data/roles OK
3. Dry-run — somente `0021_platform_readiness.sql`
4. `db push` — OK
5. `migration list` — local **0021** = remote **0021**
6. `WP_04_1_PLATFORM_READINESS_VALIDATION.sql` — PASS (A–L)
7. Fixtures residuais = 0
8. Policies JWT ausentes; policies modernas presentes; search_path amostra `pg_catalog, public`

## Status

**WP-04.1 encerrado de ponta a ponta.** Próximo: **WP-04.2 / E01.x** (sem D02-A).
