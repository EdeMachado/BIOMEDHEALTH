# WP-04.4 — Relatório técnico (Clinical Unit Scope Closure)

| Campo | Valor |
|---|---|
| Status | **READY FOR REVIEW** (PR; sem merge; sem HML apply) |
| Baseline | `8e8d17de8bac6dd1e5d3827b7d5eaf7ea463589e` |
| Branch | `feat/wp-04-4-clinical-unit-scope` |
| Migration | `0023_clinical_unit_scope.sql` + rollback |
| HML | **não** aplicar até merge + autorização |
| D02-A | **BLOCKED** |
| Inventário | `docs/WP-04-4_CLINICAL_UNIT_INVENTORY.md` |
| Regras | `docs/WP-04-4_CANONICAL_UNIT_RULES.md` |

## Antes → Depois

| Área | Antes | Depois |
|---|---|---|
| Schema clínico | sem `unit_id` | `unit_id` em assignments, agenda, ficha, plano, actions, events, versions |
| Helpers | `has_active_role(..., null)` | 3-arg assignment fail-closed; supervisor unit-scoped |
| Cross-unit | org-wide entre vinculados | bloqueado |
| Sessão | `selectedUnitId` null passa | resolve unit única ou deny clínico |
| Ampliação | — | **não** amplia (null ≠ todas as units) |

## Próximo

Último ciclo estrutural previsto. Após merge + decisão humana: pivot para produto/valor. **Não** auto D02-A.
