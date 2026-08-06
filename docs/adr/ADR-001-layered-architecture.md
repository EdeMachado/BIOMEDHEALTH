# ADR-001 — Arquitetura em camadas

## Status

Accepted — 2026-08-06 (Architecture Baseline v1.0)

## Context

O produto cresceu com features demo e integração Supabase. Sem fronteiras explícitas, a UI tendia a acoplar clientes, políticas e fallbacks.

## Decision

Adotar camadas obrigatórias: **UI → Application → Domain → Repository → Supabase**. Cada camada tem responsabilidade única; a UI não acessa Supabase diretamente.

## Consequences

- Novos domínios entram via bootstrap de Application + contrato de Repository.
- Refactors que bypassem a Application Layer são rejeitados em review.
- Ver `docs/ARCHITECTURE_BASELINE_v1.md`.
