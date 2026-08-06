# ADR-003 — Fail Closed

## Status

Accepted — 2026-08-06 (Architecture Baseline v1.0)

## Context

Falhas de configuração ou autorização mascaradas como “dados vazios” ou demo criam falsa disponibilidade e risco LGPD.

## Decision

Em modo Supabase (ou quando o bootstrap falha), o sistema **falha fechado**: retorna erro/indisponibilidade explícita. Não há sucesso degradado silencioso.

## Consequences

- UI deve renderizar estado de erro/indisponibilidade.
- Flags de fallback transitório/mock permanecem **desligadas** por default (`enableTransientFallback: false`, `enableMockDataFallback: false`).
- Detalhe operacional: `ADR-010` (bootstraps WP-03.2).
