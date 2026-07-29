# BIOMED HEALTH - DEMO AUDIT

Data: 2026-07-29  
Escopo auditado: fundacao + primeira demo, sem conexao Supabase e sem dados reais.

## Ambiente

- Node detectado na maquina: `v22.12.0`
- Node definido no projeto: `.nvmrc` = `22.13.1`
- Regra adicionada em `package.json` (raiz e `apps/web`): `engines.node >=22.13.1 <23`
- CI: nao ha workflow configurado ainda; ao criar CI, deve usar `22.13.1` explicitamente.

## Vulnerabilidades de producao

### Antes

- `npm audit --omit=dev --json`
  - High: 2
  - Critical: 0
  - Pacotes: `react-router-dom@7.18.2` e `react-router@7.18.2`

### Verificacao de versao corrigida (GHSA-qwww-vcr4-c8h2)

- Advisory indica correcoes em:
  - `>= 7.18.2` (linha v7)
  - `>= 8.3.0` (linha v8)
- Projeto ja estava em `7.18.2` (versao corrigida na linha v7).

### Acoes executadas

- Pin explicito para `react-router-dom@7.18.2` e `react-router@7.18.2`.
- Lockfile atualizado.
- **Nao** foi usado `npm audit fix --force`.
- **Nao** foi feita atualizacao major para v8.

### Depois

- `npm audit --omit=dev --json`
  - Continua reportando High: 2 (base de advisories npm ainda marcando faixa ampla de v7).

### Exploitabilidade neste sistema e mitigacao

- Advisory relacionado a caminho de RSC instavel (nao utilizado neste MVP).
- Aplicacao atual e SPA cliente, sem fluxo RSC/SSR ativo.
- Mitigacao adotada:
  - permanencia em `7.18.2` (patch v7 documentado),
  - bloqueio de rotas por perfil/organizacao,
  - testes E2E de acesso direto por URL e negacao de acesso.

## Rotas disponiveis

- Publicas:
  - `/login`
  - `/acesso-negado`
- Minha BioMed:
  - `/minha-biomed`
  - `/minha-biomed/jornada`
  - `/minha-biomed/atividades`
  - `/minha-biomed/agenda`
  - `/minha-biomed/perfil`
- BioMed Clinica:
  - `/clinica`
  - `/clinica/agenda`
  - `/clinica/carteira`
  - `/clinica/avaliacoes`
  - `/clinica/ficha`
  - `/clinica/plano-cuidado`
  - `/clinica/registros`
- BioMed Gestao:
  - `/gestao`
  - `/gestao/campanhas`
  - `/gestao/indicadores`
  - `/gestao/plano-acao`
  - `/gestao/auditoria`

## Credenciais ficticias

Senha unica: `Demo@123`

- Usuario Minha BioMed: `usuario.demo@biomed.health`
- Medico: `medico.demo@biomed.health`
- Profissional de saude: `profissional.demo@biomed.health`
- Gestor clinico: `gestor.clinico@biomed.health`
- Gestor institucional/RH: `gestor.demo@biomed.health`
- SST: `sst.demo@biomed.health`
- Administrador do cliente: `admin.cliente@biomed.health`
- Administrador BioMed: `admin.biomed@biomed.health`
- Auditor: `auditor.demo@biomed.health`
- Usuario org2 (teste segregacao): `usuario.org2@biomed.health`

## Auditoria funcional objetiva

### Minha BioMed

- Login: OK
- Consentimento (checkbox versionado demonstrativo): OK
- Avaliacao inicial: OK
- Resultado orientativo (nao diagnostico): OK
- Jornada: OK
- Atividades: OK
- Agenda: OK (rota dedicada adicionada)
- Perfil e privacidade: OK

### BioMed Clinica

- Login: OK
- Agenda: OK
- Carteira vinculada: OK
- Avaliacoes: OK (demonstrativa)
- Ficha clinica: OK (demonstrativa)
- Plano de cuidado: OK (demonstrativa)
- Registro de atendimento: OK (demonstrativa)

### BioMed Gestao

- Login: OK
- Painel executivo: OK
- Campanhas: OK
- Indicadores coletivos: OK
- Distribuicao agregada de risco: OK
- Plano de acao: OK

## Restricoes auditadas

