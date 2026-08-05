# BioMed Health — Database Quality and Performance Review

## 1. Identificação

- Work Package: WP-02.4 — Qualidade e Performance do Banco
- Baseline: `main` após o merge do PR #40
- Escopo: análise estática do schema versionado nas migrations `0001` a `0018`, documentos arquiteturais e contratos já incorporados
- Natureza: documental e diagnóstica
- Fora de escopo: execução de `EXPLAIN`, coleta de métricas remotas, alteração de índices, aplicação de migration, mudança de RLS, grants, RPCs ou runtime

## 2. Limites de evidência

Este relatório comprova somente o que está versionado no repositório. Ele não declara como fato o estado atual do Supabase remoto quanto a:

- cardinalidade real das tabelas;
- tamanho físico de índices;
- índices não utilizados;
- bloat;
- autovacuum;
- latência p50/p95/p99;
- locks e deadlocks;
- cache hit ratio;
- slow queries;
- planos reais de execução;
- objetos criados manualmente fora das migrations.

Esses itens exigem inventário operacional posterior.

## 3. Veredito executivo

Classificação geral: **B — base estrutural consistente, com gaps P2 de observabilidade de performance e aderência de tipos**.

O schema apresenta boa maturidade em:

- chaves primárias UUID;
- integridade referencial crescente;
- índices de escopo organizacional e clínico;
- índices parciais para regras de unicidade operacional;
- concorrência otimista por `version`;
- histórico append-only em eventos clínicos;
- RPCs atômicas para mutações compostas;
- constraints temporais e de lifecycle;
- prevenção de duplicidades em avaliações e planos abertos.

Não há evidência estática de um gargalo crítico já materializado. Entretanto, ainda não existe baseline remoto capaz de provar que os índices atuais acompanham os padrões reais de consulta e o crescimento esperado.

## 4. Inventário qualitativo dos índices

### 4.1 Fundação de acesso

As migrations acrescentam índices para:

- `user_roles.organization_id`;
- `user_roles.unit_id` quando não nulo;
- unicidade de papel por vínculo, papel e unidade;
- `user_profiles.organization_id`;
- `user_profiles.unit_id` quando não nulo;
- unicidade de perfil por vínculo, perfil e unidade;
- unicidade de `user_organizations (organization_id, user_id)`;
- unicidade de `role_permissions (role_id, permission_id)`.

Avaliação: os índices estão alinhados ao isolamento por tenant e à resolução de papéis. A efetividade real deve ser confirmada com consultas e cardinalidades remotas.

### 4.2 Consentimentos

Há índices para:

- documento por organização e vigência;
- documento por organização e código;
- aceite por organização, usuário e data;
- aceite por organização, documento e data;
- revogações por organização e data, com índice parcial.

Avaliação: boa cobertura para histórico, vigência e revogação. O índice parcial de revogados evita carregar linhas não revogadas.

### 4.3 Avaliações e risco

Há índices únicos para:

- uma resposta por `(assessment_id, assessment_question_id)`;
- um resultado por `assessment_id`;
- uma avaliação em andamento por `(organization_id, user_id, assessment_version_id)`.

Avaliação: excelente proteção contra duplicidade concorrente. Ainda deve ser medido o custo de consultas por usuário, período, domínio e status, especialmente para analytics futuros.

### 4.4 Jornadas

As migrations de integridade de jornada adicionam unicidades e índices voltados a:

- criação/retomada da jornada ativa;
- progresso por atividade;
- conclusão e imutabilidade.

Avaliação: o modelo favorece consistência operacional. O crescimento de `user_activity_progress` pode ser elevado e exige futura análise por organização, usuário, jornada e atividade.

### 4.5 Clínica

Há índices explícitos para:

- ficha clínica por contexto;
- plano de cuidado por organização;
- plano por profissional;
- plano por usuário;
- uma única ficha ou plano aberto conforme os predicados definidos;
- ações por `care_plan_id`;
- ações por organização, profissional e usuário;
- eventos por plano e data decrescente;
- eventos por organização, profissional e usuário;
- FK composta entre plano e ficha clínica.

Avaliação: a cobertura é adequada para carteira, prontuário, plano e timeline. `care_plan_events` tende a ser uma tabela de alto crescimento e deve receber política explícita de retenção, particionamento ou arquivamento apenas quando os volumes reais justificarem.

### 4.6 Gestão coletiva

As migrations `0017` e `0018` introduzem índices, constraints e RPCs para campanhas, escopos, unidades selecionadas e planos de ação.

