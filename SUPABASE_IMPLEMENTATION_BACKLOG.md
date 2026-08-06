# BIOMED HEALTH - Supabase Implementation Backlog

## Objetivo deste documento

Backlog tecnico para implementacao futura da integracao com Supabase, com base em `SUPABASE_ARCHITECTURE_PLANNING.md`.

Este backlog **nao executa implementacao**.
Nenhum item abaixo implica conexao Supabase nesta etapa.

## Regras obrigatorias para todos os tickets

- RLS obrigatoria em recursos sensiveis, sem excecao.
- Testes de negacao e acesso cruzado entre organizacoes obrigatorios.
- Segregacao entre Minha BioMed, BioMed Clinica e BioMed Gestao obrigatoria.
- BioMed Gestao sem exposicao individual (apenas agregado).
- Consentimento versionado com possibilidade de revogacao.
- Auditoria append-only (sem update/delete por app user).
- Escrita de auditoria apenas via RPC controlada (sem escrita direta pelo cliente).
- Substituicao gradual dos mocks por repositorios reais, sem big-bang.
- Decisoes clinicas, juridicas e negociais com aprovacao humana formal.
- JWT minimo; autorizacao efetiva por vinculos persistidos + RLS.
- No **dominio institucional/coletivo**: `organization_id` obrigatorio; `unit_id` obrigatorio quando houver recorte por unidade; `unit_id = null` = escopo organizacional **explicito** (nao ausencia generica de contexto nem ampliação de acesso); unidade, quando presente, deve pertencer a organizacao.
- `organization_id` **nao** e obrigatorio universal do produto: dominios pessoais/assistenciais independentes e futuras operacoes B2C possuem regras proprias de titularidade (ver handoff §6.1).
- Indicadores gerenciais com grupo minimo de 10 individuos **no recorte efetivo** (apos todos os filtros), com supressao abaixo do limiar.
- Prevencao de reidentificacao por filtros combinados, cruzamentos, diferencas ou exportacoes em BioMed Gestao.
- Organizacao patrocinadora nao se torna proprietaria do prontuario pessoal.
- Usuario com atuacao restrita a uma unidade pode visualizar campanhas organizacionais aplicaveis a sua unidade (vinculo/papel validos; sem outras units; sem dados individuais indevidos; agregados com limiar).

---

## Fase A - Fundacao de acesso e tenant

### Definicao de pronto da Fase A

- Tenant por `organization_id` ativo em auth + schema + repositorios.
- Autenticacao real pronta para coexistir com mock via feature flag.
- RBAC basico funcional por perfil no contexto organizacional.
- Politicas RLS base aplicadas e validadas com testes de negacao.
- Nenhuma regressao nos guards e rotas aprovadas.

### SUP-A01

1. **Identificador**: `SUP-A01`
2. **Titulo**: Baseline de schema de tenant e identidade de acesso
3. **Finalidade**: preparar fundacao de dados para organizacao, unidade e pertencimento de usuarios.
4. **Escopo incluido**:
   - definicao final de colunas obrigatorias (`id`, `organization_id`, `status`, `created_at`, `updated_at`);
   - schema de `organizations`, `organization_units`, `user_organizations`, `roles`, `permissions`, `user_roles`;
   - constraints de unicidade e integridade referencial.
5. **Fora do escopo**:
   - migracao de dados mock para producao;
   - qualquer tela nova;
   - regras clinicas detalhadas.
6. **Dependencias**:
   - aprovacao dos codigos de perfil e nomenclatura de papeis;
   - validacao de estrategia multi-organizacao por negocio.
7. **Entidades/tabelas**: `organizations`, `organization_units`, `user_organizations`, `roles`, `permissions`, `user_roles`.
8. **Perfis/permissoes afetados**: todos os perfis (base de autorizacao).
9. **RLS necessaria**:
   - leitura/escrita com escopo por `organization_id`;
   - bloqueio de alteracao de papeis fora da organizacao corrente;
   - suporte a multiplos papeis por usuario em contexto organizacao/unidade via vinculos persistidos.
10. **Criterios de aceite**:
   - schema validado por migration dry-run;
   - constraints cobrindo duplicidade de associacoes usuario-organizacao;
   - documentacao de mapeamento de perfis finalizada.
11. **Testes obrigatorios**:
   - testes SQL de constraint;
   - testes de acesso cruzado entre organizacoes (negacao).
12. **Riscos de seguranca/LGPD**:
   - erro de modelagem pode permitir heranca indevida de papel;
   - dados de uma organizacao vazando para outra por chave mal definida.
13. **Estimativa**: media
14. **Ordem recomendada**: 1

### SUP-A02

1. **Identificador**: `SUP-A02`
2. **Titulo**: Integracao de autenticacao Supabase em modo hibrido
3. **Finalidade**: habilitar sessao real com fallback controlado para mock durante rollout.
4. **Escopo incluido**:
   - adaptacao do provider de auth para modo hibrido por feature flag;
   - mapeamento de sessao Supabase para `SessionUser`;
   - tratamento de expiracao/refresh de sessao.
5. **Fora do escopo**:
   - MFA;
   - onboarding completo de usuario final;
   - desativacao definitiva do modo mock.
6. **Dependencias**:
   - `SUP-A01`;
   - definicao de claims JWT minimas (decisao aprovada no documento de arquitetura).
7. **Entidades/tabelas**: `auth.users` (Supabase), `user_organizations`, `user_roles`.
8. **Perfis/permissoes afetados**: todos; impacto direto em login e resolucao de papel.
9. **RLS necessaria**:
   - claims JWT usadas apenas como contexto minimo de identidade/tenant;
   - autorizacao efetiva validada por `user_organizations`, `user_roles` e vinculos persistidos;
   - politicas com deny-by-default sem vinculo valido.
10. **Criterios de aceite**:
   - login real habilitavel por flag sem quebrar fluxo mock;
   - logout e renovacao de sessao funcionando;
   - guardas existentes preservadas;
   - evidencias de multiplos papeis por usuario no mesmo tenant/unidade sem escalonamento indevido.
11. **Testes obrigatorios**:
   - unitarios de mapeamento de sessao;
   - integracao login/logout;
   - E2E de rota protegida por perfil.
12. **Riscos de seguranca/LGPD**:
   - sessao sem claims corretas pode abrir acesso indevido;
   - risco de mixed-mode sem trilha de auditoria consistente.
13. **Estimativa**: grande
14. **Ordem recomendada**: 2

### SUP-A03

1. **Identificador**: `SUP-A03`
2. **Titulo**: RLS base para tenant, ownership e papeis de acesso
3. **Finalidade**: garantir protecao real no banco, independente do frontend.
4. **Escopo incluido**:
   - politicas RLS iniciais de tenant;
   - ownership de dados pessoais;
   - leitura/escrita por papel nas tabelas da fase A;
   - avaliacao de contexto de unidade nas entidades operacionais aplicaveis.
5. **Fora do escopo**:
   - RLS clinica detalhada;
   - agregacoes gerenciais avancadas.
6. **Dependencias**:
   - `SUP-A01`;
   - `SUP-A02` (claims definidas).
7. **Entidades/tabelas**: tabelas da fase A + tabelas de sessao/acesso relacionadas.
8. **Perfis/permissoes afetados**: todos.
9. **RLS necessaria**:
   - `USING` + `WITH CHECK` por `organization_id`;
   - negacao explicita para acessos sem escopo.
10. **Criterios de aceite**:
   - politicas aplicadas e auditadas;
   - consultas cross-tenant bloqueadas em testes;
   - escalonamento indevido entre papeis do mesmo usuario bloqueado por RLS.
11. **Testes obrigatorios**:
   - SQL tests permit/deny por perfil;
   - testes automatizados de acesso cruzado entre orgs.
12. **Riscos de seguranca/LGPD**:
   - policy permissiva em excesso;
   - lacunas de `WITH CHECK` permitindo escrita invalida.
13. **Estimativa**: grande
14. **Ordem recomendada**: 3

### SUP-A04

