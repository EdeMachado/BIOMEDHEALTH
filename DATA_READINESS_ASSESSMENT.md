# BioMed Health — WP-02.5 Data Readiness Assessment

## 1. Objetivo

Este documento avalia a preparação atual dos dados da BioMed Health para sustentar, com segurança e rastreabilidade:

- operação clínica e preventiva;
- gestão coletiva e ocupacional;
- indicadores agregados;
- analytics;
- automações;
- futura arquitetura de inteligência artificial.

A avaliação consolida evidências versionadas no repositório. Não representa auditoria do estado remoto do Supabase, nem comprova volume, latência, completude ou qualidade dos dados efetivamente armazenados em produção/HML.

## 2. Escopo e fontes de evidência

Baseline documental e técnico considerado:

- migrations `0001` a `0018`;
- `DATABASE_INVENTORY.md`;
- `CANONICAL_DATA_MODEL.md`;
- `DATABASE_SECURITY_REVIEW.md`;
- `DATABASE_QUALITY_AND_PERFORMANCE_REVIEW.md`;
- `DATA_MODEL.md`;
- documentação SUP-B, SUP-C e SUP-D;
- contratos de repositories e testes versionados.

Fora do escopo desta etapa:

- profiling do banco remoto;
- medição de completude por coluna;
- análise estatística de valores reais;
- inventário de buckets e objetos manuais;
- avaliação clínica de modelos de IA;
- implementação de pipelines analíticos.

## 3. Escala de maturidade

| Nível | Definição |
|---|---|
| 0 — Ausente | Não há definição, controle ou evidência. |
| 1 — Inicial | Há práticas pontuais, sem padronização suficiente. |
| 2 — Definido | Regras e estruturas existem, mas a execução ainda é parcial ou não mensurada. |
| 3 — Controlado | Regras são verificáveis, monitoradas e aplicadas de forma consistente. |
| 4 — Otimizado | Há métricas contínuas, automação, prevenção de drift e melhoria sistemática. |

## 4. Resultado executivo

**Maturidade geral atual: 2,4 / 4 — Definido, ainda não plenamente controlado.**

A BioMed possui uma base estrutural superior à de um MVP comum: schema versionado, isolamento multiempresa, integridade referencial, concorrência, históricos append-only, modelo canônico e governança de mudanças. Contudo, ainda não pode ser classificada como plenamente pronta para analytics avançado ou IA clínica porque faltam medição objetiva, linhagem executável, contratos de qualidade, tipos sincronizados, observabilidade remota e hardenings P2 já identificados.

### 4.1 Scorecard

| Dimensão | Nota | Estado |
|---|---:|---|
| Governança e definição semântica | 3,0 | Forte |
| Qualidade estrutural | 2,8 | Forte, não mensurada em runtime |
| Proveniência e linhagem | 2,2 | Parcial |
| Disponibilidade e confiabilidade operacional | 1,8 | Parcial |
| Interoperabilidade | 2,3 | Definida, ainda não padronizada externamente |
| Segurança e privacidade | 2,7 | Forte, com P2 pendentes |
| Observabilidade e mensuração | 1,7 | Insuficiente para IA/analytics avançado |
| Preparação analítica | 2,0 | Inicial controlada |
| Preparação para IA | 1,8 | Fundação boa, camada própria ausente |

## 5. Governança e definição semântica

### Evidências positivas

- O modelo canônico diferencia conta autenticada, pessoa/titular, vínculo institucional, paciente, colaborador e profissional.
- `care_plans` e `action_plans` possuem significados distintos.
- Resultado de risco não é tratado como diagnóstico.
- Organização patrocinadora não é considerada titular do prontuário.
- `organization_id` e `unit_id` possuem semântica formal.
- Mudanças de banco são versionadas por migrations e acompanhadas de rollback quando aplicável.

### Gaps

- Ainda não existe glossário de negócio completo com owner por termo.
- Não há processo formal de aprovação semântica para novos campos e indicadores.
- Entidades futuras de pessoa/titular e profissional canônico permanecem em aberto.

### Avaliação

**Nível 3,0 — Controlado conceitualmente, ainda sem stewardship formal.**

## 6. Qualidade estrutural dos dados

### Controles comprovados

- PKs UUID e FKs versionadas.
- Unicidades para respostas, resultados, vínculos e contextos relevantes.
- Índices parciais para instâncias em andamento.
- Constraints de status, datas e lifecycle.
- Triggers de validação de contexto organizacional/unidade.
- Concorrência otimista por `version`.
- RPCs atômicas para mutações compostas.
- Históricos append-only em áreas clínicas críticas.
- Precondições de migrations evitam deduplicação silenciosa.

### Gaps

