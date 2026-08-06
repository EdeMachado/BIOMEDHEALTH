# ADR-007 — Domain Layer

## Status

Accepted — 2026-08-06 (Architecture Baseline v1.0)

## Context

Regras de escopo (org×unit), papéis e guards não devem viver só em SQL nem só na UI.

## Decision

A **Domain Layer** (`apps/web/src/domains/**`) concentra tipos, políticas e guards de negócio compartilhados, independentemente do adapter de persistência.

## Consequences

- Gestão coletiva já possui `domains/collective` (contextScope, policy, guards).
- Domínios futuros (analytics, clinical engines) entram nesta camada antes da UI.
- Domain não conhece PostgREST nem sessionStorage.