1. **Identificador**: `SUP-A04`
2. **Titulo**: Repositorio de organizacao/perfil e transicao mock->supabase
3. **Finalidade**: trocar gradualmente consultas de perfil/organizacao sem alterar UI.
4. **Escopo incluido**:
   - interfaces de repositorio para org, papel e pertencimento;
   - implementacao supabase paralela ao mock;
   - toggle por modulo.
5. **Fora do escopo**:
   - troca de todos os dominios de uma vez;
   - refactor visual de telas.
6. **Dependencias**: `SUP-A01`, `SUP-A02`, `SUP-A03`.
7. **Entidades/tabelas**: fase A + camada `services/repositories`.
8. **Perfis/permissoes afetados**: todos (resolucao de home e menu por papel).
9. **RLS necessaria**: reaproveita politicas de `SUP-A03`; validacao em repositorio.
10. **Criterios de aceite**:
   - contratos de repositorio preservados;
   - fallback mock funcional;
   - sem quebra de guardas.
11. **Testes obrigatorios**:
   - unitarios de adapter;
   - integracao de roteamento por papel;
   - regressao E2E de login e acesso.
12. **Riscos de seguranca/LGPD**:
   - divergencia entre resultado mock e real em papel/tenant;
   - inconsistencias de cache de sessao.
13. **Estimativa**: media
14. **Ordem recomendada**: 4

---

## Fase B - Dominio preventivo do usuario

### Definicao de pronto da Fase B

- Consentimento versionado com aceite/revogacao persistido.
- Avaliacao inicial e jornada com persistencia tenant-aware.
- BioMed usuario mantendo escopo estritamente proprio.
- RLS e testes de negacao aprovados para dominio preventivo.

### SUP-B01

1. **Identificador**: `SUP-B01`
2. **Titulo**: Schema de consentimento versionado e eventos LGPD
3. **Finalidade**: persistir base legal/finalidade e historico de aceite/revogacao.
4. **Escopo incluido**:
   - modelagem final de `consent_documents` e `user_consents`;
   - suporte a versao de documento e origem do aceite;
   - campos para revogacao.
5. **Fora do escopo**:
   - validacao juridica final de texto;
   - automacao de notificacoes externas.
6. **Dependencias**: `SUP-A01`, `SUP-A03`.
7. **Entidades/tabelas**: `consent_documents`, `user_consents`.
8. **Perfis/permissoes afetados**:
   - usuario (aceite/revogacao proprio);
   - perfis autorizados para consulta administrativa controlada.
9. **RLS necessaria**:
   - usuario le/grava somente seus consentimentos;
   - administracao sem acesso indevido a conteudo clinico.
10. **Criterios de aceite**:
   - revogacao registrada sem apagar historico;
   - versao de consentimento vinculada ao aceite.
11. **Testes obrigatorios**:
   - integracao aceite/revogacao;
   - negacao de leitura de consentimento de terceiro.
12. **Riscos de seguranca/LGPD**:
   - revogacao sobrescrever historico;
   - base legal incorreta sem aprovacao juridica.
13. **Estimativa**: media
14. **Ordem recomendada**: 5

#### SUP-B01.3 - Fluxos funcionais de consentimento LGPD em runtime (aplicacao)

1. **Identificador**: `SUP-B01.3`
2. **Finalidade**: operacionalizar no frontend os fluxos de consulta, aceite, revogacao e historico do titular usando schema/RLS ja existentes.
3. **Escopo incluido**:
   - contratos e repositorios (mock/supabase) para consentimentos;
   - consulta de documentos elegiveis;
   - consulta de historico do titular autenticado;
   - aceite vinculado a versao vigente do documento;
   - revogacao sem exclusao do historico;
   - integracao em `Minha BioMed > Perfil e privacidade`;
   - tratamento de loading, vazio, sucesso e erro.
4. **Fora do escopo**:
   - novas migrations/rollback;
   - alteracao de policies RLS;
   - texto juridico definitivo;
   - qualquer modulo clinico/gerencial.
5. **Dependencias**:
   - `SUP-B01.1` e `SUP-B01.2` concluidos;
   - `SUP-E01` para auditoria persistente append-only via RPC controlada.
6. **Auditoria**:
   - nesta etapa, apenas contrato desacoplado de auditoria para eventos `consent_accepted` e `consent_revoked`;
   - sem persistencia local/provisoria para substituir trilha append-only oficial.
7. **Criterios de aceite**:
   - titular autenticado consulta seus consentimentos e historico;
   - titular aceita documento elegivel sem informar `user_id` arbitrario;
   - titular revoga consentimento ativo com historico preservado;
   - bloqueios cross-user/cross-tenant e de documento inelegivel cobertos por testes;
   - sem uso de `service_role` no frontend.
8. **Testes obrigatorios**:
   - unitarios de elegibilidade, aceite versionado, revogacao, historico e erros;
   - integracao de fluxos do titular e cenarios de negacao (cross-user/cross-tenant/inelegivel);
   - regressao da suite existente da aplicacao;
   - reuso de `SUP_B01_2_RLS_TEST_CASES.sql` quando ambiente SQL local estiver disponivel.
9. **Necessidade de migration**: nao prevista; qualquer lacuna estrutural deve ser comprovada antes de propor nova migration.

### SUP-B02

1. **Identificador**: `SUP-B02`
2. **Titulo**: Persistencia de avaliacao inicial e respostas orientativas
3. **Finalidade**: substituir respostas mock por persistencia real controlada.
4. **Escopo incluido**:
   - persistencia em `assessments` e `assessment_responses`;
   - versionamento de formulario por `assessment_versions`;
   - resultado orientativo em `risk_results` sem diagnostico.
5. **Fora do escopo**:
   - mudanca no motor clinico;
   - recomendacao terapeutica automatizada.
6. **Dependencias**: `SUP-A03`, `SUP-B01`.
7. **Entidades/tabelas**:
   - `assessment_versions`, `assessment_questions`, `assessment_options`,
   - `assessments`, `assessment_responses`, `risk_results`, `risk_rules`.
8. **Perfis/permissoes afetados**:
   - usuario (proprio);
   - clinica (vinculados);
   - gestao apenas agregado derivado.
9. **RLS necessaria**:
   - ownership para usuario;
   - clinica so via vinculo;
   - bloqueio de leitura nominal por gestao.
10. **Criterios de aceite**:
   - formulario em etapas persiste e recupera estado;
   - resultado orientativo persistido com racional explicavel.
11. **Testes obrigatorios**:
   - unitario de mapeamento resposta->persistencia;
   - integracao de ownership;
   - negacao cross-tenant e cross-user.
12. **Riscos de seguranca/LGPD**:
   - captura excessiva de dado sensivel;
   - risco de interpretacao diagnostica indevida na camada de exibicao.
13. **Estimativa**: grande
14. **Ordem recomendada**: 6

#### SUP-B02.1 - Persistencia runtime da avaliacao inicial (aplicacao)

1. **Status**: implementado em `feat/sup-b02-assessment-runtime-persistence`.
2. **Arquitetura aplicada**:
   - repositorio `assessment` em modo mock/supabase com factory dual-mode;
   - service de dominio com resolucao de versao, mapeamento estavel de perguntas e regras de conclusao;
   - integracao progressiva em Minha BioMed sem criar camada paralela.
3. **Fluxos entregues**:
   - criacao/retomada de avaliacao por titular autenticado;
   - persistencia idempotente de respostas em `assessment_responses`;
   - persistencia de resultado orientativo em `risk_results` com racional serializado;
   - restauracao de estado incompleto e de avaliacao concluida.
4. **Seguranca/LGPD**:
   - identidade de `userId`/`organizationId` derivada exclusivamente da sessao autenticada;
   - sem `service_role` no frontend;
   - payload de respostas minimizado (`answer_value` + `answer_text` nulo);
   - linguagem de resultado mantida como orientativa e nao diagnostica.
5. **Testes adicionados**:
   - unitarios de service (`assessmentService`) cobrindo versao, persistencia, retomada, conclusao e historico;
   - integracao de repositorio Supabase com cliente simulado (`supabaseAssessmentRepository`).
6. **Limitacao documentada**:
   - os testes de repositorio Supabase utilizam fake client e nao constituem nova validacao runtime de RLS em PostgreSQL/Supabase real.
