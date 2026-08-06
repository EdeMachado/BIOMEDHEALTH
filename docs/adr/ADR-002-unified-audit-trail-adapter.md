# ADR-002 — Unified audit trail adapter (WP-03.2)

## Status

Accepted — 2026-08-06

## Context

Audit events were written only to `sessionStorage` (`biomed_demo_audit_events`), including when operators might expect persistence. Table `audit_events` existed without an authenticated write path.

## Decision

Introduce one adapter (`bootstrapAuditTrail` / `AuditTrail`):

- **mock mode**: sessionStorage (or in-memory for tests) — only when mock is selected;
- **supabase mode**: append via `public.register_audit_event` (SECURITY DEFINER, org-link checked) and list via RLS `audit_events_select_auditor`.

Public helpers `registerAuditEvent` / `listAuditEvents` / `listAuditEventsAsync` remain the call-site contract.

## Consequences

- Supabase audit never falls back to sessionStorage.
- Full SUP-E01 enrichment (richer metadata, consent/clinical sinks) remains future work.
- Email is not a DB column; supabase list maps `actor_user_id` for display.
