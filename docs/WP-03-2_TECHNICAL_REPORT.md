# WP-03.2 — Relatório técnico

## Objetivo

Eliminar comportamento imprevisível antes de indicadores reais: RLS residual, fallbacks silenciosos, auditoria persistente preparada, seed/docs consistentes. Sem D02-A e sem mudança de contratos públicos.

## Baseline

- `origin/main`: `d3375963544cdf381f318dd23b602dc11b4014ad` (PR #47)
- HML: migrations até `0019` (já aplicadas); `0020` neste PR

## Mudanças

| Área | Entrega |
|------|---------|
| DB | `0020_residual_rls_and_audit_rpc.sql` + rollback + validation |
| App | bootstraps assessment/consent/audit fail-closed; Gestão usa bootstrap coletivo canônico |
| Audit | adapter único; RPC `register_audit_event`; UI async list |
| Seed | `config.toml` → `seeds/seed_demo.sql`; 9 roles; 8 jornadas catalog |
| Docs | handoff, backlog E01 parcial, ADRs, WP status |

## Testes

| Gate | Resultado |
|------|-----------|
| Typecheck | PASS |
| Lint | PASS |
| Unit + Integration | 373 PASS |
| Build | PASS |
| DB reset + lint + WP_02/WP_03_2 validation | PASS |

## Riscos remanescentes

1. Políticas JWT legadas em `assessments` / `professional_assignments`
2. `0020` ainda não no HML até merge + push autorizado
3. E01 incompleto (sinks clínicos/consentimento)
4. Grants amplos históricos em tabelas já com RLS (mitigados nos residuals)

## Percentual do projeto

**~78%** da fundação de confiabilidade/segurança do MVP pré-indicadores (estimativa de engenharia, não de escopo comercial).

## Próximo WP recomendado

Aplicar `0020` no HML após merge; em seguida WP de limpeza de stubs UX **ou** modernização JWT residual — **sem** D02-A sem autorização.
