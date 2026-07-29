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

- Node recomendado: `22.13.1` (registrado em `.nvmrc`)
- npm: `11+`
- Desenvolvedor deve executar com a versao definida em `.nvmrc` (`nvm use`).
- CI deve usar a mesma versao (`22.13.1`) para evitar divergencias de lint/build.

> Observacao: com Node `22.12.0` foram vistos avisos de engine em dependencias de lint.  
> A recomendacao do projeto e usar `22.13.1` ou superior dentro da mesma linha LTS.

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
  - `/minha-biomed/perfil`
- BioMed Clinica:
  - `/clinica`
  - `/clinica/agenda`
  - `/clinica/carteira`
  - `/clinica/ficha`
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

- `npm audit` apontou vulnerabilidades altas majoritariamente em cadeia de desenvolvimento (lint/build/PWA).
- Dependencias de producao com alerta atual:
  - `react-router-dom`/`react-router` (advisory relacionado a modo RSC/CSRF).
- Decisao nesta etapa:
  - manter versoes atuais para estabilidade da demo;
  - nao aplicar `npm audit fix --force` (evita downgrade/major destrutivo);
  - mitigar por configuracao: sem uso de modo RSC no MVP atual;
  - revisar novamente antes de deploy com janela dedicada de atualizacao segura.
