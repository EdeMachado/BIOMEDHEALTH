# WP-03.2 — Operational Reliability Hardening

## Status

**DONE** — merged via [PR #48](https://github.com/EdeMachado/BIOMEDHEALTH/pull/48) (`cc560ac…`, 2026-08-06). Migration **0020** aplicada e validada no HML no WP-04.0.

## Delivered

1. **Migration `0020_residual_rls_and_audit_rpc`**
   - RLS on residual 0001 tables: assessment catalog, responses, risk_rules, educational_contents, notifications, documents
   - Grant sandwich (anon/public revoked)
   - Audit SELECT modernized to `app_auth`
   - RPC `public.register_audit_event`
2. **Silent mock fallbacks removed** for assessment + consent; collective bootstrap reused in Gestão
3. **Unified audit adapter** (mock only when mode=mock; supabase via RPC)
4. **Seed + config.toml** aligned (`seeds/seed_demo.sql`, roles expanded, scope documented)
5. **ADRs operacionais** `ADR-010`…`012` (renumerados no WP-04.0; oficiais de arquitetura são `ADR-001`…`008`)
6. **Handoff/backlog** updated; D02-A not started

## Verification

- CI Quality + Database gates: SUCCESS (run `31100226215`)
- Local: typecheck / lint / 373 tests / build PASS
- HML: backup → dry-run → push → list → estrutural + comportamental PASS (ver `docs/WP-04-0_HML_0020_EVIDENCE.md`)

## Remaining risks (handoff to WP-04.1)

- JWT-era policies still on `assessments` / `professional_assignments`
- SUP-E01 not fully closed (consent/clinical audit sinks)
- Helpers 0017 `search_path = public`
- Seed does not provision Auth users (intentional)

## Recommended next

**WP-04.1** — Platform Readiness (dívida segurança / prep Intelligence). **Não** iniciar D02-A.
