# WP-04.0 — Auditoria de consolidação (Foundation closeout)

Data: 2026-08-06 · SHA: `cc560ac94b0a0fe946d3ef61f3cc5384bb09f118` · HML: até **0020**

## Critérios e resultado

| Critério | Resultado | Notas |
|---|---|---|
| TODO críticos | **OK** | Nenhum `TODO`/`FIXME` crítico em `apps/web/src` |
| FIXME críticos | **OK** | Idem |
| Fallback mock automático ativo | **OK** | Sem catch→mock na UI; clínico deny-by-default; Auth `enableTransientFallback: false` |
| sessionStorage para auditoria em modo real | **OK** | Audit mock usa sessionStorage **somente** em modo mock; Supabase usa RPC |
| Repositories duplicados (contratos) | **OK / residual menor** | Um contrato por domínio; factories dual-mode intencionais |
| RLS antiga JWT-era | **RESIDUAL** | `own_data_assessments`, `professional_assignment_scope` (0002) ainda vivas |
| Policies órfãs de auditoria JWT | **OK** | `audit_read_only_for_auditor` removida no HML pós-0020 |
| Helpers sem `search_path` seguro | **RESIDUAL** | Vários helpers **0017** com `search_path = public` (não `pg_catalog, public`); 0019 endureceu subconjunto `app_auth` |
| Duplicidade de bootstrap | **OK / residual menor** | Bootstraps canônicos únicos; Gestão chama `bootstrapCollectiveRepository` em duas páginas (padrão local, mesmo adapter) |
| Tabelas 0001 sem RLS | **OK** | 0020 habilitou RLS + policies nas residuais |

## Latentes (não bloqueantes para encerrar Foundation)

1. `access/factory.ts` — caminho de fallback se `enableTransientFallback` for true (hoje false).
2. Policies JWT-era em assessments / professional_assignments.
3. `search_path = public` em helpers coletivos 0017.
4. Issue #25 (P3 UI coletiva).
5. SUP-B04 / gap clínico `unit_id` / E01 incompleto.

## Veredito

**Aprovado para encerrar FASE I.** Resíduos documentados para **WP-04.1**. Sem regressão detectada nos gates do PR #48; HML 0020 validado (estrutural + comportamental A–E).
