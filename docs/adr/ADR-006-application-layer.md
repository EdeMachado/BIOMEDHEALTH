# ADR-006 — Application Layer

## Status

Accepted — 2026-08-06 (Architecture Baseline v1.0)

## Context

A resolução de modo e a criação de clientes precisam ser centralizadas para fail-closed e DI.

## Decision

A **Application Layer** (`apps/web/src/application/**`) é obrigatória para bootstraps: resolve env/modo, instancia factory e devolve `{ ok: true, ... }` ou `{ ok: false, message }`.

## Consequences

- Exemplos canônicos: collective, assessment, consent, audit.
- UI consome apenas o resultado tipado do bootstrap.
- Duplicar lógica de factory dentro de features é dívida a eliminar.