- Não há catálogo executável de regras de qualidade por tabela/coluna.
- Não há métricas de completude, validade, unicidade, consistência ou atualidade.
- FKs sem índice ainda dependem de inventário remoto.
- Tipos TypeScript não estão comprovadamente sincronizados com o schema final.
- Não há detecção automática de schema drift na CI.

### Avaliação

**Nível 2,8 — Estrutura forte, qualidade operacional ainda não medida.**

## 7. Proveniência e linhagem

### Evidências positivas

- Migrations identificam evolução estrutural.
- Campos `created_at`, `updated_at`, `created_by`, `updated_by` e `version` são usados em várias entidades.
- Consentimentos mantêm documento, versão, aceite e revogação.
- Avaliações vinculam versão, perguntas, respostas e resultados.
- Jornadas vinculam versão, passos, atividades e progresso.
- Plano de cuidado possui eventos e snapshots de evolução/reavaliação.
- Observabilidade clínica utiliza correlation ID e eventos de repository.

### Gaps

- Não existe catálogo de lineage máquina-a-máquina.
- `audit_events` ainda não está comprovado como trilha universal e persistente.
- Dashboards e indicadores futuros ainda não possuem fonte, transformação e versão formalizadas.
- Exportações e dados derivados não possuem manifesto padronizado de origem.
- Não existe identificação canônica de dataset, transformação ou execução analítica.

### Requisito futuro

Todo indicador ou saída de IA deverá registrar ao menos:

- dataset e versão;
- janela temporal;
- filtros aplicados;
- origem das entidades;
- transformação/RPC utilizada;
- política de supressão;
- versão do algoritmo, prompt ou modelo;
- timestamp e ator responsável.

### Avaliação

**Nível 2,2 — Proveniência presente em domínios específicos, linhagem global ausente.**

## 8. Disponibilidade e confiabilidade operacional

### Evidências positivas

- CI permanente executa instalação, typecheck, lint, testes e build.
- Repositories segregam mock e Supabase.
- Dados clínicos usam fail-closed e bloqueiam fallback inseguro.
- RPCs tratam concorrência e idempotência em operações relevantes.

### Gaps

- Bootstrap local/HML do Supabase ainda não é plenamente reproduzível.
- Não há SLO/SLA de banco, RPCs ou módulos.
- Não há baseline remoto de disponibilidade, latência, locks, autovacuum ou crescimento.
- Backup, restore e disaster recovery ainda não foram validados neste WP.
- Seed sanitizado e procedimento de reset não estão consolidados.
- Não há monitoramento contínuo de falhas de qualidade de dados.

### Avaliação

**Nível 1,8 — Aplicação possui controles, mas confiabilidade dos dados não é mensurada ponta a ponta.**

## 9. Interoperabilidade

### Evidências positivas

- Contratos de domínio e repositories reduzem acoplamento direto ao Supabase.
- UUID, timestamptz e JSONB são usados de forma previsível.
- Modelo canônico fornece vocabulário interno.
- Separação modular favorece futuras APIs.

### Gaps

- Não há API pública versionada nem catálogo de eventos.
- Não há mapeamento para padrões clínicos interoperáveis.
- Não há política de códigos externos, terminologias ou identificadores mestres.
- Tipos gerados do banco ainda não são fonte oficial única.
- Importações/exportações ainda não possuem contrato canônico de validação e erro.

### Avaliação

**Nível 2,3 — Boa interoperabilidade interna, interoperabilidade externa ainda não definida.**

## 10. Segurança, privacidade e uso responsável

### Controles positivos

- RLS e vínculo persistido por organização/unidade.
- Assignments clínicos delimitam acesso profissional.
- Grants restritos e RPCs protegidas em migrations mais recentes.
- Consentimento versionado e revogável.
- Prontuário segregado da gestão coletiva.
- Limite mínimo de grupo previsto para indicadores agregados.
- Dados clínicos não podem usar fallback fictício silencioso.

### Blockers P2 já registrados

1. Helpers fundacionais `SECURITY DEFINER` da migration `0004` precisam de hardening de `search_path`, qualificação de objetos e revogação explícita de `PUBLIC/anon`.
2. A policy legada de `risk_results` precisa impedir leitura institucional individualizada e ser reconciliada com o acesso exclusivamente agregado.
3. O estado remoto de owners, grants, roles e `BYPASSRLS` precisa ser inventariado.

### Requisitos para IA

- Nenhuma chamada direta do React a modelos.
- Gateway de IA server-side.
- Minimização e redação de dados.
- Autorização equivalente ou mais restritiva que a fonte.
- Registro de modelo, prompt, fontes, parâmetros e resultado.
- Supervisão humana em contexto clínico.
- Proibição de diagnóstico autônomo.
- Testes de viés, segurança, factualidade e regressão.

### Avaliação

**Nível 2,7 — Segurança forte, mas os P2 bloqueiam expansão sensível.**

## 11. Preparação para analytics

### Estado atual

