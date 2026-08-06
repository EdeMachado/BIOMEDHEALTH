# BIOMED HEALTH — Platform Metrics

Data: **2026-08-06** · SHA `main` `ee0eff6…` (PR #54) · WP-04.3 **DONE** · HML **0001–0022** (sem 0023)

Escala: **1** Inicial · **2** Definido · **3** Controlado · **4** Otimizado

| Dimensão | Nota | Evidência / comentário |
|---|---|---|
| **Arquitetura** | **3.2** | Baseline v1.0 + Engineering Book; contrato E01 residual consolidado |
| **Banco** | **3.3** | HML **0001–0022**; WP-04.3 sem migration (justificado) |
| **Segurança** | **3.3** | Pré-auth limite explícito; RLS deny classificado; care-plan sem PHI |
| **Produto** | **2.5** | Sem features novas neste WP; D02-A **BLOCKED** |
| **Testes** | **3.3** | Vitest **401** + validações WP-02…04.3 |
| **Cobertura** | **2.9** | Residuais E01 tratáveis fechados ou documentados |
| **Débito técnico** | **2.4** | **unit_id** (próximo recomendado), B04, #25, Edge pré-auth, outbox RLS |
| **Maturidade geral** | **3.2** | Fundação auditável honesta; E01 **não** 100%; pivot pós-`unit_id` para entrega funcional |

## Tendência

- WP-04.3 **DONE** em `main` — sem HML apply
- Próximo residual estrutural recomendado: **gap clínico `unit_id`**
- Depois: regime de produto / valor — sem fundação por hábito
- **Não** auto-iniciar D02-A
