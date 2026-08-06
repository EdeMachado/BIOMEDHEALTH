# BIOMED HEALTH — Platform Metrics

Data: **2026-08-06** · SHA `cb61981…` · WP-04.1 **DONE** · HML **0021**

Escala: **1** Inicial · **2** Definido · **3** Controlado · **4** Otimizado

| Dimensão | Nota | Evidência / comentário |
|---|---|---|
| **Arquitetura** | **3.0** | Baseline v1.0 + ADR-013 (JWT→app_auth) |
| **Banco** | **3.1** | HML **0001–0021**; JWT residual removido; search_path 0017 endurecido |
| **Segurança** | **2.9** | Policies canônicas; E01 consent+clínico sanitizado; E01 coletivo residual |
| **Produto** | **2.5** | Sem features novas; D02-A bloqueado |
| **Testes** | **3.1** | 379 Vitest PASS; validação SQL WP-04.1 A–L no HML |
| **Cobertura** | **2.5** | + sinks audit; E2E/E02 ainda abertos |
| **Débito técnico** | **2.5** | Restam E01 coletivo, #25, B04, gap unit_id |
| **Maturidade geral** | **2.9** | Platform Readiness encerrada; próximo E01.x — não D02-A |

## Tendência

- ↑ Banco / Segurança com HML 0021
- Próximo foco: WP-04.2 / E01 residual