- RH nao acessa ficha clinica: OK
- Usuario nao acessa dados de terceiros: OK no mock
- Profissional nao acessa usuario nao vinculado: OK
- Organizacao nao acessa outra organizacao: OK (teste de login e politicas preparadas)
- Auditor nao edita: OK
- Admin sem acesso clinico automatico: OK
- URL direta protegida: OK

## Revisao UX objetiva

- Menus excessivos: nao identificado no recorte.
- Paginas sem funcao: nao ha pagina vazia; ha paginas demonstrativas com conteudo estatico.
- Botoes sem acao (must-have): nao identificado apos ajustes.
- Links sem destino: nao identificado nas rotas auditadas.
- Dados estaticos: dashboards, agenda e parte clinica seguem dados mockados.
- Comportamentos simulados:
  - autenticacao mockada (sessionStorage),
  - auditoria em sessao local,
  - sem persistencia backend real.
- Responsividade:
  - desktop/tablet/mobile validados por screenshot automatizado.
- Acessibilidade:
  - foco visivel nos principais controles;
  - ponto de melhoria: ampliar validacao automatizada WCAG/ARIA em fase seguinte.
- Erros/warnings no navegador:
  - sem erro de execucao bloqueante observado no fluxo E2E;
  - warning de bundle grande mitigado com code splitting.

## Diferencas entre solicitado e entregue

- Entregue como demonstracao funcional com dados ficticios e regras de acesso.
- Ainda simulado (por decisao desta fase):
  - persistencia real no Supabase,
  - RLS executada em banco real,
  - trilha de auditoria persistente em backend.

## Telas incompletas

- Nenhuma tela do recorte must-have esta ausente.
- Permanecem em formato demonstrativo (sem backend real):
  - avaliacoes clinicas detalhadas,
  - plano de cuidado com persistencia,
  - registro assistencial persistente.

## Botoes sem acao

- Nao identificado botao sem acao nos fluxos must-have auditados.

## Links sem destino

- Nao identificado link quebrado nas rotas auditadas.

## Dados estaticos e simulacao

- Dados de indicadores, agenda, carteira e campanhas ainda estaticos/mockados.
- Sessao de autenticacao e trilha de auditoria em `sessionStorage`.

## Warnings/erros de navegador

- Sem erro de execucao bloqueante observado nos testes E2E.
- Sem warning critico de console capturado durante os fluxos automatizados.

## Screenshots (indice)

- Produto: Minha BioMed | Tela: Inicio | Perfil: Usuario | Resolucao: 1440x900 | Arquivo: `apps/web/tests/e2e/screenshots/desktop/minha-biomed.png`
- Produto: BioMed Clinica | Tela: Visao Geral | Perfil: Medico | Resolucao: 1440x900 | Arquivo: `apps/web/tests/e2e/screenshots/desktop/biomed-clinica.png`
- Produto: BioMed Gestao | Tela: Painel Executivo | Perfil: Gestor Institucional | Resolucao: 1440x900 | Arquivo: `apps/web/tests/e2e/screenshots/desktop/biomed-gestao.png`
- Produto: Minha BioMed | Tela: Inicio | Perfil: Usuario | Resolucao: 834x1112 | Arquivo: `apps/web/tests/e2e/screenshots/tablet/minha-biomed.png`
- Produto: BioMed Clinica | Tela: Visao Geral | Perfil: Medico | Resolucao: 834x1112 | Arquivo: `apps/web/tests/e2e/screenshots/tablet/biomed-clinica.png`
- Produto: BioMed Gestao | Tela: Painel Executivo | Perfil: Gestor Institucional | Resolucao: 834x1112 | Arquivo: `apps/web/tests/e2e/screenshots/tablet/biomed-gestao.png`
- Produto: Minha BioMed | Tela: Inicio | Perfil: Usuario | Resolucao: 390x844 | Arquivo: `apps/web/tests/e2e/screenshots/mobile/minha-biomed.png`
- Produto: BioMed Clinica | Tela: Visao Geral | Perfil: Medico | Resolucao: 390x844 | Arquivo: `apps/web/tests/e2e/screenshots/mobile/biomed-clinica.png`
- Produto: BioMed Gestao | Tela: Painel Executivo | Perfil: Gestor Institucional | Resolucao: 390x844 | Arquivo: `apps/web/tests/e2e/screenshots/mobile/biomed-gestao.png`
