# WP-04.2 — Inventário E01 (Trust & Audit Layer)

| Campo | Valor |
|---|---|
| Data | 2026-08-06 |
| Baseline | `9533563b0f19e6cf4b16a5dc1b4e3181a07a4dd6` (merge PR #51) |
| Branch | `feat/wp-04-2-trust-audit-layer` |
| HML | 0001–0021 (pré-0022) |

Adapter canônico: `registerAuditEvent` → bootstrap → mock (`sessionStorage`) **ou** RPC `register_audit_event`.

---

## A. Autenticação

| Ação | Origem | Mock | Supabase | Sink | Sucesso | Erro | Negado | Metadata | Lacuna | Risco | Rec. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| login | AuthContext | sessionStorage | RPC | direto | sim* | parcial | parcial | livre | bypass sanitize; falha pré-auth não persiste (sem `auth.uid`) | médio | sanitize + path pré-auth residual |
| logout | AuthContext | sim | sim | direto | sim | — | — | livre | — | baixo | sanitize |
| rota_negada | guards RequireRole | sim | sim | direto | — | — | sim | texto livre | sem path; fora allowlist | médio | `access_denied` + entityId rota |
| RequireAuth redirect | guards | — | — | nenhum | — | — | — | — | anônimo não audita | baixo | documentar |

\*Supabase: login falha/negado após `signOut` não persiste via RPC.

## B. Consentimento

| Ação | Mock | Supabase | Sink | Sucesso | Erro | Negado | Lacuna |
|---|---|---|---|---|---|---|---|
| accept | sim | RPC | persistingConsent | sim | **não** | **não** | falhas repository |
| revoke | sim | RPC | persistingConsent | sim | **não** | **não** | idem |
| sem user | noop | noop | noop | — | — | — | intencional |

## C. Clínica

| Ação | Sink | Sucesso/Erro | Negado app | Lacuna |
|---|---|---|---|---|
| ficha draft/conclude/reopen | clinical persisting | sim | não (validação silenciosa) | negação de contexto |
| plano create/close/note | clinical | sim | não | update plano / ações sem audit |
| agenda create/update | clinical | sim | não | cancel se existir |

## D. Coletivo — **COBERTO neste WP (application wrappers)**

| Operação | Sink | Sucesso | Erro repo | Negado app | Fail-closed audit |
|---|---|---|---|---|---|
| campaign create/update/close/delete | `collectiveAuditSink` via `audited*` | sim | sim | sim | sim (`AUDIT_REQUIRED_FAILED`) |
| action plan create/update/advance/delete | idem | sim | sim | sim | sim |

UI (`ManagementPages`) chama apenas wrappers em `application/collective` — sem RPC de auditoria direta.

## E. LGPD

| Operação | Estado |
|---|---|
| export / correção (UI demo) | **sem** persistência / audit — residual (fora do núcleo WP-04.2) |

## F. Infraestrutura

| Item | Estado |
|---|---|
| `register_audit_event` | DEFINER; actor=`auth.uid()`; org link; result enum |
| INSERT tabela cliente | sem grant |
| UPDATE/DELETE policies | **deny explícito** (`audit_events_deny_*`) + FORCE RLS (0022) |
| sessionStorage | só modo mock |
| sanitize allowlist | códigos coletivo + sources fechadas + correlationId obrigatório |
| correlationId | consent/clínico/coletivo; coluna `correlation_id` na tabela |
| provenance/source | enum fechado no contrato app (`auth`…`application`); DB `origin` permanece string curta |

## Limites RLS (não improvisar)

Negação pura por RLS pode reverter a transação e impedir INSERT de auditoria no mesmo fluxo.  
WP-04.2 cobre: **negação na aplicação** + **erro retornado pelo repository/RPC**.  
“RLS denied” atômico confiável = residual documentado (futuro: outbox / DEFINER dedicado).

## Decisões deste WP

1. Instrumentar coletivo via **application wrappers** (não espalhar em React).
2. Expandir contrato + sanitizer allowlist.
3. Migration **0022** — append-only explícito + validação RPC.
4. Auth/LGPD pré-auth e export demo = residual E01.y.
