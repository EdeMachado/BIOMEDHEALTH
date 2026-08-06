# BIOMED HEALTH — Architecture Baseline v1.0

| Campo | Valor |
|---|---|
| Versão | **1.0** |
| Status | **Oficial** — encerra FASE I (Foundation) |
| Data | 2026-08-06 |
| Baseline `main` | `cc560ac94b0a0fe946d3ef61f3cc5384bb09f118` (merge PR #48) |
| PR consolidado | [#48](https://github.com/EdeMachado/BIOMEDHEALTH/pull/48) |
| HML | `biomedhealth-hml` (`nwsqhbdusdxcwquayase`) — migrations **0001–0020** |
| Próxima fase | Platform Intelligence (prep) — **D02-A não autorizado** |

Este documento é a **fonte canônica da arquitetura vigente** após a consolidação WP-04.0. Não inicia motores de IA, analytics reais nem D02-A.

---

## 1. Visão geral

BIOMED HEALTH é um ecossistema modular de saúde digital (MVP demo + integração Supabase). A plataforma separa experiência individual, cuidado clínico e gestão coletiva, com autorização por vínculos e **RLS First** no Postgres.

Stack vigente:

- **UI:** React + TypeScript + Vite (`apps/web`)
- **Application:** bootstraps fail-closed por domínio
- **Domain:** políticas, guards e tipos de negócio
- **Repository:** dual-mode `mock` | `supabase` (mock só em modo mock)
- **Backend:** Supabase (Auth, Postgres, RLS, RPCs)

Módulos de produto: Minha BioMed · BioMed Clínica · BioMed Gestão · (evolução) Ocupacional · Intelligence.

---

## 2. Camadas

| Camada | Responsabilidade | Local canônico |
|---|---|---|
| **UI** | Apresentação, formulários, estados de indisponibilidade explícitos | `apps/web/src/features/**`, layouts |
| **Application** | Resolução de modo, bootstrap de adapters, DI de repositórios | `apps/web/src/application/**` |
| **Domain** | Regras de negócio, guards, políticas, tipos | `apps/web/src/domains/**` |
| **Repository** | Persistência / contratos; mock ou Supabase | `apps/web/src/services/repositories/**` |
| **Supabase** | Schema, RLS, helpers `app_auth`, RPCs, grants | `supabase/migrations/**`, policies |

---

## 3. Fluxo oficial

```text
UI
 ↓
Application
 ↓
Domain
 ↓
Repository
 ↓
Supabase
```

Regras do fluxo:

1. A UI **não** instancia clientes Supabase nem decide fallback para mock.
2. Application resolve modo (`mock` vs `supabase`) e retorna sucesso tipado ou falha explícita.
3. Domain valida escopo e política antes/depois das operações quando aplicável.
4. Repository é a única porta de I/O; em modo `supabase`, erros sobem de forma determinística.
5. Supabase aplica RLS + least privilege; o app assume fail-closed.

---

## 4. Motores planejados (Platform Intelligence)

Planejados; **não implementados** neste baseline:

| Motor | Intenção |
|---|---|
| Analytics Engine | Indicadores agregados seguros (pós Gate D02 / autorização) |
| Clinical Engine | Apoio assistencial determinístico (sem auto-diagnóstico) |
| Occupational Engine | Saúde ocupacional / SST |
| Document Engine | Documentos e evidências com titularidade |
| Notification Engine | Notificações por titular + org |
| Permission Engine | Resolução unificada de papéis/vínculos |
| Audit Engine | Trilha append-only (fundação parcial via WP-03.2) |
| AI Gateway | Gateway controlado — **fora** da Foundation |

---

## 5. Princípios

| Princípio | Significado operacional |
|---|---|
| **Fail Closed** | Indisponibilidade ou erro de config → UI de falha; nunca sucesso degradado silencioso |
| **No Silent Fallback** | Proibido trocar Supabase→mock, vazio como sucesso ou escrita fictícia em modo real |
| **Repository Pattern** | Contratos por domínio; factories por modo |
| **Dependency Injection** | Bootstraps/application injetam adapters na UI/domain |
| **RLS First** | Segurança primária no banco; app complementa, não substitui |
| **Least Privilege** | Grants mínimos; revoke de `anon`/`PUBLIC` onde aplicável |
| **Single Source of Truth** | Schema + ADRs + handoff; sem políticas paralelas não versionadas |
| **Mock Only In Mock Mode** | sessionStorage / fixtures apenas quando o modo resolvido é `mock` |
| **Deterministic Errors** | Códigos/kinds estáveis (ex.: `42501` → `CROSS_TENANT_DATA`) |

ADRs oficiais deste baseline: `docs/adr/ADR-001` … `ADR-008`. ADRs operacionais WP-03.2: `ADR-010` … `ADR-012`.

---

## 6. Governança

```text
Workflow
PR
 ↓
Quality Gate
 ↓
Database Gate
 ↓
Merge
 ↓
HML
 ↓
Produção
```

- PR obrigatório contra `main`.
- Quality Gate: typecheck, lint, testes, build.
- Database Gate: `db reset` / lint / validação SQL local.
- Após merge: aplicar migration no HML (backup → dry-run → push → list → validação).
- Produção: somente após HML verde e autorização explícita (ainda não liberada neste ciclo).

---

## 7. Estado Foundation (encerramento)

| Área | Estado |
|---|---|
| Auth / access / tenant (Fase A) | Entregue na prática |
| Preventivo (B) | Parcial (B04 aberto) |
| Clínico (C) | Parcial (C04.2b encerrada sem impl.; gap `unit_id`) |
| Coletivo D01 | Em `main` |
| D02 | SPEC + Gate documental; **impl. não autorizada** |
| Hardening 0019/0020 | Em `main` + **aplicado no HML** |
| Fail-closed bootstraps | assessment, consent, audit, collective |
| Audit adapter | Unificado; RPC `register_audit_event` |

**FASE I (Foundation) — ENCERRADA oficialmente por este baseline.**  
Próximo ciclo: **WP-04.1** (Platform Readiness / Intelligence prep), sem iniciar D02-A.
