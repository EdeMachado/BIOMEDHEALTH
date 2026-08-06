# HML — evidência aplicação migration 0020 (WP-04.0)

| Item | Valor |
|---|---|
| Projeto | `biomedhealth-hml` (`nwsqhbdusdxcwquayase`) |
| Data | 2026-08-06 |
| SHA `main` | `cc560ac94b0a0fe946d3ef61f3cc5384bb09f118` |
| PR | #48 MERGED |

## Procedimento

1. **Backup** `.local-backups/hml-pre-0020-20260806-091411/` — `schema.sql`, `data.sql`, `roles.sql` (OK)
2. **Dry-run** — somente `0020_residual_rls_and_audit_rpc.sql` (OK)
3. **db push** — aplicado (OK); notices de `DROP POLICY IF EXISTS` esperados
4. **migration list** — local **0020** = remote **0020**
5. **Validação estrutural** — `WP_03_2_RESIDUAL_RLS_VALIDATION.sql` PASS; RLS true nas residuais; policy `audit_events_select_auditor`; `register_audit_event` auth-only; anon SELECT = 0
6. **Validação comportamental** — owner vê notif/doc; peer/cross negados; RPC audit member OK; cross-org RPC 42501; fixtures removidas

Artefatos locais (gitignored): `.local-backups/hml-post-0020-validation-20260806/`
