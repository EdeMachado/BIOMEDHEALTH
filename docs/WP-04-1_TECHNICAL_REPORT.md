# WP-04.1 — Relatório técnico (Platform Readiness)

| Campo | Valor |
|---|---|
| Branch | `feat/wp-04-1-platform-readiness` |
| Base SHA | `6aa954b4d3e951d1015d01f54de99ad48628dc2e` |
| Migration | `0021_platform_readiness.sql` |
| D02-A | **Não iniciado / bloqueado** |

## Entregas

1. Inventário `docs/WP-04-1_SECURITY_INVENTORY.md`
2. Migration **0021** + rollback + validação A–L
3. Policies JWT-era substituídas (acesso não ampliado)
4. Helpers 0017 com `search_path` seguro
5. Sinks E01 mínimos: consentimento + escritas clínicas sensíveis (sanitizados)
6. Testes app + script `supabase:validate-hardening` inclui WP-04.1

## Policies

| Antes | Depois |
|---|---|
| `own_data_assessments` | `assessments_select_owner` + `assessments_select_clinical_linked` |
| `professional_assignment_scope` | `professional_assignments_select_self` + `professional_assignments_select_gestor_clinico` |

## Helpers endurecidos (16)

`app_auth.unit_belongs_to_organization`, `has_org_wide_collective_role`, `has_unit_collective_role`, `can_select/write_campaign`, `can_select/write_action_plan`, 9× `public.enforce_*`

## E01

| Sink | Estado |
|---|---|
| Consent accept/revoke | **Fechado** (`createPersistingConsentAuditSink`) |
| Clinical record draft/conclude/reopen | **Fechado** |
| Care plan create/close/note | **Fechado** |
| Appointment create/update | **Fechado** (service; UI agenda update wired when chamada) |
| Auth / route deny | Já existia |
| Coletivo mutações / repository deny amplo | **Parcial** — próximo ticket E01.x |
| Provenance rica / SIEM | Fora de escopo |

## Restrições respeitadas

Sem D02-A, sem analytics, sem AI, sem nova UX, sem C04.2b, sem fallback mock, sem editar 0001–0020, **sem db push HML**.

## Riscos remanescentes

- E01 coletivo e negações repository ainda parciais
- HML sem seed de roles (inventar remoto / seed controlado futuro)
- Issue #25 UI; B04; gap `unit_id` clínico
- Produção não liberada
