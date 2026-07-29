# BIOMED HEALTH (MVP - Demo 1)

Saude conectada. Decisoes inteligentes.

> Ambiente demonstrativo - dados ficticios.

## Stack da fundacao

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui (customizado)
- React Router + TanStack Query
- React Hook Form + Zod
- Recharts
- Supabase (schema/migrations/seed preparados, integracao mockada)
- ESLint + Prettier + Vitest + Playwright

## Estrutura

- `apps/web`: frontend principal (Minha BioMed, BioMed Clinica, BioMed Gestao)
- `supabase/migrations`: schema inicial e politicas RLS
- `supabase/seeds`: dados ficticios
- docs na raiz: arquitetura, modelo de dados, permissoes e seguranca

## Executar localmente

### Requisitos de ambiente

- Node requerido: `22.22.0` (registrado em `.nvmrc`)
- npm: `11+`
- Desenvolvedor deve executar com a versao definida em `.nvmrc` (`nvm use`).
- CI deve usar exatamente a mesma versao (`22.22.0`) para evitar divergencias de lint/build.

1. Copie `.env.example` para `.env`.
2. Instale dependencias:
   - `cd apps/web`
   - `npm install`
3. Rode a aplicacao:
   - `npm run dev`
4. Abra `http://localhost:5173`.

## Credenciais demonstrativas

- Usuario: `usuario.demo@biomed.health`
- Medico: `medico.demo@biomed.health`
- Profissional de saude: `profissional.demo@biomed.health`
- Gestor clinico: `gestor.clinico@biomed.health`
- Gestor institucional/RH: `gestor.demo@biomed.health`
- SST: `sst.demo@biomed.health`
- Administrador do cliente: `admin.cliente@biomed.health`
- Administrador BioMed: `admin.biomed@biomed.health`
- Auditor: `auditor.demo@biomed.health`
- Usuario org2 (teste de segregacao): `usuario.org2@biomed.health`
- Senha: `Demo@123`
- Organizacao principal: `BioVale Energia` (`org-1`)

## Rotas disponiveis (demo)

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

## Qualidade

No diretório `apps/web`:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Conexao futura com Supabase

1. Criar projeto Supabase.
2. Preencher `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`.
3. Aplicar migrations em `supabase/migrations`.
4. Rodar seed `supabase/seeds/seed_demo.sql`.

Nenhuma credencial real deve ser versionada.

## Seguranca de dependencias (decisao atual)

- O advisory `GHSA-qwww-vcr4-c8h2` afeta formalmente `react-router >= 7.12.0 e < 8.3.0`.
- O MVP **nao** usa APIs RSC instaveis, reduzindo exposicao pratica, mas o alerta de dependencia foi tratado com migracao.
- Migracao executada:
  - `react-router-dom` removido (descontinuado na linha v8);
  - `react-router` atualizado para `8.3.0`;
  - imports DOM movidos para `react-router/dom`, mantendo app em modo SPA.
- `npm audit --omit=dev` atual: `0` vulnerabilidades altas/criticas em producao.
- Nao foi utilizado `npm audit fix --force`.
