# ARCH-01 — Technical Architecture Review

**Status:** baseline v0.1  
**Repository:** `EdeMachado/BIOMEDHEALTH`  
**Audited baseline:** `main` @ `820d080d2f28c1a615b089c29afb4e139c12d925`  
**Nature:** architecture and governance review; no functional authorization

## 1. Objective

Establish a reproducible technical baseline for the BioMed Health platform, identify structural strengths and risks, and organize the next architectural work without authorizing SUP-D02-A or introducing migrations, production data, AI execution, or remote Supabase changes.

## 2. Current platform map

The repository is a TypeScript monorepo with one web workspace:

- React 19 + Vite + React Router;
- Supabase as persistence/authentication platform;
- mock and Supabase repositories selected by explicit factories;
- domain services for assessment, consent, journey, risk, clinical portfolio, agenda, clinical record and care plan;
- collective management repositories for campaigns and action plans;
- Vitest unit/integration suites and Playwright E2E coverage;
- Capacitor configuration for mobile packaging;
- SQL migrations `0001` through `0018`, corresponding rollback scripts and dedicated RLS validation harnesses.

## 3. Architectural strengths confirmed

### 3.1 Repository boundary

Persistence is generally isolated behind contracts, factories and mock/Supabase implementations. This reduces direct coupling between UI and Supabase and provides a viable seam for testing, future APIs and controlled AI tools.

### 3.2 Multi-tenant security posture

The project treats organization and unit scope as first-class concerns. RLS validations, linked clinical access, explicit collective scopes and deny-by-default behavior are materially stronger than a typical MVP baseline.

### 3.3 Clinical fail-closed behavior

Clinical repository mode, observability, fallback policy and PostgreSQL authorization normalization are separated into dedicated components. Silent fallback to fictitious clinical data is explicitly blocked.

### 3.4 Database change discipline

The repository contains:

- sequential migrations;
- rollback scripts for migrations `0003` through `0018`;
- SQL validation suites per major delivery;
- versioned technical specifications and gate evidence.

### 3.5 Test investment

The tree includes unit, integration and E2E coverage for authentication, tenant isolation, repositories, clinical flows, collective flows and visual acceptance.

## 4. Structural findings

### ARCH-01-F01 — oversized feature files

`ClinicalPages.tsx` is approximately 70 KB and `ManagementPages.tsx` approximately 47 KB. They combine page composition, repository bootstrap, state management, validation, mutations and presentation.

**Risk:** growing change surface, difficult review, increased regression probability and reduced reuse.

**Direction:** split by use case and page, introducing feature hooks/controllers while preserving repository contracts. This is refactoring only and must be performed incrementally with characterization tests.

### ARCH-01-F02 — no permanent CI workflow in `main`

The repository has executable tests and scripts but no permanent GitHub Actions workflow in the audited tree.

**Risk:** PRs may be merged without an automatic proof of typecheck, lint, unit tests, integration tests and build.

**Direction:** create a minimal, non-deployment CI workflow pinned to Node `22.22.0`, initially running `npm ci`, typecheck, lint, tests and build. E2E can remain a separate job due to runtime cost.

### ARCH-01-F03 — incomplete reproducible Supabase bootstrap

Migrations, rollbacks, policies and a demo seed exist, but the tree does not contain a complete versioned Supabase CLI bootstrap configuration and documented one-command local/HML procedure.

**Risk:** environment drift and dependence on undocumented operator knowledge.

**Direction:** inventory and version `supabase/config.toml`, CLI version/pinning, bootstrap commands, migration verification, seed policy and HML runbook. No remote execution is authorized by this finding.

### ARCH-01-F04 — branch governance mismatch

At the start of the audit, the GitHub default branch was still `feat/demo-visual-functional-refinement`, while project governance and current delivery use `main`.

**Risk:** incorrect default clones, contents reads, pull-request bases and workflow behavior.

**Direction:** set the repository default branch to `main` in GitHub settings and verify protection rules afterward.

### ARCH-01-F05 — database type generation is not yet authoritative

`apps/web/src/shared/types/database.ts` is small relative to the implemented Supabase schema and appears not to be a complete generated representation of migrations `0001`–`0018`.

**Risk:** database and TypeScript contracts can drift; repository casts may hide schema changes.

**Direction:** establish generated Supabase database types as a build artifact or versioned source, then progressively remove unsafe/manual structural casts.

### ARCH-01-F06 — duplicate dependency lockfiles

The tree contains both root `package-lock.json` and `apps/web/package-lock.json` while npm workspaces are configured at the root.

