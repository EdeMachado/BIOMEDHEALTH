# WP-04.3 — Inventário final E01 (Residual Closure)

| Campo | Valor |
|---|---|
| Data | 2026-08-06 |
| Baseline início | `a21a184174bb901de3199a1051705bd59dd1b9da` (`origin/main`) |
| Branch | `feat/wp-04-3-e01-residual-closure` |
| Migration nova | **Não** — 0022 já cobre append-only / corr / PHI; provenance em metadata |
| HML | **0001–0022** (sem apply novo neste WP) |
| E01 | **Não** 100% — limites técnicos/jurídicos documentados |
| D02-A | **BLOCKED** |

Classificação: **concluído** · **parcial** · **não aplicável** · **bloqueado por limite técnico** · **bloqueado por decisão jurídica** · **futuro**.

---

## A. Autenticação

| Evento / fluxo | Classificação | Notas |
|---|---|---|
| login sucesso (pós-auth) | **concluído** | sanitize + correlationId + provenance |
| logout | **concluído** | sanitize |
| access_denied (RequireRole) | **concluído** | código canônico (ex-`rota_negada`); provenance `application_precheck_denied` |
| membership deny (antes de signOut) | **concluído** | audit enquanto `auth.uid` ainda existe |
| login failure pré-auth (Supabase) | **bloqueado por limite técnico** | RPC exige `auth.uid`; sem INSERT anon; sem Edge Function neste WP; `persisted=false` + `pre_auth_rpc_requires_auth_uid` |
| login failure pré-auth (mock) | **parcial** | fingerprint (`email_fp`) local; sem e-mail completo / senha / token |
| IP / rate-limit pré-auth | **futuro** | rate limiting externo / Edge se justificado legalmente |

## B. Consentimento

| Evento | Classificação | Notas |
|---|---|---|
| accept / revoke | **concluído** | sinks WP-04.1/04.2 |
| falha repository consent | **parcial** | coberto parcialmente pelos sinks; sem expansão neste WP |

## C. Clínica — ficha / agenda

| Evento | Classificação | Notas |
|---|---|---|
| clinical_record draft/conclude/reopen | **concluído** | sinks existentes |
| clinical_appointment create/update | **concluído** | sinks existentes |
| cancel appointment (se existir) | **futuro** | fora do escopo residual obrigatório |

## D. Care-plan (granularidade)

| Evento | Classificação | Notas |
|---|---|---|
| care_plan_created | **concluído** | |
| care_plan_updated | **concluído** | field_category sem valor clínico |
| care_plan_closed | **concluído** | previous/next status enum |
| care_plan_suspended | **concluído** | |
| care_plan_note_added | **concluído** | **sem** texto da nota |
| care_plan_reassessment_added | **concluído** | |
| care_plan_action_created / updated / status_changed | **concluído** | actions distintas |
| care_plan_note_removed / assignment_changed / scope_changed | **não aplicável** / **futuro** | operações inexistentes ou sem API estável |
| PHI em metadata | **concluído** (garantia negativa) | testes + sanitizer + validação SQL |

## E. Coletivo

| Evento | Classificação | Notas |
|---|---|---|
| campaign / action_plan audited* | **concluído** | WP-04.2 + provenance em deny/error neste WP |

## F. LGPD

| Operação | Classificação | Notas |
|---|---|---|
| exportar dados | **indisponível** (honesto) | `lgpd_capability_unavailable`; sem toast de sucesso falso |
| corrigir dados | **indisponível** (honesto) | idem |
| excluir / apagar | **bloqueado por decisão jurídica** | retenção legal; UI não simula exclusão irreversível |
| revogar consentimento | **parcial** | fluxo de consentimento existente ≠ “LGPD delete” |
| portabilidade / anonimização / histórico LGPD | **futuro** / **bloqueado por arquitetura** | sem backend persistente de solicitação além do audit de indisponibilidade |
| solicitação persistente canônica | **parcial** | evento `lgpd_capability_unavailable` quando actor presente |

## G. RLS deny / provenance

| Item | Classificação | Notas |
|---|---|---|
| classificação sanitizada do erro | **concluído** | `classifyPrivilegeDenial` |
| provenance enum | **concluído** | app + metadata allowlist |
| `database_rls_denied_inferred` | **concluído** | após evidência de erro repo/RPC |
| `database_rls_denied_confirmed` | **bloqueado por limite técnico** | nunca emitido automaticamente; exigiria prova out-of-band |
| audit na mesma transação abortada | **bloqueado por limite técnico** | residual **controlado**, não eliminado; outbox/trigger = ticket futuro |
| anti-duplicidade app | **parcial** | correlationId + códigos; sem outbox |

## H. Contrato / infraestrutura

| Item | Classificação | Notas |
|---|---|---|
| actions / source / result / provenance | **concluído** (contrato app) | consolidado WP-04.3 |
| correlationId | **concluído** | |
| append-only / sem INSERT direto / sem UPDATE / DELETE | **concluído** | 0022 + validação WP-04.3 |
| sessionStorage em modo Supabase | **concluído** (garantia negativa) | proibido |
| fallback silencioso mock | **concluído** (garantia negativa) | proibido |
| Edge Function pré-auth | **futuro** | se decisão humana |

---

## Resumo executivo

| Categoria | Contagem aproximada |
|---|---|
| Residuais **eliminados / tornados honestos** | pré-auth documentado; LGPD sem falso sucesso; RLS classificação; care-plan fine-grained; access_denied |
| Residuais **controlados** (limite técnico) | pré-auth Supabase persistência; RLS same-txn confirmed |
| Bloqueados jurídicos | exclusão LGPD simplista |
| Futuros | Edge pré-auth; outbox; portabilidade; B04; #25; unit_id |

**E01 não é 100%.** Foundation/prontidão pode encerrar a fase residual tratável sem pendências ocultas.
