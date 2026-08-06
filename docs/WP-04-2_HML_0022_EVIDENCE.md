# HML — evidência aplicação migration 0022 (pós PR #52)

| Item | Valor |
|---|---|
| Projeto | `biomedhealth-hml` (`nwsqhbdusdxcwquayase`) |
| Data | 2026-08-06 |
| SHA operacional | `cc6252059ce7746b0369f892c445c74860bf1481` |
| PR | #52 MERGED |
| Rollback | **Não usado** |
| Divergência local/HML | **Nenhuma** (migrations **0001–0022**) |

## Procedimento

1. Sync `main` = `cc62520…` (worktree limpa)
2. Backup `.local-backups/hml-pre-0022-20260806-104024/` — schema/data/roles OK
3. Dry-run — somente `0022_trust_audit_layer.sql`
4. `db push` — OK (notices DROP POLICY IF EXISTS esperados)
5. `migration list` — local **0022** = remote **0022**
6. `WP_04_2_TRUST_AUDIT_VALIDATION.sql` — PASS (exit 0)
7. Inventário remoto real — `docs/WP-04-2_HML_REMOTE_INVENTORY.md`
8. Fixtures residuais = 0
9. Append-only: authenticated sem INSERT/UPDATE/DELETE; RPC EXECUTE authenticated (não PUBLIC/anon); actor=`auth.uid()`; org link; PHI rejeitada

## Honestidade A–R

| Caso | Nota |
|---|---|
| A–N, P–Q | Validados no HML |
| O | Testes de aplicação (falha de repository ≠ sucesso) |
| R | WP-02/03.2/04.1 no **CI/local**; **não** reexecutados integralmente no HML no apply 0022 |
| RLS-deny same-txn | **Não** afirmado |

## Status

**WP-04.2 operacional no HML (DONE com residuais E01).** D02-A permanece **BLOCKED**.
