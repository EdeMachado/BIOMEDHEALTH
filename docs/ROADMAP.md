# BIOMED HEALTH — Roadmap (pós-Foundation)

Atualizado: **2026-08-06** · SHA `cb61981…` · PR #50 · HML até **0021**

## Fase I — Foundation (ENCERRADA)

| Marco | Estado |
|---|---|
| Auth / tenant / access | Concluído na prática |
| Demo + clínica C01–C04.2a | Em `main` |
| Coletivo D01 A–D | Em `main` |
| SPEC/Gate D02 documental | Em `main` (impl. bloqueada) |
| Hardening 0019 + 0020 + 0021 | Em `main` + HML |
| Fail-closed + audit adapter | WP-03.2 / PR #48 |
| Architecture Baseline v1.0 | WP-04.0 |
| Platform Readiness | WP-04.1 / PR #50 |

## Fase II — Platform Intelligence (prep)

| WP | Objetivo | Autorização |
|---|---|---|
| **WP-04.2 / E01.x** | Sinks coletivos; negações update/delete; append-only; correlação; inventário remoto; fechamento E01 | **NEXT** |
| D02-A | Analytics agregados reais | **Não autorizado** |
| Motores IA / AI Gateway | Fora do escopo imediato | Bloqueado |
| Nova UX ampla | Fora do escopo imediato | Bloqueado |

## Fora de escopo até autorização humana

- D02-A / indicadores agregados reais
- Auto-diagnóstico clínico
- Produção (corte) sem HML + gates
- Ativação de `enableTransientFallback` / `enableMockDataFallback`
