# BIOMED HEALTH — Platform Metrics (Foundation closeout)

Data: **2026-08-06** · Baseline SHA: `cc560ac94b0a0fe946d3ef61f3cc5384bb09f118`

Escala de maturidade: **1** Inicial · **2** Definido · **3** Controlado · **4** Otimizado

| Dimensão | Nota | Evidência / comentário |
|---|---|---|
| **Arquitetura** | **3.0** | Camadas oficiais + ADRs 001–008; bootstraps fail-closed; Application/Domain/Repository alinhados |
| **Banco** | **2.8** | Migrations 0001–0020 no HML; RLS residual 0020; dívida: policies JWT-era 0002; `search_path` 0017 |
| **Segurança** | **2.7** | RLS First; least privilege residual; deny-by-default clínico; fallbacks desligados; E01 incompleto |
| **Produto** | **2.5** | Demo + clínica parcial + D01; D02 só documental; Intelligence não iniciada |
| **Testes** | **3.0** | 373 testes Vitest PASS; Quality Gate CI verde no PR #48 |
| **Cobertura** | **2.4** | Forte em collective/bootstraps; E2E Playwright limitado; suite E02 ainda aberta |
| **Débito técnico** | **2.3** | JWT policies 0002; helpers 0017 search_path; access fallback latente (flag off); issue #25 UI; B04 |
| **Maturidade geral** | **2.7** | Foundation encerrada; pronta para prep Intelligence, não para D02-A |

## Tendência

- ↑ Arquitetura / Testes após WP-03.2 + WP-04.0
- → Produto estável (sem features novas neste WP)
- Dívida de segurança residual → alvo WP-04.1
