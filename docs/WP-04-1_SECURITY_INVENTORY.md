# WP-04.1 — Security Inventory

| Campo | Valor |
|---|---|
| Data | 2026-08-06 |
| Branch | `feat/wp-04-1-platform-readiness` |
| Base SHA | `6aa954b4d3e951d1015d01f54de99ad48628dc2e` |
| HML | `biomedhealth-hml` (`nwsqhbdusdxcwquayase`) — migrations **0001–0020** (pré-0021) |

Inventário somente leitura. **Sem** `db push` neste documento.

---

## 1. Policies JWT-era

### Derivado das migrations

| Policy | Tabela | Origem | Estado após 0001–0020 |
|---|---|---|---|
| `own_data_assessments` | `assessments` | 0002 | **Ainda viva** |
| `professional_assignment_scope` | `professional_assignments` | 0002 | **Ainda viva** |
| `org_isolation_user_consents` | `user_consents` | 0002 | Substituída (0006) |
| `clinical_only_allowed_roles` | `clinical_records` | 0002 | Substituída (0013) |
| `care_plan_only_allowed_roles` | `care_plans` | 0002 | Substituída (0014) |
| `risk_results_collective_or_owner` | `risk_results` | 0002 | Substituída (0019) |
| `manager_campaigns_same_org` | `campaigns` | 0002 | Substituída (0017) |
| `manager_action_plans_same_org` | `action_plans` | 0002 | Substituída (0017) |
| `audit_read_only_for_auditor` | `audit_events` | 0002 | Substituída (0020) |

Dependência JWT residual: `auth.jwt() ->> 'app.organization_id'` e `auth.jwt() ->> 'app.role'`.

### Estado HML (confirmado 2026-08-06)

| Policy | Presente |
|---|---|
| `own_data_assessments` | **Sim** |
| `professional_assignment_scope` | **Sim** |

### Divergência local vs HML

Nenhuma para estas duas: ambas existem no histórico de migrations e no HML até 0020.

### Risco

- Claims JWT podem divergir de `user_organizations` / `user_roles`.
- `own_data_assessments` concede SELECT org-wide a `medico` / `profissional_saude` / `gestor_clinico` **sem** exigir vínculo de assignment — mais amplo que o padrão clínico canônico (`has_active_clinical_assignment`).

### Ação proposta (0021)

Substituir por policies `app_auth` **mais restritivas** (owner + clinical assignment; assignments: self + `gestor_clinico` via role table).

---

## 2. Funções SECURITY DEFINER e `search_path`

### Helpers 0017 com `search_path = public` (inseguro residual)

Confirmado no HML amostral (`search_path=public`):

- `app_auth.unit_belongs_to_organization`
- `app_auth.has_org_wide_collective_role`
- `app_auth.has_unit_collective_role`
- `app_auth.can_select_campaign` / `can_write_campaign`
- `app_auth.can_select_action_plan` / `can_write_action_plan`
- 9× `public.enforce_*` triggers coletivos

### Já endurecidos (`pg_catalog, public`)

Helpers `app_auth` de 0004 via **0019**; RPCs clínicas 0010–0014; `register_audit_event` (0020); INVOKER 0018 com `pg_catalog, public, auth`.

### Ação proposta (0021)

`ALTER FUNCTION … SET search_path = pg_catalog, public` nos 16 DEFINER da 0017; reafirmar REVOKE PUBLIC/anon e grants mínimos.

---

## 3. Grants / EXECUTE

| Superfície | Estado esperado pós-0020 | Ação 0021 |
|---|---|---|
| `register_audit_event` | authenticated only | Manter |
| Helpers `app_auth` canônicos | authenticated; anon/public revoked | Manter |
| Triggers `enforce_*` 0017 | sem EXECUTE app roles | Manter + search_path |
| `can_select_*` / `can_write_*` | EXECUTE authenticated | Manter + search_path |

---

## 4. RPCs de auditoria

| Item | Estado |
|---|---|
| `public.register_audit_event` | Implementada (0020) |
| SELECT `audit_events_select_auditor` | Implementada |
| INSERT direto cliente | Negado (somente RPC) |

---

## 5. Sinks E01 (aplicação)

| Domínio | Estado pré-WP-04.1 | Ação neste WP |
|---|---|---|
| Auth login/logout / route deny | Persistente via facade | Manter |
| Coletivo | Sem sink dedicado de mutação | **Fora** (não improvisar) |
| Consentimento | `createNoopConsentAuditSink` | **Fechar** sink canônico sanitizado |
| Clínico (ficha/plano/agenda writes) | Ausente | **Fechar** sink mínimo sanitizado |
| Negação repository / falhas | Parcial (guards) | Documentar residual |
| Correlação / provenance | Fraca (`entity_id` null no adapter) | Melhorar `entityId` + `correlationId` sanitizados |

---

## 6. Claims JWT legadas (código)

Uso restante relevante: policies 0002 residuais. Display name em `0011` lê `raw_user_meta_data` (não é policy de autorização).

---

## 7. Resumo de ações 0021 + app

1. Migration **0021** — policies JWT → `app_auth`; search_path 0017; grants reassert.
2. App — consent + clinical audit sinks; sanitização metadata; adapter com `entityId`.
3. Validação SQL WP-04.1 A–L; rollback documentado.
4. **Não** aplicar HML até merge + autorização humana.
