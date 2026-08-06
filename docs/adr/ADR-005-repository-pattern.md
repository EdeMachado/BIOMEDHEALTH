# ADR-005 — Repository Pattern

## Status

Accepted — 2026-08-06 (Architecture Baseline v1.0)

## Context

Acesso a dados espalhado por features dificulta testes, dual-mode e auditoria de erros.

## Decision

Cada domínio sensível expõe um **contrato de repositório** com implementações `mock*` e `supabase*`, criadas por factory a partir do modo.

## Consequences

- Domínios novos não leem PostgREST direto da UI.
- Erros de banco são normalizados no adapter (ex.: `42501` → `CROSS_TENANT_DATA`).
- Testes unitários cobrem contratos e factories.
