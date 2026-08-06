# ADR-004 — Fim dos fallbacks silenciosos

## Status

Accepted — 2026-08-06 (Architecture Baseline v1.0)

## Context

Fallbacks automáticos Supabase→mock, coleção vazia como sucesso e escrita fictícia foram rejeitados na clínica (C04.2b) e generalizados como princípio de plataforma.

## Decision

**Proibido** em runtime real:

1. substituir repositório Supabase por mock sob falha;
2. retornar vazio/`null` como sucesso degradado;
3. persistir dados fictícios para “manter a UX”.

Mock só quando o modo resolvido é explicitamente `mock`.

## Consequences

- C04.2b permanece encerrada sem implementação de switch dinâmico.
- Access factory pode conter caminho latente de fallback, mas Auth mantém a flag **false**.
- Novos módulos devem seguir o padrão de bootstrap fail-closed.
