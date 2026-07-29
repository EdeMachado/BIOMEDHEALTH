# BIOMED HEALTH - Plano de Implementacao (MVP Demo 1)

## Objetivo desta fase

Entregar fundacao tecnica e primeira demonstracao funcional com tres fluxos:

- Fluxo A: Minha BioMed (Usuario)
- Fluxo B: BioMed Clinica (Profissional)
- Fluxo C: BioMed Gestao (Gestor Institucional)

Com segregacao de acesso validada:

- Usuario acessa somente os proprios dados
- Profissional acessa somente usuarios vinculados
- Gestor institucional nao acessa ficha clinica
- Organizacoes nao acessam dados entre si

## Escopo da Demo 1 (Must-Have)

### A) Minha BioMed

- Login demonstrativo
- Banner: "Ambiente demonstrativo - dados ficticios"
- Onboarding
- Aviso de privacidade + consentimento versionado
- Avaliacao inicial
- Resultado orientativo (nao diagnostico)
- Ingresso em jornada
- Painel inicial (resumo, progresso, proxima consulta, atividades)
- Perfil e privacidade

### B) BioMed Clinica

- Login demonstrativo
- Painel profissional
- Agenda
- Carteira de usuarios vinculados
- Visualizacao de avaliacao
- Ficha clinica demonstrativa
- Plano de cuidado
- Registro de atendimento ficticio

### C) BioMed Gestao

- Login demonstrativo
- Painel executivo
- Indicadores agregados
- Campanhas
- Distribuicao coletiva de risco
- Plano de acao
- Bloqueio explicito para dados clinicos individuais

## Fora de escopo da Demo 1

- Teleconsulta
- Pagamentos
- Marketplace
- Suplementos
- IA clinica
- Diagnostico automatico
- Integracao eSocial
- Publicacao nas lojas mobile
- Modulo juridico

## Ordem de execucao

## Fase 2 - Planejamento (atual)

1. Consolidar arquitetura e estrutura de pastas
2. Definir modelo de dados inicial
3. Definir matriz de perfis e permissoes
4. Definir checklist de seguranca

## Fase 3 - Fundacao

1. Bootstrap do projeto (Vite React TS)
2. Configuracao de qualidade (ESLint, Prettier, Vitest)
3. Design system base (Tailwind + shadcn/ui customizado)
4. Roteamento e layouts (3 areas de produto)
5. Camada de dados desacoplada (repositorios/interfaces)
6. Auth mockada com perfis e organizacoes
7. Modelo SQL inicial + migrations + seed ficticio
8. `.env.example` e documentacao de conexao futura com Supabase

## Fase 4 - Interfaces da Demo 1

1. Telas prioritarias Minha BioMed
2. Telas prioritarias BioMed Clinica
3. Telas prioritarias BioMed Gestao
4. Navegacao responsiva (mobile/tablet/desktop)

## Fase 5 - Seguranca e testes

1. Politicas RLS (scripts SQL + simulacao de acesso)
2. Auditoria de eventos essenciais
3. Testes unitarios de regras/validacoes
4. Testes integracao autorizacao/segregacao
5. Testes E2E dos 8 cenarios prioritarios
6. Lint, typecheck, testes e build obrigatorios

## Fase 6 - Entrega

1. README de execucao local
2. Guia deploy
3. Guia Capacitor (Android/iOS)
4. Lista de usuarios ficticios demo
5. Riscos, pendencias e proximos passos

## Dependencias planejadas (validar versoes no momento de instalacao)

- Frontend: React, TypeScript, Vite
- UI: Tailwind CSS, shadcn/ui (base Radix UI), Lucide Icons
- App: React Router, TanStack Query
- Forms: React Hook Form, Zod
- Graficos: Recharts
- Backend client: supabase-js
- Qualidade: ESLint, Prettier, Vitest, React Testing Library, Playwright
- Mobile/PWA: Capacitor + plugin PWA do Vite

## Criterio de pronto para avancar alem da Demo 1

- Fluxos A, B e C completos
- Segregacao de acesso comprovada por testes
- RLS inicial escrita e validada
- Zero segredos em repositorio
- Lint + typecheck + testes + build passando
