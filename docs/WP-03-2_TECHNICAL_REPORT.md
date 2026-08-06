# WP-03.2 — Relatório técnico

## Objetivo

Eliminar comportamento imprevisível antes de indicadores reais: RLS residual, fallbacks silenciosos, auditoria persistente preparada, seed/docs consistentes. Sem D02-A e sem mudança de contratos públicos.

## Baseline / encerramento

- Pré-merge: `d337596…` (PR #47); HML até `0019`
- Pós-merge: PR #48 → `cc560ac…`; HML **0020** aplicada no WP-04.0

## Mudanças

| Área | Entrega |
|------|---------|
| DB | `0020_residual_rls_and_audit_rpc.sql` + rollback + validation |
| App | bootstraps assessment/consent/audit fail-closed; Gestão usa bootstrap coletivo canônico |
| Audit | adapter único; RPC `register_audit_event`; UI async list |
| Seed | `config.toml` → `seeds/seed_demo.sql`; 9 roles; 8 jornadas catalog |
| Docs | handoff, backlog E01 parcial, ADRs operacionais 010–012 |

## Testes

| Gate | Resultado |
|------|-----------|
| Quality Gate (CI) | PASS |
| Database Gate (CI) | PASS |
| Unit + Integration | 373 PASS |
| HML 0020 estrutural/comportamental | PASS (WP-04.0) |

## Riscos remanescentes → WP-04.1

1. Políticas JWT legadas em `assessments` / `professional_assignments`
2. E01 incompleto (sinks clínicos/consentimento)
3. Helpers 0017 `search_path = public`
4. Grants amplos históricos em tabelas já com RLS (mitigados nos residuals)

## Próximo

Architecture Baseline v1.0 (WP-04.0) encerrou Foundation. Próximo: **WP-04.1** — sem D02-A.
