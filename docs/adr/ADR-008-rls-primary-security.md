# ADR-008 — RLS como segurança primária

## Status

Accepted — 2026-08-06 (Architecture Baseline v1.0)

## Context

Controles só no frontend são insuficientes para multi-tenant saúde. O Postgres deve negar linhas indevidas mesmo sob cliente comprometido.

## Decision

**RLS First:** políticas no banco são a segurança primária; grants least-privilege; helpers `app_auth` com `search_path` seguro onde endurecidos; RPCs SECURITY DEFINER apenas com checagens explícitas.

## Consequences

- Migrations 0019/0020 harden helpers e tabelas residuais.
- App policies complementam UX; nunca substituem RLS.
- Dívida conhecida: policies JWT-era em `assessments` / `professional_assignments` (0002); helpers 0017 com `search_path = public` — rastrear em WP-04.1 / E02.
- Detalhe residual: `ADR-012`.
