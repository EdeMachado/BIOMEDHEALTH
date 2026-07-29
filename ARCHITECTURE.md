# BIOMED HEALTH - Arquitetura Proposta

## Principios arquiteturais

- Multiempresa por padrao (tenant-aware)
- Menor privilegio e segregacao de acesso
- Privacidade e seguranca desde a concepcao
- Separacao rigorosa entre dado clinico e gerencial
- Regras de negocio fora das telas
- Auditoria e rastreabilidade de eventos criticos
- Modelo explicavel para avaliacao orientativa (sem diagnostico)

## Estrategia de repositorio

Monorepo simples, com unica aplicacao web no MVP, organizado por dominio e preparado para evoluir.

## Visao de camadas

1. Interface (React)
- Telas, layouts, componentes de UX
- Sem regra de acesso hardcoded

2. Aplicacao (use-cases)
- Orquestra fluxos de negocio
- Aplica politicas de permissao da sessao

3. Dominio
- Entidades, regras, validacoes, motor orientativo
- Independente de framework/UI

4. Infraestrutura
- Repositorios (mock/supabase)
- Auth provider
- Auditoria
- Storage

5. Dados
- PostgreSQL/Supabase
- Migrations, seed e politicas RLS

## Estrutura de pastas (fundacao)

```txt
biomedhealth/
  apps/
    web/
      src/
        app/
          routes/
          layouts/
          providers/
        domains/
          auth/
          organizations/
          consent/
          assessments/
          risk/
          journeys/
          appointments/
          clinical/
          campaigns/
          analytics/
          audit/
        features/
          minha-biomed/
          biomed-clinica/
          biomed-gestao/
        shared/
          ui/
          design-tokens/
          utils/
          types/
          constants/
        services/
          api/
          repositories/
          auth/
          audit/
          storage/
      tests/
        unit/
        integration/
        e2e/
  supabase/
    migrations/
    seeds/
    policies/
  docs/
  .env.example
  README.md
```

## Design system

Base:

- Tailwind CSS + shadcn/ui customizado
- Tema proprio BIOMED HEALTH (sem visual padrao de template)

Tokens:

- Cores principais:
  - Verde esmeralda `#075E54`
  - Verde escuro `#17342F`
  - Verde claro `#EAF4F1`
  - Dourado `#C7A34B`
  - Dourado claro `#F7F0DE`
  - Branco `#FFFFFF`
- Tipografia, espacamentos, sombras, bordas, foco, estados

## Autenticacao e autorizacao

Fase inicial:

- Login por e-mail/senha
- Magic link
- Recuperacao de senha
- Verificacao de e-mail
- Sessao com expurgo e renovacao segura

Autorizacao:

- RBAC + escopo por organizacao + vinculo profissional/usuario
- Regras de visibilidade implementadas no dominio e reforcadas por RLS

## Modelo de integracao de dados

Abordagem desacoplada:

- Interface `Repository` por dominio
- Implementacao inicial mockada (dados ficticios)
- Implementacao Supabase substituivel sem alterar telas

## Seguranca

- Dados sensiveis fora de `localStorage`
- Tratamento de erro sem exposicao de detalhes internos
- Auditoria de acoes criticas
- Storage privado com URL temporaria
- RLS obrigatoria para tabelas sensiveis

## Auditoria (alto nivel)

Eventos obrigatorios:

- Login/logout/falha relevante
- Visualizacao de registro sensivel
- Criacao/alteracao/exclusao logica
- Exportacao
- Alteracao de permissao
- Consentimento (aceite/revogacao)
- Upload/download de documento

Campos minimos:

- actor_user_id, organization_id, role, action, entity, entity_id
- timestamp, source, result, reason (quando aplicavel)

## Escalabilidade e evolucao

- Preparado para PWA e Capacitor
- Preparado para split futuro em apps separados
- Preparado para MFA em perfis privilegiados
- Preparado para internacionalizacao futura (i18n), mantendo PT-BR agora
