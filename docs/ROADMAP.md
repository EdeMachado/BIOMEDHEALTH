# BIOMED HEALTH — Roadmap (pós-Foundation)

Atualizado: **2026-08-06** · SHA `main` `cc62520…` (PR #52) · WP-04.2 **DONE** · HML **0001–0022**

## Fase I — Foundation (ENCERRADA)

| Marco | Estado |
|---|---|
| Auth / tenant / access | Concluído na prática |
| Demo + clínica C01–C04.2a | Em `main` |
| Coletivo D01 A–D | Em `main` |
| SPEC/Gate D02 documental | Em `main` (impl. bloqueada) |
| Hardening 0019 + 0020 + 0021 + **0022** | Em `main` + HML |
| Fail-closed + audit adapter | WP-03.2 / PR #48 |
| Architecture Baseline v1.0 | WP-04.0 |
| Platform Readiness | WP-04.1 / PR #50 |
| Trust & Audit Layer | WP-04.2 / PR #52 · HML 0022 |

## Fase II — Platform Intelligence (prep)

| WP | Objetivo | Autorização |
|---|---|---|
| WP-04.2 / E01.x | Trust & Audit (sinks coletivos; sanitizer; append-only 0022; inventários) | **DONE** (residuais E01 documentados; E01 **não** 100%) |
| Residual E01 / B04 / #25 / unit_id | Opções humanas paralelas | **Pendente decisão** |
| D02-A | Analytics agregados reais | **BLOCKED** — não iniciar automaticamente |
| Motores IA / AI Gateway | Fora do escopo imediato | Bloqueado |
| Nova UX ampla | Fora do escopo imediato | Bloqueado |

## Fora de escopo até autorização humana

- D02-A / indicadores agregados reais
- Auto-diagnóstico clínico
- Produção (corte) sem HML + gates
- Ativação de `enableTransientFallback` / `enableMockDataFallback`
