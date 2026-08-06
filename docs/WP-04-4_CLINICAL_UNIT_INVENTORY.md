# WP-04.4 — Inventário clínico `unit_id` (pré-implementação)

| Campo | Valor |
|---|---|
| Data | 2026-08-06 |
| Baseline | `8e8d17de8bac6dd1e5d3827b7d5eaf7ea463589e` |
| Branch | `feat/wp-04-4-clinical-unit-scope` |
| Domínio | **Clínico** (C01–C03) — coletivo D01 **fora** |
| D02-A | **BLOCKED** |

## Diagnóstico

| Entidade | Coluna `unit_id` | RLS usa unit? | App grava unit? | Classificação |
|---|---|---|---|---|
| `professional_assignments` | **Não** | Não | Não | `COLUMN_ABSENT` |
| `appointments` | **Não** | Não | Não | `COLUMN_ABSENT` (C01.2 adiou) |
| `clinical_records` | **Não** | Não | Não | `COLUMN_ABSENT` |
| `clinical_record_versions` | **Não** | Não | Não | herdado |
| `care_plans` | **Não** | Não | Não | `COLUMN_ABSENT` + supervisor org-wide |
| `care_plan_actions` / `care_plan_events` | **Não** | Não | Não | herdado |
| `user_roles` / `user_profiles` | **Sim** (access) | Sim (access) | Sim | **não consumido** pelos helpers clínicos (`null::uuid`) |
| Journeys / assessments (linked read) | Não | Via assignment | — | filtro via assignment |

**Gate atual:** `app_auth.has_active_clinical_assignment(org, patient)` = org link + `has_active_role(..., null)` + assignment ativo.  
**Unit absence:** não fail-closed — comportamento = **org-wide entre pacientes vinculados**.  
**Cross-org:** controlado. **Cross-unit:** residual principal.  
**`selectedUnitId`:** hardcoded `null` no AuthContext; `validateSelectedUnit` trata null como **pass**.

## Migration

**0023 necessária** — schema + helpers + policies. Sem migration, o residual documentado **não** fecha.

## Regra canônica (fechada neste WP)

| Entidade | Regra |
|---|---|
| `professional_assignments` | `unit_id` **REQUIRED**; FK ∈ `organization_units` da mesma org |
| `appointments` | `unit_id` **REQUIRED**; deve coincidir com assignment ativo (mesmo pro/paciente/org/unit) |
| `clinical_records` | `unit_id` **REQUIRED**; idem |
| `clinical_record_versions` | `unit_id` **REQUIRED** (cópia imutável do header) |
| `care_plans` | `unit_id` **REQUIRED**; idem |
| `care_plan_actions` / `care_plan_events` | `unit_id` **REQUIRED** (denormalizado do plano) |
| `unit_id = null` em fatos clínicos | **proibido em escrita nova**; linhas legadas null = **invisíveis** (fail-closed RLS) |
| Escopo org-explícito (`null` como D01) | **N/A** no clínico operacional |
| Sessão sem unit resolvível | operação clínica **deny** (`UNIT_SCOPE_REQUIRED`) |
| Supervisor `gestor_clinico` | SELECT apenas na **unit da linha** (`has_active_role(..., unit_id)`), não org-wide |

## Não ampliar acesso

- Não tratar null como “todas as unidades”.
- Não conceder unit B porque existe assignment em unit A.
- Não reabrir JWT-era claims.
- Não iniciar D02-A / B04 / #25.
