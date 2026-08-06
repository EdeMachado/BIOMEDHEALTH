# BIOMED HEALTH — Roadmap (pós-Foundation)

Atualizado: **2026-08-06** · Baseline: Architecture v1.0 · SHA `cc560ac…` · PR #48 · HML até **0020**

## Fase I — Foundation (ENCERRADA)

| Marco | Estado |
|---|---|
| Auth / tenant / access | Concluído na prática |
| Demo + clínica C01–C04.2a | Em `main` |
| Coletivo D01 A–D | Em `main` |
| SPEC/Gate D02 documental | Em `main` (impl. bloqueada) |
| Hardening 0019 + 0020 | Em `main` + HML |
| Fail-closed + audit adapter | WP-03.2 / PR #48 |
| Architecture Baseline v1.0 | WP-04.0 |

## Fase II — Platform Intelligence (prep)

| WP | Objetivo | Autorização |
|---|---|---|
| **WP-04.1** | JWT→app_auth, search_path 0017, E01 sinks consent/clínico | **IN PR** — sem HML até autorização |
| WP-04.x | Permission / Audit Engine completion (E01 coletivo residual) | Após merge+HML 0021 |
| D02-A | Analytics agregados reais | **Não autorizado** |
| Motores IA / AI Gateway | Fora do escopo imediato | Bloqueado |
| Nova UX ampla | Fora do escopo imediato | Bloqueado |

## Fora de escopo até autorização humana

- D02-A / indicadores agregados reais
- Auto-diagnóstico clínico
- Produção (corte) sem HML + gates
- Ativação de `enableTransientFallback` / `enableMockDataFallback`