**Risk:** ambiguous installation source and divergent dependency resolution.

**Direction:** confirm the canonical workspace install strategy and retain only the lockfile required by that strategy in a dedicated housekeeping PR.

### ARCH-01-F07 — audit UI is still demonstrative

The management audit page reads an in-memory/demo audit trail. Clinical observability is also currently an application-level abstraction rather than a durable platform-wide audit pipeline.

**Risk:** security and clinical events may not have durable, queryable and retention-controlled evidence.

**Direction:** design the Fase E append-only audit subsystem before replacing the demo UI. Clinical content must not be placed in generic application logs.

### ARCH-01-F08 — no AI runtime boundary exists yet

The platform has domain and repository seams that are useful for AI integration, but there is currently no dedicated server-side AI gateway, prompt/version registry, tool policy, evaluation suite, model audit record, redaction layer, vector store or human-approval workflow.

**Risk:** adding LLM calls directly to React or repositories would expose credentials, weaken auditability and mix probabilistic outputs with clinical truth.

**Direction:** AI must be introduced as a separate, server-side, policy-controlled subsystem after data governance and use-case approval. No client-side provider key and no direct LLM access to unrestricted clinical tables.

## 5. AI readiness assessment

| Capability | Current state | Assessment |
|---|---|---|
| Domain boundaries | Present | Good foundation |
| Repository contracts | Present | Good foundation |
| Tenant/RLS controls | Present | Strong prerequisite |
| Durable audit | Partial/demo | Must mature first |
| Data provenance | Partial by module | Needs unified contract |
| AI gateway | Absent | Must be designed |
| Prompt/model versioning | Absent | Must be designed |
| Evaluation and safety tests | Absent | Must precede clinical use |
| Vector/RAG layer | Absent | Optional, use-case dependent |
| Human approval | Not generalized | Mandatory for clinical recommendations |

The correct sequence is not “add an AI SDK to the frontend”. It is:

1. define an approved use case and prohibited outputs;
2. define source data, provenance and minimum necessary access;
3. create server-side AI contracts and tool permissions;
4. add deterministic preprocessing and redaction;
5. add prompt/model versioning and evaluations;
6. require human review where output can affect health or employment decisions;
7. record input references, model/version, output, reviewer and final disposition.

## 6. Recommended work packages

### ARCH-01-A — repository and CI baseline

- set default branch to `main`;
- introduce permanent CI;
- resolve lockfile strategy;
- generate authoritative database types;
- document required checks and merge policy.

### ARCH-01-B — frontend modularity

- characterize `ClinicalPages.tsx` and `ManagementPages.tsx`;
- extract repository bootstrap from page files;
- extract one feature at a time into page + hook/controller + presentational components;
- preserve behavior and tests.

### ARCH-01-C — Supabase reproducibility

- version local bootstrap configuration;
- pin CLI/toolchain;
- document local and HML lifecycle;
- define seed classification and prohibit production-sensitive seed data;
- verify migrations, policies and rollbacks from a clean database.

### ARCH-01-D — durable audit and observability

- define event taxonomy;
- separate security, application and clinical audit classes;
- establish append-only persistence, retention and authorized readers;
- define correlation IDs and privacy-safe payloads;
- replace demonstration audit UI only after backend readiness.

### ARCH-01-E — AI architecture specification

- select initial low-risk use case;
- create AI gateway and provider abstraction;
- define prompt, model and policy versioning;
- define redaction, provenance and human review;
- create offline evaluation corpus and acceptance thresholds;
- prohibit autonomous diagnosis, causal occupational conclusions and unrestricted record access.

## 7. Priority order

1. GitHub governance and permanent CI;
2. reproducible Supabase bootstrap;
3. authoritative database typing;
4. durable audit architecture;
5. incremental frontend decomposition;
6. AI architecture and first low-risk assisted use case;
7. SUP-D02-A only after its independent authorization gate.

## 8. Explicit non-authorizations

This document does **not** authorize:

- SUP-D02-A implementation;
- migration `0019`;
- remote Supabase changes;
- production deployment;
- use of real clinical data in AI;
- vector database creation;
- provider credentials in the frontend;
- autonomous clinical, occupational or employment decisions.

## 9. Next audit outputs

The next ARCH-01 iterations should produce:

1. dependency and build/CI inventory;
2. frontend dependency map and decomposition candidates;
3. database/RLS architecture inventory;
4. Supabase bootstrap gap analysis;
5. durable audit threat model;
6. AI architecture RFC with one approved initial use case;
7. prioritized technical-debt register with effort, risk and acceptance criteria.