7. **Necessidade de migration/policy**:
   - migration incremental `0007_assessment_runtime_integrity.sql` e rollback `0007_assessment_runtime_integrity_rollback.sql` adicionados para garantir:
     - unicidade estrutural de `assessment_responses` por `(assessment_id, assessment_question_id)`;
     - unicidade estrutural de `risk_results` por `(assessment_id)`;
     - criacao/retomada concorrente segura de avaliacao em andamento por `(organization_id, user_id, assessment_version_id)` via `public.create_or_get_active_assessment`.
   - validacao SQL executada em PostgreSQL 16 descartavel com harness local de `auth.uid()`/claims; nao representa validacao de stack Supabase completo.

### SUP-B03

1. **Identificador**: `SUP-B03`
2. **Titulo**: Persistencia de jornada e atividades com progresso
3. **Finalidade**: migrar progresso mock da jornada para armazenamento real gradual.
4. **Escopo incluido**:
   - `user_journeys` e `user_activity_progress`;
   - sincronizacao de status e progresso por usuario;
   - continuidade de experiencia ao recarregar sessao real.
5. **Fora do escopo**:
   - nova logica de recomendacao de jornada;
   - mudancas visuais estruturais em telas.
6. **Dependencias**: `SUP-A04`, `SUP-B02`.
7. **Entidades/tabelas**:
   - `health_journeys`, `journey_versions`, `journey_steps`, `journey_activities`,
   - `user_journeys`, `user_activity_progress`.
8. **Perfis/permissoes afetados**:
   - usuario (proprio progresso);
   - clinica (acompanhamento vinculado);
   - gestao (apenas agregado).
9. **RLS necessaria**:
   - ownership para usuario;
   - leitura clinica vinculada;
   - sem exposicao nominal na gestao.
10. **Criterios de aceite**:
   - progresso persiste entre sessoes;
   - atividades concluidas/refeitas sem perda de historico.
11. **Testes obrigatorios**:
   - integracao de progresso por usuario;
   - negacao de leitura de progresso de terceiro;
   - E2E de atividade concluida.
12. **Riscos de seguranca/LGPD**:
   - mistura de dados de usuarios no cache;
   - exposicao indevida de historico de habitos.
13. **Estimativa**: media
14. **Ordem recomendada**: 7

#### SUP-B03.1 - Persistencia runtime da jornada e do progresso (aplicacao + banco)

1. **Status**: implementado em `feat/sup-b03-journey-runtime-persistence`.
2. **Arquitetura aplicada**:
   - repositorio `journey` em modo mock/supabase com factory dual-mode;
   - service de dominio para carregamento, retomada, persistencia de progresso e conclusao da jornada;
   - integracao das telas `UserJourneyPage` e `UserActivitiesPage` sem `sessionStorage` direto na UI.
3. **Fluxos entregues**:
   - criacao/retomada concorrente da jornada ativa via `public.create_or_get_active_user_journey`;
   - restauracao de jornada e progresso persistidos apos recarregamento/sessao;
   - persistencia idempotente por atividade em `user_activity_progress`;
   - bloqueio de atualizacao para jornada concluida.
4. **Seguranca/LGPD**:
   - identidade e tenant derivados da sessao autenticada (`AuthContext` + validacao no repository);
   - sem `service_role` no frontend;
   - payload minimizado de progresso (apenas ids estruturais + percentual/status);
   - erros de persistencia mapeados para mensagens publicas sem detalhes sensiveis do banco.
5. **Necessidade estrutural comprovada**:
   - migration incremental `0008_journey_runtime_integrity.sql` com rollback `0008_journey_runtime_integrity_rollback.sql`;
   - lacunas cobertas: unicidade de progresso por `(user_journey_id, journey_activity_id)`, unicidade de jornada ativa por `(organization_id, user_id)` via indice parcial, RLS/grants para catalogo e progresso do titular;
   - corretivo incremental `0009_journey_completion_immutability.sql` + rollback correspondente para impedir escrita/reabertura pos-conclusao via PostgREST autenticado (RLS USING/WITH CHECK; sem nova SECURITY DEFINER).
6. **Validacao de banco real executada**:
   - validacao em PostgreSQL 16 descartavel com harness local para `auth.uid()`/claims;
   - prechecks de duplicidade e de objeto preexistente exercitados com falhas esperadas;
   - validacao de grants, `search_path`, policies, concorrencia (duas conexoes), rollback e reaplicacao;
   - validacao adicional da 0009: escrita em jornada ativa, bloqueio pos-conclusao, anti-reabertura, cross-user/tenant, leitura historica, rollback simetrico e reaplicacao.
7. **Limitacao documentada**:
   - a validacao SQL foi feita em PostgreSQL 16 com harness local e nao representa validacao no stack Supabase completo gerenciado;
   - testes Vitest com fake Supabase client nao substituem a prova RLS no Postgres.

#### SUP-B03.2 - Leitura clinica vinculada de jornada e progresso

1. **Status**: CONCLUIDA e integrada em `main` via PR #6 (`d8399ca13537b66cf8ad2d927684a76b6dec8266`).
2. **Objetivo**: permitir que profissional clinico (`medico`, `profissional_saude`) com `professional_assignments` ativo na mesma organizacao consulte, em modo estritamente read-only, a jornada e o progresso persistidos do titular vinculado.
3. **Dependencias**: `SUP-B03.1` (persistencia titular + imutabilidade `0008`/`0009`).
4. **Escopo incluido**:
   - SELECT clinico vinculado em `user_journeys` e `user_activity_progress` via RLS;
   - helper `app_auth.has_active_clinical_assignment` (SECURITY DEFINER auditavel);
   - contratos/repository/service de leitura clinica distintos do fluxo do titular;
   - substituicao do trecho ficticio de jornada/progresso em `ClinicalPages` no modo Supabase;
   - mock equivalente com vinculo/negacoes;
   - ordenacao deterministica (ativa primeiro; concluidas por `completed_at` desc).
5. **Escopo excluido**:
   - escrita clinica de progresso/jornada;
   - acesso nominal a gestao administrativa (`gestor_institucional`, `admin_*`, etc.);
   - leitura coletiva/agregada;
   - consolidacao completa de vinculo/agenda (SUP-C01);
   - SUP-B04.
6. **Criterios de aceite**:
   - profissional vinculado da mesma org le jornada/progresso do paciente;
   - nao vinculado, vinculo inativo, cross-tenant e gestao nominal sao negados;
   - titular preserva leitura/escrita e imutabilidade pos-conclusao;
   - UI clinica nao usa `patient.jornadaAtiva` como fallback no modo Supabase;
   - sem botoes de escrita na visao clinica;
   - sem confirmacao falsa.
7. **Migration prevista**: incremental `0010_clinical_journey_linked_read.sql` + rollback correspondente (conferir numero na implementacao).
8. **Testes necessarios**: unitarios; fake client (nao-RLS); integracao app; PostgreSQL descartavel; E2E Playwright clinico.
9. **Divida tecnica registrada (nao corrigir automaticamente nesta entrega)**:
   - E2E fragil da secao “Concluidas” no fluxo do titular;
   - monotonicidade de `progress_percent`;
   - semantica generica de certos erros RLS;
   - CHECK de coerencia `status`/`completed_at`;
   - decisao de produto sobre multiplas jornadas ativas.
