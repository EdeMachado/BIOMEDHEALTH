# BIOMED HEALTH — Platform Metrics

Data: **2026-08-06** · Base docs: `6aa954b…` · WP-04.1 em PR

Escala: **1** Inicial · **2** Definido · **3** Controlado · **4** Otimizado

| Dimensão | Nota | Evidência / comentário |
|---|---|---|
| **Arquitetura** | **3.0** | Baseline v1.0 + ADR-013 (JWT→app_auth) |
| **Banco** | **3.0** | 0021 local: JWT residual removido; search_path 0017 endurecido; HML ainda em 0020 |
| **Segurança** | **2.9** | Policies canônicas; E01 consent+clínico sanitizado; E01 coletivo residual |
| **Produto** | **2.5** | Sem features novas; D02-A bloqueado |
| **Testes** | **3.1** | 379 Vitest PASS; validação SQL WP-04.1 A–L |
| **Cobertura** | **2.5** | + sinks audit; E2E/E02 ainda abertos |
| **Débito técnico** | **2.5** | Melhora JWT/search_path; restam #25, B04, gap unit_id, E01 coletivo |
| **Maturidade geral** | **2.8** | Platform Readiness em PR; Intelligence prep, não D02-A |

## Tendência

- ↑ Banco / Segurança / Testes com WP-04.1
- D02-A permanece bloqueado até autorização humana + inventário remoto
