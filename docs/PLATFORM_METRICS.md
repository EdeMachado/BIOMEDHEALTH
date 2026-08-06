# BIOMED HEALTH — Platform Metrics

Data: **2026-08-06** · SHA `main` `9533563…` (PR #51) · WP-04.2 **IN PROGRESS** · HML **0021** (0022 não aplicada)

Escala: **1** Inicial · **2** Definido · **3** Controlado · **4** Otimizado

| Dimensão | Nota | Evidência / comentário |
|---|---|---|
| **Arquitetura** | **3.0** | Baseline v1.0 + Engineering Book v1; contrato audit no branch WP-04.2 |
| **Banco** | **3.1** | HML **0001–0021** estável; **0022** só no branch (append-only) — ainda não no HML |
| **Segurança** | **3.0** | E01 consent+clínico+coletivo melhorado (sanitizer/sinks); residual E01 permanece |
| **Produto** | **2.5** | Sem features novas; D02-A **BLOCKED** |
| **Testes** | **3.1** | Suíte Vitest + inventários E01; validação HML 0022 pendente |
| **Cobertura** | **2.6** | Sinks audit ampliada (coletivo); E2E/E02 e residual E01 ainda abertos |
| **Débito técnico** | **2.5** | Residual E01, #25, B04, gap `unit_id` |
| **Maturidade geral** | **3.0** | Trust layer em progresso (E01 parcial→melhorado, **não** completo); não D02-A |

## Tendência

- ↑ Segurança / cobertura com sinks coletivos + sanitizer (WP-04.2 branch)
- E01: parcial → **melhorado**, fechamento ainda pendente
- Próximo foco: residual E01 / 0022 HML quando autorizado — **não** D02-A