Avaliação: a modelagem prioriza atomicidade e consistência. O futuro D02 aumentará a pressão por filtros combinados de organização, unidade, período, estado e audiência; nenhum índice adicional deve ser criado antes de os contratos finais de consulta e planos de execução serem conhecidos.

## 5. Foreign keys e indexação

PostgreSQL não cria automaticamente índice na coluna filha de uma FK. O schema atual adiciona vários índices de apoio, mas ainda não há uma matriz automatizada que prove que toda FK relevante possui índice compatível.

### Achado P2 — ausência de verificação automatizada de FKs sem índice

Risco:

- deletes ou updates na tabela pai podem degradar;
- joins recorrentes podem fazer sequential scan;
- o problema pode surgir apenas com crescimento de volume.

Ação recomendada:

1. criar consulta de inventário remoto de FKs e índices;
2. classificar por cardinalidade e frequência de uso;
3. não criar índice mecanicamente para toda FK;
4. abrir PRs isolados somente para índices comprovadamente necessários.

## 6. Constraints e qualidade de dados

### Controles positivos

O schema contém exemplos fortes de qualidade estrutural:

- janelas de vigência válidas;
- campos jurídicos não vazios;
- hash de consentimento com formato validado;
- revogação posterior ao aceite;
- FKs compostas por organização;
- unicidade de avaliação ativa;
- uma resposta por pergunta;
- um resultado por avaliação;
- um plano clínico aberto por contexto;
- consistência entre status e datas de encerramento;
- imutabilidade após conclusão, suspensão ou revogação;
- incremento obrigatório de versão;
- escopo herdado do registro pai;
- mutações atômicas para operações compostas.

### Gap P2 — vocabulários ainda representados como `text`

Diversos estados e categorias são `text` protegidos por `CHECK`. Esse padrão é aceitável e flexível, mas exige disciplina para não haver divergência entre:

- SQL;
- tipos TypeScript;
- validações de formulário;
- mocks;
- documentação.

Não se recomenda migrar automaticamente para enums PostgreSQL. A decisão deve considerar custo de evolução, compatibilidade e geração de tipos.

### Gap P2 — `status` genérico e status de domínio coexistentes

Exemplos:

- `status` de lifecycle;
- `plan_status`;
- `action_status`;
- `campaign_status`;
- `appointment_status`.

A coexistência é válida, mas precisa ser preservada no modelo canônico e nos DTOs para evitar que uma camada trate `status` genérico como o estado funcional da entidade.

## 7. JSONB

O uso de JSONB identificado é restrito e tecnicamente justificável em:

- `organizations.metadata`;
- payloads de eventos clínicos;
- respostas estruturadas de RPCs.

### Regras obrigatórias

- JSONB não deve substituir entidade relacional estável;
- campos consultados e filtrados com frequência devem ser colunas tipadas;
- payload de auditoria deve possuir versão de schema quando necessário;
- índices GIN só devem ser criados após evidência de consulta real;
- dados clínicos essenciais não podem existir apenas em payload opaco.

Avaliação: não há evidência atual de abuso generalizado de JSONB.

## 8. Tabelas de crescimento elevado

Prioridade provável de crescimento:

1. `audit_events`;
2. `care_plan_events`;
3. `assessment_responses`;
4. `user_activity_progress`;
5. `notifications`;
6. `documents` como metadados;
7. futuras tabelas analíticas e agregadas.

Para essas tabelas, o plano de capacidade deverá considerar:

- volume mensal;
- retenção legal e funcional;
- padrão de leitura recente versus histórico;
- índices por período;
- arquivamento;
- particionamento somente com evidência de necessidade;
- impacto em backup e recuperação.

Particionamento prematuro não é recomendado.

## 9. Consultas críticas previstas

### Pessoal e avaliação

- avaliação ativa por usuário e versão;
- respostas por avaliação;
- resultado por avaliação;
- histórico por usuário e período.

### Jornada

- jornada ativa do usuário;
- atividades e progresso;
- conclusão e retomada.

### Clínica

- carteira por profissional;
- agenda por profissional e período;
- ficha vigente e versões anteriores;
- plano aberto por paciente e profissional;
- ações do plano;
- timeline por plano em ordem decrescente.

### Gestão coletiva

- campanhas aplicáveis por organização/unidade;
- planos de ação por estado, prioridade e prazo;
- futuras consultas agregadas com limiar e anti-differential.

Cada consulta crítica deve futuramente possuir:

- contrato;
- índice justificável;
- limite e paginação;
- `EXPLAIN (ANALYZE, BUFFERS)` em ambiente seguro;
- orçamento de latência.