A plataforma está preparada para iniciar analytics descritivo controlado, desde que os resultados sejam agregados, suprimidos e produzidos por contratos protegidos. Ainda não está pronta para exploração livre, drilldown arbitrário ou exportação analítica ampla.

### Requisitos mínimos antes do D02-A

- hardenings P2 concluídos;
- inventário remoto de segurança;
- contrato de indicadores e dimensões aprovadas;
- limiar mínimo e anti-differential implementados;
- fingerprint e auditoria de consulta;
- testes cross-tenant e cross-unit;
- política de retenção/cache;
- ausência de contagens exatas em grupos suprimidos;
- métricas de desempenho das RPCs.

### Avaliação

**Nível 2,0 — Fundação definida; execução analítica ainda bloqueada por gates.**

## 12. Preparação para inteligência artificial

### Capacidades já favoráveis

- contratos de domínio;
- repositories;
- schema versionado;
- histórico clínico estruturado;
- modelo canônico;
- RLS e multiempresa;
- observabilidade clínica inicial;
- governança de PRs e CI.

### Ausências críticas

- AI Gateway;
- Prompt Registry;
- Model Registry;
- política de dados permitidos por caso de uso;
- camada de anonimização/redação;
- retrieval autorizado e rastreável;
- avaliação offline e online;
- trilha de auditoria de inferência;
- human-in-the-loop;
- rollback de prompts/modelos;
- monitoramento de custo, latência, qualidade e drift.

### Decisão

A BioMed está **AI-foundation-ready**, mas não **AI-production-ready**.

Nenhum recurso de IA clínica ou ocupacional deverá ser implantado antes da conclusão dos blockers deste documento e da aprovação do ARCH-02.

### Avaliação

**Nível 1,8 — Base arquitetural favorável, plataforma de IA ainda ausente.**

## 13. Blockers formais para ARCH-02

### P1 — obrigatório antes de IA clínica em produção

- definir supervisão humana e responsabilidade clínica;
- criar AI Gateway server-side;
- implementar auditoria integral de inferência;
- estabelecer política de dados permitidos/proibidos;
- validar isolamento tenant e RLS em retrieval;
- definir processo de avaliação e rollback.

### P2 — obrigatório antes de piloto controlado com dados sensíveis

- concluir hardening dos helpers da `0004`;
- corrigir acesso individual de `risk_results`;
- inventariar segurança remota;
- sincronizar tipos TypeScript;
- tornar Supabase local/HML reproduzível;
- definir catálogo de qualidade e lineage;
- estabelecer baseline de observabilidade.

### P3 — evolução necessária para escala

- glossário com data owners;
- contratos de importação/exportação;
- catálogo de datasets;
- SLOs de qualidade;
- capacity planning;
- política de retenção e arquivamento.

## 14. Plano de evolução recomendado

### Fase 1 — Fechamento do WP-02

1. versionar bootstrap Supabase local/HML;
2. executar inventário remoto controlado;
3. criar migration de hardening dos achados P2;
4. gerar tipos TypeScript oficiais;
5. criar catálogo inicial de regras de qualidade.

### Fase 2 — WP-03 / Backend

1. mapear repositories e serviços;
2. separar regras de domínio de acesso a dados;
3. padronizar paginação, erros e idempotência;
4. consolidar contratos de leitura e escrita.

### Fase 3 — ARCH-02

1. threat model de IA;
2. AI Gateway;
3. registries de prompt/modelo;
4. retrieval autorizado;
5. avaliação e supervisão humana;
6. observabilidade e auditoria de inferência.

## 15. Critérios para declarar Data Ready

A BioMed só deverá ser classificada como **Data Ready — nível controlado** quando houver evidência de que:

- schema local e remoto são reconciliados;
- tipos oficiais não apresentam drift;
- regras críticas de qualidade são executadas automaticamente;
- lineage de indicadores é rastreável;
- segurança remota foi inventariada;
- P2 de RLS/`SECURITY DEFINER` foram resolvidos;
- disponibilidade e performance possuem baseline;
- dados agregados respeitam supressão e anti-reidentificação;
- datasets usados por IA possuem finalidade, base legal, owner e versão;
- toda inferência é auditável e reversível.

## 16. Conclusão

A BioMed Health possui uma fundação de dados madura para sua fase atual e está em posição favorável para evoluir sem reescrever o núcleo. O maior risco não está na modelagem básica, mas em avançar para analytics ou IA antes de transformar controles definidos em controles mensurados e continuamente verificados.

**Veredito do WP-02.5:**

> A plataforma está pronta para continuar a engenharia de dados e iniciar preparação arquitetural de analytics/IA, mas ainda não está autorizada para IA clínica em produção nem para exposição gerencial de dados individuais. O próximo ganho de maturidade depende de bootstrap reproduzível, inventário remoto, hardening P2, tipos sincronizados, catálogo de qualidade e lineage executável.
