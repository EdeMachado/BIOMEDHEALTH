# BIOMED HEALTH — Engineering Book v1

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data | 2026-08-06 |
| Baseline `main` (início WP-04.2) | `9533563b0f19e6cf4b16a5dc1b4e3181a07a4dd6` (merge PR #51) |
| Escopo | Documento de entrada para desenvolvedores e auditores |

Este livro **não substitui** Architecture Baseline, ADRs, handoff, backlog ou relatórios técnicos. Serve como índice + princípios consolidados.

---

## 1. Propósito da plataforma

Ecossistema modular de saúde digital (BR): Minha BioMed (indivíduo), BioMed Clínica (cuidado), BioMed Gestão (coletivo agregado), evoluções Ocupacional e Intelligence. Dados clínicos individuais não transitam na superfície de gestão coletiva.

## 2. Arquitetura em camadas

```
UI (features) → Application (bootstrap, audited mutations)
  → Domain (contratos, sanitizers, sinks)
  → Repositories (mock | supabase)
  → Supabase (RLS + RPC SECURITY DEFINER)
```

Regra: componentes React não concentram regra de negócio nem chamam RPC de auditoria diretamente.

## 3. Princípios de engenharia

- Fail-closed; sem fallback silencioso para mock quando o modo é Supabase.
- Least privilege; org link + papéis em tabelas (`app_auth`), não JWT claims soltos.
- Append-only para trilha de auditoria persistente.
- Sem PHI/PII/clínico bruto em logs de auditoria.
- Dual-mode explícito (mock vs supabase); isolamento de sinks.

## 4. Estratégia de banco

Migrations numeradas e imutáveis após merge. Toda mudança = nova migration + rollback em `supabase/rollbacks/`. HML só após merge + gates verdes + autorização humana. Baseline HML pós WP-04.1: **0001–0021**; WP-04.2 introduz **0022** (não aplicar no HML neste PR).

## 5. Estratégia de RLS

Policies modernas via `app_auth.*`. Policies JWT-era removidas em 0021. Collective helpers com `search_path` seguro. Deny-by-default: ausência de policy = sem acesso.

## 6. Estratégia de auditoria

Contrato canônico: `AuditEventInput` (`success|error|denied`, `source` fechada, `correlationId` obrigatório). Sanitizer allowlist (`sanitizeAuditMetadata`). Persistência: RPC `register_audit_event` (actor=`auth.uid()`, org validada, timestamp servidor). Mutações sensíveis coletivas: wrappers `audited*` com fail-closed (`AUDIT_REQUIRED_FAILED`).

**Limite:** negação pura por RLS na mesma transação abortada **não** é afirmada como evento persistido. Cobertura atual: negação na aplicação + erro retornado pelo repository/RPC.

## 7. Estratégia de mocks

Mock usa `sessionStorage` apenas no modo mock. Modo supabase: sem sessionStorage para auditoria; sem fallback automático.

## 8. Estratégia fail-closed

Bootstrap sem env válido → erro explícito. Auditoria obrigatória falhou após mutação → resultado de negócio não é relatado como sucesso limpo. Cross-tenant e ausência de vínculo → deny.

## 9. Fluxo de PR e gates

Um PR revisável por WP. Quality Gate + Database Gate verdes. Sem merge pelo agente sem ordem. Sem push de migration HML sem autorização explícita.

## 10. Política de migrations

Não editar 0001–N já mergeadas. Nova migration + rollback que restaura estado anterior sem apagar eventos históricos e sem ampliar grants silenciosamente.

## 11. Política de rollback

Scripts em `supabase/rollbacks/`. Declarar riscos reabertos. Preferir não deletar dados de auditoria.

## 12. Definition of Done (plataforma)

Typecheck, lint, testes, build, `supabase db reset`, `db lint`, validações WP-02 / WP-03.2 / WP-04.1 / WP-04.2, fixtures residuais = 0, docs sincronizados, gates verdes, D02-A não iniciado sem gate humano.

## 13. Convenções Domain / Application / Repository

- **Domain:** tipos, guards, sanitizers, sinks.
- **Application:** bootstrap de repositório, orquestração auditada.
- **Repository:** persistência tipada `CollectiveResult` / adapters audit.

## 14. Observabilidade

CorrelationId em operações sensíveis. Motivos sanitizados (`code=…|src=…|corr=…`). Sem stack/SQL/tokens. Clinical repo tem canal de observabilidade separado (não PHI).

## 15. Preparação para Analytics e IA

D02-A / Analytics Engine / AI Gateway **bloqueados** até gate humano. Engineering Book não autoriza implementação. Pré-requisitos: E01 estável, limiar agregado, fail-closed, anti-diff.

## 16. Riscos e limites conhecidos

| Risco | Estado |
|---|---|
| Auth pré-login / falha sem `auth.uid` | residual E01 |
| LGPD export/correção demo | sem audit persistente |
| Care-plan update fino / ações | cobertura parcial |
| Negação RLS atômica na mesma txn | residual (não improvisar) |
| Gap clínico `unit_id` | documentado; fora deste WP |
| Issue #25 | isolada |
| D02-A | bloqueado |

## 17. Índice

| Documento | Uso |
|---|---|
| `docs/ARCHITECTURE_BASELINE_v1.md` | Baseline arquitetural |
| `docs/adr/*` | Decisões |
| `PROJECT_MASTER_HANDOFF.md` | Continuidade operacional |
| `SUPABASE_IMPLEMENTATION_BACKLOG.md` | Backlog técnico |
| `docs/ROADMAP.md` / `WP_STATUS.md` / `PLATFORM_METRICS.md` | Planejamento e maturidade |
| `docs/WP-04-2_E01_EVENT_INVENTORY.md` | Inventário E01 |
| `docs/WP-04-2_HML_REMOTE_INVENTORY.md` | Inventário remoto HML |
| `docs/WP-04-1_HML_0021_EVIDENCE.md` | Evidência HML 0021 |
