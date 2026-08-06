# BIOMED HEALTH — Roadmap (pós-Foundation)

Atualizado: **2026-08-06** · SHA `main` `9533563…` (PR #51) · WP-04.2 **IN PROGRESS** · HML até **0021**

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
| Baseline pós-#51 | PR #51 · `9533563…` |

## Fase II — Platform Intelligence (prep)

| WP | Objetivo | Autorização |
|---|---|---|
| **WP-04.2 / E01.x** | Trust & Audit: sinks coletivos; sanitizer; append-only 0022; inventário E01/remoto | **IN PROGRESS** (`feat/wp-04-2-trust-audit-layer`; 0022 **não** no HML) |
| D02-A | Analytics agregados reais | **BLOCKED** — não iniciar |
| Motores IA / AI Gateway | Fora do escopo imediato | Bloqueado |
| Nova UX ampla | Fora do escopo imediato | Bloqueado |

## Fora de escopo até autorização humana

- D02-A / indicadores agregados reais
- Auto-diagnóstico clínico
- Produção (corte) sem HML + gates
- Ativação de `enableTransientFallback` / `enableMockDataFallback`
