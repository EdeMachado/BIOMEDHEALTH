# WP-04.2 — Inventário remoto HML (formal)

| Campo | Valor |
|---|---|
| Data do documento | 2026-08-06 |
| Script | `supabase/policies/WP_04_2_REMOTE_INVENTORY.sql` (somente leitura; variante HML sem `\echo`) |
| HML project | `biomedhealth-hml` / `nwsqhbdusdxcwquayase` |
| Estado deste arquivo | **Evidência real preenchida** pós merge PR #52 + apply 0022 |
| SHA operacional | `cc6252059ce7746b0369f892c445c74860bf1481` |
| Backup pré-0022 | `.local-backups/hml-pre-0022-20260806-104024/` |

Não inclui connection strings, tokens ou segredos.

---

## Evidência real HML (pós-0022)

| Campo | Valor |
|---|---|
| Data/hora apply | 2026-08-06 (~10:40 BRT) |
| Operador | agente operacional (autorização humana explícita) |
| Backup pré-0022 | `hml-pre-0022-20260806-104024` (schema 224 KB / data / roles) |
| Versões em `schema_migrations` | **0001–0022** (`trust_audit_layer`) |
| FORCE RLS | **enabled + forced** |
| Policies audit_events | `audit_events_select_auditor` (SELECT); `audit_events_deny_update`; `audit_events_deny_delete` |
| INSERT policy | **ausente** |
| Grants authenticated (tabela) | SELECT (sim); INSERT/UPDATE/DELETE (**não**) |
| EXECUTE RPC | authenticated **sim**; anon/public **não**; service_role/postgres presentes (esperado) |
| RPC | SECURITY DEFINER; `search_path=pg_catalog, public` |
| Coluna `correlation_id` | presente (nullable) |
| Policies JWT-era | **0** |
| Validação WP-04.2 | PASS (exit 0) |
| Fixtures residuais | **0** |
| Rollback utilizado? | **Não** |

### Privileges tabela `audit_events` (information_schema)

| Grantee | Privileges observados |
|---|---|
| authenticated | SELECT (+ REFERENCES/TRIGGER residuais de catálogo; sem INSERT/UPDATE/DELETE efetivos) |
| postgres / service_role | pleno (papel de plataforma; fora do caminho app) |
| anon | nenhum |

---

## Limite de confiança

Este inventário **não** prova auditoria atômica de negação RLS na mesma transação abortada. Cobertura WP-04.2: negação na aplicação + erro retornado por repository/RPC.
