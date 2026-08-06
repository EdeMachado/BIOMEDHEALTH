# ADR-003 — Residual 0001 RLS hardening (WP-03.2)

## Status

Accepted — 2026-08-06

## Context

Eight tables from `0001_init_schema.sql` had no RLS (`assessment_responses`, catalog assessment tables, `risk_rules`, `educational_contents`, `notifications`, `documents`), while default grants could expose them to `anon`/`authenticated`.

## Decision

Additive migration `0020_residual_rls_and_audit_rpc.sql`:

- enable RLS + org-member catalog SELECT;
- owner (+ clinical linked where applicable) policies for responses/documents/notifications;
- revoke `anon`/`public` grants on residuals;
- modernize `audit_events` SELECT to `app_auth` roles;
- add `public.register_audit_event`.

Old migrations are not rewritten.

## Consequences

- HML/local must apply `0020` before relying on residual table safety.
- JWT-era policies on `assessments` / `professional_assignments` remain documented debt (not expanded in WP-03.2 beyond grant revoke on those tables).
