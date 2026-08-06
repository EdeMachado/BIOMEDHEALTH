# WP-03.2 — Operational Reliability Hardening

## Status

Implemented on branch `feat/wp-03-2-operational-reliability-hardening` (base `d337596` / PR #47).

## Delivered

1. **Migration `0020_residual_rls_and_audit_rpc`**
   - RLS on residual 0001 tables: assessment catalog, responses, risk_rules, educational_contents, notifications, documents
   - Grant sandwich (anon/public revoked)
   - Audit SELECT modernized to `app_auth`
   - RPC `public.register_audit_event`
2. **Silent mock fallbacks removed** for assessment + consent; collective bootstrap reused in Gestão
3. **Unified audit adapter** (mock only when mode=mock; supabase via RPC)
4. **Seed + config.toml** aligned (`seeds/seed_demo.sql`, roles expanded, scope documented)
5. **ADRs** under `docs/adr/`
6. **Handoff/backlog** updated; D02-A not started

## Verification (local)

- typecheck / lint / unit+integration (373) / build: PASS
- `supabase db reset` applies `0001`–`0020` + seed: PASS
- `WP_02` + `WP_03_2` validation SQL: PASS
- Database Gate script: `npm run supabase:verify`

## Remaining risks

- JWT-era policies still on `assessments` / `professional_assignments` (documented debt)
- HML still needs `0020` push after merge
- SUP-E01 not fully closed (consent/clinical audit sinks)
- Seed does not provision Auth users (intentional)

## Project maturity (estimate)

~78% of MVP reliability/security foundation for pre-indicator phase (was ~72% post-0019/PR47). Not a product-completion percentage.

## Recommended next WP

**WP-03.3** — apply `0020` to HML + close JWT leftover policies on assessments/assignments **or** UX stub cleanup (agenda usuário / indicadores demo) — still **without** D02-A unless separately authorized.