10. **Nota**: filha B03.2 concluida (PR #6). A parent SUP-B03 permanece com residual documentado (dividas tecnicas da filha e eventual fechamento formal do parent); nao bloquear C01+ por status obsoleto desta filha.

### SUP-B04

1. **Identificador**: `SUP-B04`
2. **Titulo**: Repositorios preventivos e rollout por feature flag
3. **Finalidade**: habilitar troca gradual dos mocks do dominio preventivo.
4. **Status**: ABERTO — alternativa posterior a consolidacao documental; **nao iniciar** antes de revisar qualquer linguagem ou mecanismo de fallback inseguro (proibicoes clinicas de C04.2b aplicam-se por analogia a dados sensiveis do titular).
5. **Escopo incluido**:
   - repositorios supabase para consentimento, avaliacao e jornada;
   - selecao explicita de modo por modulo (feature flag), sem troca dinamica silenciosa para fixture mock sob falha;
   - observabilidade de erros de integracao.
6. **Fora do escopo**:
   - remocao definitiva dos mocks;
   - ativacao global sem piloto;
   - retornar fixture mock / colecao vazia / null como “sucesso degradado” sob falha de backend.
7. **Dependencias**: `SUP-B01`, `SUP-B02`, `SUP-B03` (+ revisao de politica de fallback alinhada a C04.2a/C04.2b).
8. **Entidades/tabelas**: todas da fase B + camada de repositorios.
9. **Perfis/permissoes afetados**: usuario e equipe clinica (apenas leitura adequada).
10. **RLS necessaria**: validacao de consultas de cada repositorio com teste deny-by-default.
11. **Criterios de aceite**:
   - modulo preventivo opera em real/mock sem quebrar contrato;
   - erro de backend nao expoe detalhes sensiveis na UI;
   - ausencia de falsa percepcao de persistencia.
12. **Testes obrigatorios**:
   - suite de integracao dual-mode;
   - E2E principal de Minha BioMed.
13. **Riscos de seguranca/LGPD**:
   - fallback incorreto exibir dados de origem errada;
   - risco de logs com payload sensivel.
14. **Estimativa**: media
15. **Ordem recomendada**: 8 (apos D01 recomendado; ver `PROJECT_MASTER_HANDOFF.md`)

---

## Fase C - Dominio clinico com vinculo

### Definicao de pronto da Fase C

- Vinculo profissional-usuario persistido e aplicado em RLS.
- Agenda, ficha clinica, plano de cuidado e registros funcionando com escopo correto.
- Nenhum usuario nao vinculado aparece em carteira.
- Gestao institucional segue sem acesso clinico individual.

### SUP-C01

1. **Identificador**: `SUP-C01`
2. **Titulo**: Schema de vinculo assistencial e agenda clinica
3. **Finalidade**: estruturar base de atendimentos e vinculos reais.
4. **Status parent**: parcialmente atendida pelas filhas SUP-C01.1 (carteira) e SUP-C01.2 (agenda); unit_id operacional permanece gap residual documentado.
5. **Escopo incluido (parent)**:
   - consolidacao de `professional_assignments` e `appointments`;
   - indices por `organization_id`, `professional_id`, `user_id`, `starts_at`;
   - status padronizados de agenda.
6. **Fora do escopo**:
   - telemedicina real;
   - integracao com prontuario externo.
7. **Dependencias**: `SUP-A01`, `SUP-A03`, `SUP-B03.2`.
8. **Entidades/tabelas**: `professional_assignments`, `appointments`.

9. **Perfis/permissoes afetados**:
   - medico, profissional_saude;
   - gestores sem papel clinico sem carteira nominal.
10. **Nota**: parent permanece parcial enquanto `unit_id` operacional e consolidacao final de vinculo/agenda nao forem fechados; C02/C03 ja concluidas em `main` (PR #9/#10); gap `unit_id` segue como dependencia arquitetural residual.

#### SUP-C01.1 - Carteira clinica persistida por vinculo ativo

1. **Status**: implementada e mergeada em `main` (`00ccd8b`, PR #7).
2. **Objetivo**: como profissional clinico autenticado, visualizar a carteira de pacientes com vinculo clinico ativo na minha organizacao, para acessar a visao read-only da jornada de cada paciente autorizado, sem depender de dados demonstrativos no modo Supabase.
3. **Dependencias**: `SUP-B03.2` (leitura clinica de jornada), `app_auth.has_active_clinical_assignment`.
4. **Escopo incluido**:
   - RPC read-only `list_linked_clinical_patients` / `can_list_linked_clinical_portfolio`;
   - repository/service de carteira mock+supabase;
   - substituicao da lista demo em `ClinicalPortfolioPage` no modo Supabase;
   - integracao com painel de jornada da SUP-B03.2;
   - estados: loading, carregada, vazia autorizada, negada, erro.
5. **Escopo excluido**:
   - agenda (`appointments`);
   - escrita clinica;
   - gestao nominal;
   - ficha/plano/registros (SUP-C02+);
   - SUP-B04.
6. **Criterios de aceite**:
   - carteira Supabase exclusivamente persistida;
   - somente vinculos ativos do `auth.uid()`;
   - mesma organizacao ativa profissional+paciente;
   - papeis `medico` / `profissional_saude`;
   - gestor sem papel clinico negado;
   - vinculo inativo e cross-tenant excluidos;
   - profissional nao consulta carteira de outro;
   - vazia autorizada != erro;
   - sem demoData/localStorage/sessionStorage como autorizacao no Supabase;
   - selecao integrada a SUP-B03.2;
   - read-only;
   - mock deterministico;
   - campos minimos;
   - migrations 0001-0010 imutaveis.
7. **Migration prevista**: incremental `0011_clinical_portfolio_linked_read.sql` + rollback + validation.
8. **Arquitetura**: RPC SECURITY DEFINER (justificativa: RLS legada JWT em `professional_assignments` + retorno minimo sem professional_id de cliente).
9. **Testes**: unitarios; fake client; integracao UI; Postgres descartavel; E2E.

#### SUP-C01.2 - Agenda clinica persistida por vinculo ativo

1. **Status**: implementada e mergeada em `main` (`e2bf19c`, PR #8).
2. **Objetivo**: como profissional clinico autenticado, listar/criar/atualizar compromissos apenas para pacientes da carteira autorizada na organizacao ativa.
3. **Dependencias**: `SUP-C01.1`, `SUP-B03.2`, `app_auth.has_active_clinical_assignment`.
4. **Escopo incluido**:
   - hardening de `appointments` (CHECK status/tipo, indices, unique slot ativo);
   - RLS SELECT/INSERT/UPDATE + `can_manage_clinical_agenda`;
   - repository/service mock+supabase;
   - `ClinicalAgendaPage` e proximos atendimentos do overview;
   - estados loading/vazia/erro/filtro vazio + anti-stale.
5. **Escopo excluido**:
   - `unit_id` (gap residual arquitetural);
   - DELETE fisico (cancelamento via status);
   - ficha/plano/registros (SUP-C02+);
   - telemedicina/calendarios externos.
6. **Criterios de aceite**:
   - identidade `auth.uid()`;
   - org + papel clinico ativos;
   - paciente apenas com assignment ativo;
   - isolamento multi-org;
   - escrita/atualizacao autorizada e negada cobertas;
   - sem demo hardcoded no modo Supabase;
   - mock deterministico;
   - migrations 0001-0011 imutaveis.
7. **Migration**: `0012_clinical_agenda_linked_write.sql` + rollback + validation.
8. **Testes**: unitarios; integracao UI; Postgres; E2E acceptance.

### SUP-C02

1. **Identificador**: `SUP-C02`
2. **Titulo**: Persistencia da ficha clinica modular e versionada
3. **Finalidade**: manter rastreabilidade clinica sem perder flexibilidade de seções.
4. **Escopo incluido**:
   - estrutura de `clinical_records` com metadados de revisao;
   - estrategia de versao por registro ou tabela de historico;
   - suporte a rascunho e conclusao.
5. **Fora do escopo**:
   - assinatura digital;
   - prescricao eletronica.
6. **Dependencias**: `SUP-C01`, aprovacao clinica de estrutura de secoes.
7. **Entidades/tabelas**: `clinical_records` (+ eventual `clinical_record_versions`).
8. **Perfis/permissoes afetados**:
   - clinica vinculada;
   - usuario final com eventual resumo autorizado;
   - gestao sem acesso individual.
9. **RLS necessaria**:
   - leitura/escrita clinica por vinculo;
   - bloqueio total para gestao institucional e RH.
10. **Criterios de aceite**:
   - edicao e conclusao persistidas com autor e timestamp;
   - historico de alteracoes consultavel por perfis autorizados.
11. **Testes obrigatorios**:
   - integracao rascunho/conclusao;
   - negacao de acesso para nao clinicos;
   - regressao de guardas de rota.
12. **Riscos de seguranca/LGPD**:
   - dados sensiveis em excesso sem minimizacao;
   - historico alteravel sem trilha confiavel.
13. **Estimativa**: grande
14. **Ordem recomendada**: 10

#### SUP-C02 - Ficha clinica modular versionada (implementacao)

1. **Status**: CONCLUIDA e integrada em `main` via PR #9 (`2ab6546f9411c165f4b47d4bc56acbda8c139439`).
2. **Objetivo**: persistir ficha clinica modular (`clinical_record.v1`) com rascunho, conclusao, historico append-only e nova revisao sem sobrescrita opaca.
3. **Dependencias**: `SUP-C01.1`, `SUP-C01.2`, `app_auth.has_active_clinical_assignment`.
4. **Escopo incluido**:
   - migration `0013` + rollback + validation;
   - `clinical_records` evolutivo + `clinical_record_versions`;
   - RLS SELECT/INSERT/UPDATE; sem DELETE; versions somente SELECT (+ trigger SECURITY DEFINER);
   - repository/service mock+supabase;
   - `ClinicalRecordPage` integrada a carteira real;
   - nota discreta de estrutura clinica em validacao.
5. **Escopo excluido**:
   - SUP-C03 / plano de cuidado;
   - prescritao/assinatura/telemedicina/prontuario externo;
   - avaliacoes e registros assistenciais genericos.
6. **Decisoes clinicas provisórias** (sujeitas a Dra. Katya):
   - secoes e labels de `clinical_record.v1`;
   - obrigatoriedade na conclusao: motivo, avaliacao profissional, conduta.
7. **Migration**: `0013_clinical_record_versioned_write.sql` + rollback + `SUP_C02_CLINICAL_RECORD_VALIDATION.sql`.
8. **Testes**: unitarios; integracao UI; Postgres; E2E acceptance.

### SUP-C03

1. **Identificador**: `SUP-C03`
2. **Titulo**: Persistencia do plano de cuidado e evolucoes
3. **Finalidade**: registrar objetivos, acoes e status de acompanhamento.
4. **Escopo incluido**:
   - `care_plans` + `care_plan_actions`;
   - atualizacao de status e registro de evolucao;
   - reavaliacao e prazos.
5. **Fora do escopo**:
   - recomendacao terapeutica automatica;
   - protocolos clinicos prescritivos.
6. **Dependencias**: `SUP-C02`.
7. **Entidades/tabelas**: `care_plans`, `care_plan_actions`.
8. **Perfis/permissoes afetados**:
   - equipe clinica vinculada;
   - gestor clinico (supervisao);
   - gestao institucional sem individual.
9. **RLS necessaria**:
   - mesmos principios de vinculo de ficha clinica;
   - bloqueio de update por perfis nao autorizados.
10. **Criterios de aceite**:
   - objetivos e acoes persistem por usuario vinculado;
   - status historico mantido sem sobrescrita opaca.
11. **Testes obrigatorios**:
   - integracao de adicionar/editar/atualizar status;
   - negacao sem vinculo;
   - E2E de fluxo clinico principal.
12. **Riscos de seguranca/LGPD**:
   - exposicao de plano individual fora da clinica;
   - perda de rastreabilidade de alteracoes.
13. **Estimativa**: media
14. **Ordem recomendada**: 11

#### SUP-C03 - Plano de cuidado e evolucoes (implementacao)

1. **Status**: CONCLUIDA e integrada em `main` via PR #10 (`eac8685e0e7c235792885fc11c6b107db73c6bf2`); hardening follow-up PR #11 (`2511bba…`) e PR #12 (`bf4384f…`).
2. **Objetivo**: plano de cuidado produtivo com objetivos, acoes, status, reavaliacoes, evolucoes e historico append-only.
3. **Dependencias**: `SUP-C01.1` (carteira/assignment), helpers clinicos de `0010+`; ficha (`SUP-C02`) apenas referencia opcional.
4. **Escopo incluido**:
   - migration `0014` + rollback + `SUP_C03_CARE_PLAN_VALIDATION.sql`;
   - evolucao de `care_plans`/`care_plan_actions` + `care_plan_events` append-only;
   - unicidade parcial de plano aberto por `(organization_id, professional_id, patient_id)`;
   - RLS SELECT/INSERT/UPDATE; sem DELETE; eventos sem UPDATE/DELETE;
   - repository/service mock+supabase com concorrencia otimista (`version`);
   - `ClinicalCarePlanPage` integrada a carteira real (`ClinicalPatientContextHeader`).
5. **Escopo excluido**:
   - SUP-C04;
   - alteracoes indevidas em ficha/agenda/carteira;
   - plano coletivo de gestao;
   - prescritao/telemedicina/assinatura/IA clinica.
6. **Decisoes clinicas provisórias** (sujeitas a revisao clinica):
   - status de plano: `planejado|em_andamento|concluido|suspenso`;
   - status de acao: `pendente|em_andamento|concluida|suspensa|cancelada`;
   - suspensao exige justificativa; planos encerrados sao imutaveis (novo plano apos encerramento).
7. **Migration**: `0014_care_plan_evolutions.sql` + rollback + validation.
8. **Testes**: unitarios; integracao UI/repository; Postgres validation; E2E acceptance.

### SUP-C04

1. **Identificador**: `SUP-C04`
2. **Titulo**: Repositorios clinicos e migracao progressiva de dados mock
3. **Finalidade**: trocar apenas dominio clinico para supabase sem afetar demais ambientes.
4. **Status parent**: PARCIAL — C04.1 e C04.2a entregues; normalizacao 42501 entregue; C04.2b encerrada sem implementacao; residual de rollout/pagina demo fora do escopo C04.1. **Nao** marcar o pai como integralmente implementado.
5. **Escopo incluido**:
   - adapters para agenda, carteira, ficha, plano (modos por modulo);
   - instrumentacao de erros e latencia;
   - politica de fallback deny-by-default (avaliacao sem troca de backend no baseline).
6. **Fora do escopo**:
   - troca total de todo o app;
   - alteracao de UX aprovada;
   - modulo access;
   - retornar fixture mock / colecao vazia / null / objeto vazio como sucesso degradado sob falha clinica;
   - escrita ficticia ou falsa percepcao de persistencia;
   - troca dinamica runtime para mock (C04.2b).
7. **Dependencias**: `SUP-C01`, `SUP-C02`, `SUP-C03`.
8. **Entidades/tabelas**: tabelas clinicas da fase C + repositorios.
9. **Perfis/permissoes afetados**: perfis clinicos e usuario final (visoes permitidas).
10. **RLS necessaria**: cobertura completa das consultas de clinica por vinculo e tenant.
11. **Criterios de aceite**:
   - rotas clinicas mantidas;
   - carteira e detalhe por usuario com consistencia de vinculo;
   - ausencia de fallback clinico inseguro no baseline.
12. **Testes obrigatorios**:
   - integracao por endpoint/repositorio;
   - E2E de carteira/ficha/plano;
   - testes de negacao em URL direta.
13. **Riscos de seguranca/LGPD**:
   - fallback inseguro mostrando dado stale / fixture / ausencia falsa;
   - diferenca de autorizacao entre camada app e banco.
14. **Estimativa**: grande
15. **Ordem recomendada**: 12 (pai parcial; nao iniciar C04.2b)

#### SUP-C04.1 - Modos de repositorio clinico por modulo

1. **Status**: CONCLUIDA e integrada em `main` via PR #13 (`69cb16560ba8f0a45feffb1fc24a766a1648bf05`).
2. **Entrega**: flags `VITE_CLINICAL_*_REPOSITORY_MODE` (`mock` | `supabase`) com precedencia documentada em `.env.example`; defaults desligados / mock quando global ausente.
3. **Nota**: `CLINICAL_RECORD` cobre ficha C02; pagina demo `/clinica/registros` fora do escopo.

#### SUP-C04.2a - Observabilidade clinica + politica deny-by-default

1. **Status**: CONCLUIDA e integrada em `main` via PR #14 (`ca624915abbaeddd6cb4413197830c9edb78fc2f`).
2. **Entrega**: instrumentacao sanitizada; politica avalia elegibilidade; **nao** troca backend no baseline; `enableTransientFallback` e `enableMockDataFallback` default `false`.
3. **Inelegiveis a fallback de dados**: autorizacao, `CROSS_TENANT_DATA`, dominio, writes, nao-transitorios, producao.

#### Normalizacao PostgreSQL 42501 (pre-condicao clinica; nao e C04.2b)

1. **Status**: CONCLUIDA e integrada em `main` via PR #15 (`0f3f666403b6d47b2fa2a2c144fe5667ae0dd538`).
2. **Classificacao canonica** nos repositories clinicos:
   - `errorCode`: `CROSS_TENANT_DATA`
   - `errorKind`: `authorization`
   - `transient`: `false`
3. **Efeito**: 42501 e inelegivel a qualquer fallback de dados.

#### SUP-C04.2b - Switch de dados mock em runtime

1. **Status**: ENCERRADA SEM IMPLEMENTACAO — bloqueio arquitetural comprovado.
2. **Esclarecimento**: encerramento **nao** significa implementacao nem ativacao futura ja planejada.
3. **Proibicoes**:
   - fixtures mock nao constituem fonte clinica secundaria confiavel;
   - proibido retornar fixture mock como fallback clinico runtime;
   - proibido retornar colecao vazia, `null` ou objeto vazio como sucesso degradado;
   - proibida qualquer escrita ficticia ou falsa percepcao de persistencia.
4. **Retomada futura somente apos** (alternativa):
   - (a) cache seguro de dados reais (tenant/usuario/paciente, integridade, TTL, invalidacao, indicacao visual de stale); ou
   - (b) estado degradado explicito, com contrato e UX proprios.
5. **Diretriz**: nao iniciar C04.2b no caminho critico atual. Continuidade: `PROJECT_MASTER_HANDOFF.md`.

---

## Fase D - Gestao agregada segura

### Definicao de pronto da Fase D

- Dados de gestao estritamente agregados e anonimizados.
- Sem qualquer drill-down individual para perfis de gestao.
- Campanhas e planos de acao com escopo institucional coerente com a decisao ratificada (organizacao obrigatoria; unidade quando houver recorte operacional).
- Testes de anti-reidentificacao e bloqueio nominal aprovados.
- Dominios pessoais e clinicos preservados (titularidade do paciente; limiar nao bloqueia atendimento clinico autorizado).

### SUP-D01

1. **Identificador**: `SUP-D01`
2. **Titulo**: Schema de gestao coletiva com recorte por unidade/programa
3. **Finalidade**: estruturar base para campanhas, indicadores e plano de acao coletivo no modulo BioMed Gestao (fundacao da gestao coletiva / inteligencia populacional; **nao** totalidade do produto).
4. **Status**:
   - Decisao arquitetural org×unit do dominio coletivo: **RESOLVIDA / RATIFICADA** (handoff §6.1).
   - Especificacao tecnica: **INCORPORADA** (PR #18) e **APROVADA PARA IMPLEMENTACAO CONTROLADA** (PR #19).
   - Ciclo tecnico **D01-A/B/C/D**: **CONCLUIDO E INTEGRADO EM `main`**.
   - **D01-A (contratos/tipos)**: **CONCLUIDO** — `apps/web/src/domains/collective/` + `tests/unit/collectiveContracts.test.ts` (PR #20, `36c6d2…`).
   - **D01-B (schema/migration/RLS)**: **CONCLUIDO EM MAIN** — PR #21 merge `0591ee73d1504ee76095a432ed2237a429ff749d`; migration `0017` + rollback + validacao SQL; B1 corrigido (REVOKE helpers internos).
   - **D01-C (repositories + UI gestao)**: **CONCLUIDO E MERGEADO EM MAIN** — PR #22 (2026-08-01), merge commit `907f3ed0d0a53484553debb917cfebdf2566ccb8`, HEAD incorporado `407928778d34c3d7662b0b5f009b403fcfabbb89`; consolidacao documental pos-merge **PR #23** (`b32aa121292fe68a28b4d1fb918bb077ad84d749` — baseline de partida do PR #24); module `apps/web/src/services/repositories/collective/` (mock + supabase + factory/flags); UI campanhas/planos; no D01-C as escritas multi-tabela retornavam `ATOMICITY_REQUIRED` (limitacao historica, superada pelo D01-D); sem fallback runtime Supabase→mock; overview/indicadores demo (**registro historico D01-C:** a epoca, implementacao SUP-D02 ainda inexistente); `selectedUnitId` de sessao nao implementado.
   - **D01-D (mutacoes atomicas)**: **CONCLUIDO E INTEGRADO EM MAIN** — PR #24 (2026-08-01), HEAD auditado `ebfd700cf3d55c74011dc2ef869845e3a0e8da26`, merge commit `00b7b3f727b5eaba2432640af4c5751db52d1f05`; baseline de partida historico `b32aa12…` (PR #23); migration `0018` + rollback + validacao SQL; RPCs SECURITY INVOKER (padrao D01; **nao** transportar automaticamente como solucao do D02): `collective_create_campaign_atomic`, `collective_update_campaign_atomic`, `collective_delete_campaign_atomic`, `collective_create_action_plan_atomic`, `collective_update_action_plan_atomic`, `collective_delete_action_plan_atomic`; capacidades: `selected_units` + audiencia singular na mesma transacao; UNIQUE `campaign_audiences_one_per_campaign`; transicoes de escopo; concorrencia `expected_version` + `FOR UPDATE`; RLS autoridade final; repository/UI persistem via RPC; codigo `ATOMICITY_REQUIRED` permanece disponivel para ops futuras nao implementadas. **Registro historico do merge D01-D:** implementacao SUP-D02 ainda nao existia.
   - **Auditoria independente do PR #24 (HEAD `ebfd700…`):** veredito **B**; nenhum P1/P2; nenhum achado bloqueante; prova concorrente aprovada; rollback/reaplicacao `0018` aprovados; SQL D01-D aprovado.
   - **Dividas P3 de teste (D01-C) — ENCERRADAS pelos testes do D01-D:** (1) suite de integracao `ManagementActionPlanPage`; (2) assert negativo de ausencia de mensagem de sucesso apos falha de create; (3) cobertura Vitest `NO_ACTIVE_MEMBERSHIP` no repository coletivo.
   - **P3 residual distinto (nao bloqueante):** issue **#25** — mensagem de sucesso residual apos falha de close/delete na UI coletiva; **aberta**; follow-up isolado; **nao** confundir com as tres dividas P3 do D01-C.
   - Gap residual `unit_id` clinico (SUP-C01): dívida **paralela**; **nao** bloqueia o D01.
5. **Escopo incluido** (detalhe normativo em `SUP_D01_TECHNICAL_SPECIFICATION.md`):
   - consolidacao de `campaigns`, `campaign_audiences`, `action_plans` no dominio coletivo;
   - escopo `organization` | `unit`; aplicabilidade `all_units` | `selected_units`;
   - preparacao do contrato `suppressed` (enforcement pleno no SUP-D02);
   - status e periodos padronizados;
   - repositories + UI de campanhas/planos (D01-C);
   - mutacoes relacionais atomicas (D01-D, integrado em `main` via PR #24).
6. **Fora do escopo**:
   - envio real de notificacoes;
   - integracao externa de BI;
   - indicadores/agregacoes/limiar completo (SUP-D02 — **implementacao nao iniciada** / nao autorizada; ver SPEC);
   - gap C01 agenda; SUP-B04; SUP-C04.2b;
   - correcao catch→mock (ticket proprio);
   - tornar prontuario pessoal propriedade da organizacao.
7. **Dependencias**: `SUP-A01` (tenant/units/memberships); decisao org×unit coletiva **ratificada**.
8. **Entidades/tabelas**: `campaigns`, `campaign_audiences`, `action_plans` (+ evolucao de escopo/aplicabilidade conforme SPEC).
9. **Perfis/permissoes afetados**:
   - gestor_institucional, sst, admin_cliente, admin_biomed, auditor (leitura);
   - usuario unit-scoped: leitura de campanhas org aplicaveis + da propria unit (regra ratificada).
10. **RLS necessaria**: tenant + papeis gerenciais; proibicao de leitura nominal; isolamento unitario conforme SPEC; evolucao do JWT legado (`0002`) no bloco de isolamento do D01.
11. **Criterios de aceite**: ver `SUP_D01_TECHNICAL_SPECIFICATION.md` §14 (20 criterios).
12. **Testes obrigatorios**:
   - integracao de CRUD gerencial permitido (apos autorizacao de repos/UI);
   - negacao para perfis clinicos/usuario final no painel gerencial;
   - testes de schema sem dado nominal.
13. **Riscos de seguranca/LGPD**:
   - reidentificacao por grupos pequenos ou filtros diferenciais (D02);
   - campos indiretos permitindo inferencia individual;
   - absorcao indevida de dado pessoal pelo vinculo institucional.
14. **Estimativa**: media
15. **Ordem recomendada**: 13 — ciclo D01 em main; SPEC D02 via PR #27; Gate D02-0 via PR #28 em main (reauditado com P3). Proximo: criterio 14 + inventario remoto; D02-A **bloqueado**. Issue **#25** isolada.

### SUP-D02

1. **Identificador**: `SUP-D02`
2. **Titulo**: Camada de indicadores agregados e politicas anti-drilldown
3. **Finalidade**: garantir leitura coletiva segura em BioMed Gestao.
4. **Status**:
   - Dependencia tecnica D01: **SATISFEITA**.
   - Planejamento / SPEC: integrados em `main` via **PR #27** (`547c60c…` — base histórica do PR #28).
   - **Gate D02-0**: PR #28 **mergeado** (`b04b4b9…`); HEAD corretivo `f9a4ca5…` (B1–B6/P05); 1a auditoria histórica **reprovou**; reauditoria **aprovada com P3** (2026-08-03). Status: **Gate D02-0 documentalmente reauditatado e aprovado com P3**; desenho **proposto / especificado**; **Gate de implementacao nao liberado**.
   - **Implementacao**: **NAO INICIADA** e **NAO AUTORIZADA**.
   - **D02-A e posteriores**: **BLOQUEADOS** pelo criterio 14 (autorizacao humana separada ausente). Criterios 11–13: **Sim**.
   - **Desbloqueio objetivo de D02-A:** criterio Gate `D02-0.10` item 14 + ordem humana + inventario remoto.
   - **Ambiente HML (sanitizado):** SUP-ENV-04/05/06 — bootstrap+vinculo; historico inicialmente vazio; dry-run validado; `0001`–`0018` aplicadas e sincronizadas; seed nao executado; `0019` inexistente; bootstrap local ainda nao integrado ao repositorio. Aplicacao das migrations **nao** autoriza D02-A.
   - **Aceite futuro D02-A (A1–A3):** cota organizacional por org+indicador+mes independente de canal; indistinguibilidade serializada 0 vs 1–9 + mitigacao temporal mensuravel; orcamento anti-diferencial organizacional compartilhado/atomico (multi-ator/sessoes/canais).
5. **Escopo incluido** (detalhe na SPEC + Gate):
   - agregacao via RPC **SECURITY DEFINER** endurecida (proposta);
   - `support_n` >= 10; bandas obrigatorias P01–P04; sem contagem exata; sem estado publico `empty`;
   - `IND-D02-P05` **bloqueado/diferido**;
   - anti-diferencial **desde D02-A**;
   - auditoria minima + **fail-closed**;
   - piloto organizacional; rejeitar `unitId`/`unitIds`;
   - faseamento Gate D02-0 → A → B → C → D.
6. **Fora do escopo**: analytics preditiva; dashboards externos; nominal; D03; membership como unit historica; issue #25; implementacao neste PR documental; exportacao no piloto.
7. **Dependencias**: SUP-D01; limiar 10; Gate D02-0 (criterio 14 + inventario remoto + ordem humana).
8. **Entidades/tabelas**: `assessments`, `user_journeys`, `risk_results` (agregar so em `organization` no piloto).
9. **Perfis**: gerenciais/auditor leitura agregada; sem nominal; sem SELECT bruto gerencial em `risk_results` (desenho futuro).
10. **RLS / privilegio**: proposta DEFINER endurecida; **proibido** ampliar SELECT bruto para INVOKER; INVOKER do D01 **nao** justifica D02.
11. **Criterios de aceite**: SPEC D02 §16 + Gate `D02-0.10` + A1–A3.
12. **Testes**: SPEC §14 + matriz adversaria do Gate §6 (incl. concorrencia multi-ator).
13. **Riscos**: reidentificacao; leitura bruta residual ate migration; estado remoto de grants/owners/`BYPASSRLS` nao inventariado; dados tardios em mes historico.
14. **Estimativa**: grande
15. **Ordem**: apos criterio 14 + inventario remoto → D02-A…; **nao** iniciar D02-A antes.

### SUP-D03

1. **Identificador**: `SUP-D03`
2. **Titulo**: Repositorios de gestao e migracao progressiva de indicadores mock
3. **Finalidade**: trocar dados mock de gestao sem impactar clinica e usuario final.
4. **Escopo incluido**:
   - adapters para painel, indicadores, campanhas e plano de acao;
   - selecao explicita de modo por tela/feature (sem autorizar fallback que invente agregado ou oculte falha);
   - validacao de formato agregado unico.
5. **Fora do escopo**:
   - troca de bibliotecas de grafico;
   - redesenho de UI aprovado;
   - sucesso degradado com colecao vazia/`null` fingindo ausencia real de campanhas/indicadores.
6. **Dependencias**: `SUP-D01`, `SUP-D02`.
7. **Entidades/tabelas**: gestao + views agregadas + repositorios.
8. **Perfis/permissoes afetados**: perfis gerenciais e auditoria.
9. **RLS necessaria**: acesso somente ao conjunto agregado permitido por tenant.
10. **Criterios de aceite**:
   - filtros funcionando com dados reais agregados;
   - nenhuma rota de gestao retorna lista nominal.
11. **Testes obrigatorios**:
   - integracao dos repositorios;
   - E2E de campanhas/plano/indicadores;
   - testes de negacao nominal.
12. **Riscos de seguranca/LGPD**:
   - regressao para dado individual por endpoint errado;
   - cache com payload nao agregado.
13. **Estimativa**: media
14. **Ordem recomendada**: 15

---

## Fase E - Auditoria persistente e hardening

### Definicao de pronto da Fase E

- Auditoria persistente append-only ativa para eventos criticos.
- Suite de seguranca (permit/deny) cobrindo tenant, papel e vinculo.
- Endurecimento final de schema, indices e politicas.
- Plano de corte controlado do mock definido por modulo.

### SUP-E01

1. **Identificador**: `SUP-E01`
2. **Titulo**: Implementacao de auditoria persistente append-only
3. **Finalidade**: garantir trilha imutavel de eventos sensiveis.
4. **Status parcial (WP-03.2 + WP-04.0)**:
   - adapter unico `bootstrapAuditTrail` (mock intencional vs supabase fail-closed);
   - RPC `public.register_audit_event` + policy `audit_events_select_auditor` via `app_auth`;
   - migration **0020** em `main` e **aplicada no HML** (validacao estrutural + comportamental);
   - UI de gestao lista via `listAuditEventsAsync`;
   - Architecture Baseline v1.0 + ADRs 001–008 registrados (Foundation encerrada);
   - **ainda pendente**: sinks de consentimento/clinico, deny update/delete explicito, suite E2E E01, correlacao rica de entity_id.
5. **Escopo incluido** (restante):
   - padrao de payload minimo completo;
   - bloqueio de update/delete para app user;
   - integracao nos fluxos sensiveis restantes.
5. **Fora do escopo**:
   - SIEM externo;
   - assinatura criptografica de logs.
6. **Dependencias**: `SUP-A02`, `SUP-A03`, fases B/C/D funcionais.
7. **Entidades/tabelas**: `audit_events`.
8. **Perfis/permissoes afetados**:
   - todos os atores como origem de evento;
   - leitura restrita para auditor/perfis autorizados.
9. **RLS necessaria**:
   - select restrito por tenant e papel;
   - insert controlado;
   - update/delete negado para app user.
10. **Criterios de aceite**:
   - eventos de login, negacao e alteracao sensivel persistidos;
   - impossibilidade de escrita direta pelo cliente;
   - impossibilidade de alteracao/exclusao por usuario comum.
11. **Testes obrigatorios**:
   - SQL tests de append-only;
   - integracao de registro em fluxos criticos;
   - E2E de auditoria somente leitura.
12. **Riscos de seguranca/LGPD**:
   - log excessivo de dado sensivel;
   - trilha inconsistente entre modulos.
13. **Estimativa**: media
14. **Ordem recomendada**: 16

### SUP-E02

1. **Identificador**: `SUP-E02`
2. **Titulo**: Suite de seguranca de autorizacao e acesso cruzado
3. **Finalidade**: formalizar bateria automatizada de permit/deny em nivel app + banco.
4. **Escopo incluido**:
   - casos de tenant crossing;
   - casos de sem vinculo clinico;
   - casos de gestao sem dado nominal;
   - casos de auditor sem escrita.
5. **Fora do escopo**:
   - pentest externo;
   - auditoria juridica formal.
6. **Dependencias**: `SUP-A03`, `SUP-C04`, `SUP-D03`, `SUP-E01`.
7. **Entidades/tabelas**: todas as sensiveis cobertas por RLS.
8. **Perfis/permissoes afetados**: todos.
9. **RLS necessaria**: cobertura de politicas existentes com cenarios negativos.
10. **Criterios de aceite**:
   - suite automatizada falha quando policy abre acesso indevido;
   - relatorio de cobertura de cenarios criticos.
11. **Testes obrigatorios**:
   - unitarios de regras de dominio;
   - integracao de repositorios;
   - SQL tests permit/deny;
   - E2E de bloqueios de URL direta.
12. **Riscos de seguranca/LGPD**:
   - falso positivo de seguranca por falta de caso negativo;
   - regressao silenciosa de policy em futuras migrations.
13. **Estimativa**: grande
14. **Ordem recomendada**: 17

### SUP-E03

1. **Identificador**: `SUP-E03`
2. **Titulo**: Hardening final de schema, indices e operacao de rollout
3. **Finalidade**: estabilizar desempenho e seguranca para transicao controlada.
4. **Escopo incluido**:
   - indices criticos;
   - revisao de constraints e defaults;
   - plano de cutover por modulo (mock->real).
5. **Fora do escopo**:
   - publicacao produtiva;
   - escala global multi-regiao.
6. **Dependencias**: todas as fases anteriores.
7. **Entidades/tabelas**: todas do dominio; foco em tabelas de maior volume.
8. **Perfis/permissoes afetados**: todos, impacto transversal.
9. **RLS necessaria**: auditoria final de politicas e documentacao de excecoes (se houver).
10. **Criterios de aceite**:
   - baseline de performance definido;
   - plano de rollback por modulo documentado;
   - checklist de seguranca final aprovado.
11. **Testes obrigatorios**:
   - regressao completa;
   - testes de carga basica por rotas sensiveis;
   - reexecucao da suite de seguranca.
12. **Riscos de seguranca/LGPD**:
   - indice inadequado causar timeout e fallback inseguro;
   - rollout parcial sem travas de feature flag.
13. **Estimativa**: media
14. **Ordem recomendada**: 18

---

## Decisoes humanas obrigatorias (clinicas, juridicas, negociais)

1. Definicao juridica final de bases legais e texto de consentimento por finalidade.
2. Definicao clinica da estrutura final versionada da ficha e limites de conteudo.
3. Definicao clinica do modelo final de ficha (granular relacional vs bloco estruturado versionado).
4. Definicao de politicas de retention de auditoria e exportacao regulatoria.
5. Definicao de estrategia operacional de rollout por tenant/modulo.

---

## Sequencia consolidada, dependencias e marcos de validacao

| Sequencia | Ticket | Fase | Dependencias principais | Marco de validacao |
|---|---|---|---|---|
| 1 | SUP-A01 | A | Aprovacao de papeis | Schema base tenant consistente |
| 2 | SUP-A02 | A | SUP-A01 | Sessao real hibrida sem regressao |
| 3 | SUP-A03 | A | SUP-A01, SUP-A02 | RLS base com deny cross-tenant |
| 4 | SUP-A04 | A | SUP-A01, A02, A03 | Repositorios de acesso em dual-mode |
| 5 | SUP-B01 | B | SUP-A01, A03 | Consentimento versionado com revogacao |
| 6 | SUP-B02 | B | SUP-A03, B01 | Avaliacao persistida com ownership |
| 7 | SUP-B03 | B | SUP-A04, B02 | Jornada/progresso persistidos |
| 8 | SUP-B04 | B | B01, B02, B03 + revisao fallback | ABERTO — posterior; sem fallback inseguro |
| 9 | SUP-C01 | C | SUP-A01, A03 | PARCIAL (filhas 1/2 entregues; gap `unit_id`) |
| 10 | SUP-C02 | C | C01 + aprovacao clinica | CONCLUIDA (PR #9) |
| 11 | SUP-C03 | C | C02 | CONCLUIDA (PR #10; harden #11/#12) |
| 12 | SUP-C04 | C | C01, C02, C03 | PARCIAL: C04.1+#13, C04.2a+#14, 42501+#15; C04.2b ENCERRADA SEM IMPLEMENTACAO |
| 13 | SUP-D01 | D | SUP-A01 + decisao coletiva ratificada | Ciclo A/B/C/D em main (PRs #20–#24; docs #26 `89de7ab…`) |
| 14 | SUP-D02 | D | D01 + limiar 10 | SPEC em main (PR #27); Gate PR #28 mergeado (`b04b4b9…`); reauditoria aprovada com P3; **implementacao nao iniciada**; D02-A bloqueado (criterio 14) |
| 15 | SUP-D03 | D | D01, D02 | Gestao em dados reais agregados |
| 16 | SUP-E01 | E | A02, A03 + B/C/D | Auditoria append-only ativa |
| 17 | SUP-E02 | E | A03, C04 residual, D03, E01 | Suite de seguranca completa |
| 18 | SUP-E03 | E | Todas anteriores | Hardening e plano de cutover final |

---

## Caminho critico recomendado

`SUP-A01 -> … -> [D01] -> [Gate D02-0 documental] -> [WP-03.2/PR#48 + 0020 HML] -> [WP-04.0 Architecture Baseline v1.0 — Foundation ENCERRADA] -> [WP-04.1 Readiness] -> [criterio 14 + inventario remoto] -> [D02-A… — nao autorizada ainda] -> SUP-D03 -> …`

Notas de caminho:

- Overview/indicadores **demo** ate liberacao D02.
- Proposta Gate = DEFINER endurecida; INVOKER do D01 **nao** resolve D02.
- Bandas obrigatorias; `suppressed` unificado; sem `empty`/contagem exata; P05 diferido.
- Anti-diff (incl. A1–A3), auditoria e **fail-closed** **antes** da UI.
- Piloto: escopo `organization`; `unitId`/`unitIds` rejeitados.
- Issue **#25** isolada.
- Fontes: SPEC D02 + `SUP_D02_GATE_D02_0_DECISIONS.md`.
- Gate documentalmente reauditatado com P3 **nao** autoriza D02-A (criterio 14).

Justificativa:

- qualquer atraso em claims/RLS base bloqueia todos os dominios;
- clinica e gestao dependem de seguranca madura para evitar vazamento;
- auditoria append-only e suite de negacao sao gate final obrigatorio.

---

## Primeiro conjunto minimo recomendado para iniciar implementacao

Pacote inicial (MVP tecnico de seguranca + acesso):

1. `SUP-A01`
2. `SUP-A02`
3. `SUP-A03`
4. `SUP-B01`

Racional:

- cria base de tenant + auth + RLS obrigatoria;
- habilita evolucao segura dos demais dominios;
- ja incorpora consentimento versionado desde o inicio;
- adia `SUP-A04` para apos validacao do bloco inicial de seguranca.

