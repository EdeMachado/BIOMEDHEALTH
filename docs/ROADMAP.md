# BIOMED HEALTH — Roadmap (pós-Foundation)

Atualizado: **2026-08-06** · baseline `a21a184…` · WP-04.3 **IN REVIEW** · HML **0001–0022**

## Fase I — Foundation (ENCERRADA na prática; residual E01 em revisão)

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
| Trust & Audit Layer | WP-04.2 / PR #52 · HML 0022 · docs #53 |
| E01 Residual Closure | **WP-04.3 IN REVIEW** (sem migration; sem HML apply) |

## Fase II — Platform Intelligence (prep)

| WP | Objetivo | Autorização |
|---|---|---|
| WP-04.2 / E01.x | Trust & Audit | **DONE** |
| WP-04.3 | Fechar residuais E01 tratáveis + inventário final | **IN REVIEW** |
| unit_id / B04 / #25 | Opções humanas | **Pendente decisão** |
| D02-A | Analytics agregados reais | **BLOCKED** — não iniciar automaticamente |
| Motores IA / AI Gateway | Fora do escopo imediato | Bloqueado |
| Nova UX ampla | Fora do escopo imediato | Bloqueado |

## Fora de escopo até autorização humana

- D02-A / indicadores agregados reais
- Auto-diagnóstico clínico
- Produção (corte) sem HML + gates
- Ativação de `enableTransientFallback` / `enableMockDataFallback`
- Apply de migration nova no HML sem merge + autorização
