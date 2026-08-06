# WP-04.2 — Inventário remoto HML (formal)

| Campo | Valor |
|---|---|
| Data do documento | 2026-08-06 |
| Script | `supabase/policies/WP_04_2_REMOTE_INVENTORY.sql` (somente leitura) |
| HML project | `biomedhealth-hml` / `nwsqhbdusdxcwquayase` |
| Estado deste arquivo no PR | **Esperado** (derivado das migrations 0001–0022) |
| Evidência real HML | Preencher **somente após** merge + autorização humana + apply 0022 + execução do script |

Não inclui connection strings, tokens ou segredos.

---

## Estado esperado (pós-0022, pré-evidência HML)

| Item | Esperado |
|---|---|
| Migrations remotas | 0001–**0022** (`0022_trust_audit_layer`) |
| HML atual (pré-merge WP-04.2) | 0001–**0021** |
| `audit_events` RLS | enabled + **forced** |
| Policies SELECT | `audit_events_select_auditor` |
| Policies UPDATE/DELETE | `audit_events_deny_update`, `audit_events_deny_delete` (`using false`) |
| INSERT policy | **ausente** (deny default) |
| Grants authenticated | **SELECT** apenas |
| Grants anon/public | nenhum |
| RPC `register_audit_event` | SECURITY DEFINER; `search_path=pg_catalog, public` |
| EXECUTE RPC | **authenticated** only (não PUBLIC/anon) |
| Actor | `auth.uid()` (não aceita actor arbitrário) |
| Org | exige `app_auth.has_active_org_link` |
| Resultado | `sucesso` \| `falha` \| `negado` |
| Correlation | obrigatória em `reason` (`corr=…`); coluna `correlation_id` |
| PHI em reason | rejeitada no RPC |
| Policies JWT-era | 0 (`own_data_assessments`, `professional_assignment_scope`) |

---

## Evidência real HML (preencher após apply autorizado)

| Campo | Valor |
|---|---|
| Data/hora apply | _pendente_ |
| Operador | _pendente_ |
| Backup pré-0022 | _pendente_ |
| Versões em `schema_migrations` | _colar saída do inventário_ |
| FORCE RLS | _pendente_ |
| Policies audit_events | _pendente_ |
| Grants | _pendente_ |
| EXECUTE matrix | _pendente_ |
| Validação A–Q local/HML | _pendente_ |
| Fixtures residuais | _pendente_ |
| Rollback utilizado? | _não esperado_ |

---

## Limite de confiança

Este inventário **não** prova auditoria atômica de negação RLS na mesma transação abortada. Cobertura WP-04.2: negação na aplicação + erro retornado por repository/RPC.
