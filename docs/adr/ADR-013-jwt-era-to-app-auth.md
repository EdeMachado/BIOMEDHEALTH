# ADR-013 — Modernização JWT-era → app_auth (WP-04.1)

## Status

Accepted — 2026-08-06

## Context

Residual RLS from migration 0002 (`own_data_assessments`, `professional_assignment_scope`) authorized via JWT claims `app.organization_id` / `app.role`, which can drift from membership tables and granted org-wide clinical SELECT without assignment.

## Decision

Replace those policies with `app_auth.has_active_org_link`, `has_active_role`, and `has_active_clinical_assignment`. Access is **tightened** (gestor_clinico/medico no longer see all assessments by claim alone). Harden 0017 DEFINER helpers with `search_path = pg_catalog, public` via migration **0021** without editing historical migrations.

## Consequences

- JWT claims are no longer authorization source for these tables.
- Requires membership + assignment rows for clinical assessment read.
- Rollback reopens JWT risk surface (documented in `0021_platform_readiness_rollback.sql`).
