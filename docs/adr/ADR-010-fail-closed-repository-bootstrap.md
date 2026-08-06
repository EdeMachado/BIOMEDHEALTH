# ADR-010 — Fail-closed repository bootstrap (WP-03.2)

## Status

Accepted — 2026-08-06

## Context

Assessment and consent UIs previously caught configuration/client errors and silently instantiated mock repositories. That masked Supabase misconfiguration and violated deny-by-default reliability.

## Decision

Every dual-mode domain uses a single application bootstrap adapter that:

1. resolves mode from env (specific flag or `VITE_ENABLE_SUPABASE_AUTH`);
2. returns `{ ok: true, mode, repository|trail }` for intentional mock or configured Supabase;
3. returns `{ ok: false, message }` on any configuration/client failure;
4. never substitutes mock data when Supabase mode is active.

Reference implementation: `bootstrapCollectiveRepository`, extended to assessment, consent, and audit.

## Consequences

- UI must render explicit unavailability when bootstrap fails.
- Demo mode remains available only when mode resolves to `mock`.
- No behavioral change to successful mock or successful Supabase paths.
