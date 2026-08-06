# WP-04.4 — Regras canônicas de `unit_id` clínico

| Entidade | Regra |
|---|---|
| `professional_assignments` | `unit_id` obrigatório; FK na org |
| `appointments` / `clinical_records` / `care_plans` | `unit_id` obrigatório; deve casar com assignment na mesma unit |
| `clinical_record_versions` / `care_plan_actions` / `care_plan_events` | `unit_id` obrigatório (herdado/denormalizado) |
| `unit_id` null | fail-closed (sem acesso / sem escrita) |
| Cross-unit | bloqueado |
| Cross-org | bloqueado |
| Supervisor | somente com `can_supervise(org, unit)` — não org-wide |
| Sessão sem unit resolvível | `UNIT_SCOPE_REQUIRED` / deny clínico |

Collective D01/D02 **fora de escopo**. D02-A **BLOCKED**.
