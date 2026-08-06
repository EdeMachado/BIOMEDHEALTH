# ADR-002 — Supabase como backend oficial

## Status

Accepted — 2026-08-06 (Architecture Baseline v1.0)

## Context

O MVP demo usava mocks locais. Persistência real, Auth e RLS exigem um backend canônico para HML/produção.

## Decision

**Supabase** (Postgres + Auth + RLS + RPCs) é o backend oficial da plataforma. O modo mock permanece apenas para demo local quando o modo resolvido é `mock`.

## Consequences

- Schema e segurança vivem em `supabase/migrations`.
- HML (`biomedhealth-hml`) é o ambiente de homologação obrigatório antes de produção.
- Dual-mode repositories: `mock` | `supabase`, sem híbrido silencioso.