## 10. Paginação e limites

### Achado P2 — ausência de política canônica de paginação do banco

O repositório possui fluxos pequenos e demonstrativos, mas ainda não existe uma regra global para:

- limite máximo de linhas;
- cursor versus offset;
- ordenação estável;
- exportações;
- timelines longas;
- consultas administrativas.

Recomendação:

- preferir paginação por cursor em timelines e históricos crescentes;
- sempre definir ordenação determinística com desempate por `id`;
- impedir consultas sem limite em superfícies de UI;
- tratar exportação como operação separada e auditada.

## 11. N+1 e composição de consultas

A camada de repositories reduz o acoplamento direto com Supabase, mas não elimina risco de N+1.

Pontos a observar:

- carteira de pacientes seguida de consulta individual de cada detalhe;
- plano seguido de ações e eventos em chamadas separadas por item;
- campanhas seguidas de unidades selecionadas;
- resolução repetida de papéis e perfis.

Nenhum N+1 crítico foi comprovado apenas pelas migrations. A verificação deverá ocorrer no WP-03, com inventário dos repositories e telemetria de chamadas.

## 12. Tipos TypeScript

### Achado P2 — tipos não comprovadamente sincronizados com o schema final

O projeto possui tipos dedicados, porém o inventário arquitetural já identificou que eles não representam integralmente o schema atual.

Riscos:

- colunas ausentes nos DTOs;
- estados como `string` genérica;
- RPCs sem assinatura canônica;
- diferenças entre nullability do banco e frontend;
- mocks divergentes do Supabase;
- erros descobertos apenas em runtime.

Ação recomendada:

1. fixar uma versão da Supabase CLI;
2. reproduzir o banco localmente;
3. gerar os tipos do schema migrado;
4. versionar o artefato gerado;
5. criar verificação de drift na CI;
6. manter DTOs de domínio separados dos tipos brutos do banco.

## 13. Métricas remotas obrigatórias

Antes de qualquer otimização de produção, coletar:

- tamanho de tabelas e índices;
- estimativa e contagem de linhas;
- índices não utilizados;
- índices duplicados ou sobrepostos;
- FKs sem índice de apoio;
- queries mais lentas;
- queries mais frequentes;
- cache hit ratio;
- dead tuples e autovacuum;
- locks prolongados;
- taxa de crescimento mensal;
- latência de RPCs;
- taxa de conflito de versão.

As métricas devem ser coletadas sem expor dados pessoais ou clínicos.

## 14. Priorização dos achados

| ID | Severidade | Achado | Tratamento |
|---|---|---|---|
| QP-01 | P2 | ausência de inventário remoto de FKs sem índice | consulta remota e matriz de decisão |
| QP-02 | P2 | tipos TypeScript sem sincronização comprovada | geração oficial e drift check |
| QP-03 | P2 | ausência de política canônica de paginação | RFC e contratos por repository |
| QP-04 | P2 | ausência de baseline remoto de performance | métricas e `EXPLAIN` controlado |
| QP-05 | P3 | tabelas append-only sem política formal de capacidade | capacity plan antes de grande volume |
| QP-06 | P3 | vocabulários distribuídos entre SQL, TS e mocks | catálogo canônico de estados |

Não foram identificados P0 ou P1 nesta revisão estática.

## 15. Ordem segura de evolução

1. bootstrap reproduzível do Supabase;
2. inventário remoto de objetos, volumes e privilégios;
3. hardening de segurança identificado no WP-02.3;
4. geração canônica dos tipos TypeScript;
5. consulta automatizada de FKs sem índice;
6. contratos de paginação e limites;
7. análise dos repositories no WP-03;
8. criação de índices somente mediante evidência;
9. baseline de capacidade das tabelas append-only;
10. revisão antes de liberar D02-A.

## 16. Critérios para novos índices

Um novo índice somente deve ser criado quando houver:

- consulta real ou contrato aprovado;
- seletividade conhecida ou razoavelmente estimada;
- benefício comprovado por plano de execução;
- análise do custo de escrita e armazenamento;
- ausência de índice equivalente;
- rollback definido;
- teste de segurança preservando isolamento por tenant.

## 17. Conclusão

A BioMed Health possui uma fundação de integridade e indexação superior ao esperado para um MVP. O principal risco atual não é a ausência evidente de índices, mas otimizar sem dados operacionais e permitir drift entre schema, tipos e repositories.

O próximo ganho de engenharia deve vir da reprodutibilidade do Supabase, geração oficial de tipos e inventário remoto. Nenhuma otimização prematura deve ser aplicada apenas por suposição.