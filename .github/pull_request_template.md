# Objetivo

Descreva o problema e o resultado esperado.

## Escopo

### Incluído

- 

### Explicitamente excluído

- 

## Tipo de mudança

- [ ] Correção
- [ ] Funcionalidade
- [ ] Refatoração
- [ ] Testes
- [ ] Documentação
- [ ] CI/infraestrutura
- [ ] Banco/Supabase
- [ ] Segurança

## Impacto técnico

### Módulos e arquivos afetados

- 

### Contratos e compatibilidade

- [ ] Não altera contratos públicos
- [ ] Altera contratos e a evolução está documentada
- [ ] Mantém compatibilidade com dados existentes
- [ ] Não se aplica

## Segurança, LGPD e isolamento

- [ ] Não adiciona segredos, credenciais ou dados pessoais reais
- [ ] Preserva isolamento por organização, unidade e vínculo aplicável
- [ ] Mantém comportamento `fail-closed` em dados clínicos/coletivos
- [ ] Não usa `service_role` no frontend
- [ ] Analisei riscos de autorização, RLS e reidentificação
- [ ] Não se aplica — justificativa abaixo

Justificativa/observações:

## Banco de dados e Supabase

- [ ] Não altera banco ou Supabase
- [ ] Inclui migration forward-only
- [ ] Inclui rollback ou procedimento de reversão
- [ ] Inclui testes SQL positivos e negativos
- [ ] Analisa RLS, grants, policies, triggers, funções e RPCs
- [ ] Não modifica migration já aplicada
- [ ] A aplicação remota continuará dependendo de autorização operacional separada

Migration(s):

Rollback:

## Testes e validações

Marque apenas o que foi efetivamente executado.

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Testes SQL
- [ ] Testes E2E
- [ ] Validação manual
- [ ] CI aprovada

Resultados e evidências:

## Alterações visuais

- [ ] Não há alteração visual
- [ ] Capturas ou vídeo anexados
- [ ] Estados vazio, carregando, sucesso e erro foram verificados
- [ ] Responsividade e acessibilidade foram verificadas

## Riscos e rollback

Riscos conhecidos:

Plano de rollback:

## Documentação e governança

- [ ] Atualizei documentação técnica afetada
- [ ] Atualizei o documento mestre/baseline quando necessário
- [ ] Registrei decisão arquitetural relevante
- [ ] Não se aplica

## Checklist final

- [ ] O PR possui um único objetivo técnico
- [ ] Revisei o diff completo
- [ ] Não há arquivos fora do escopo
- [ ] Não há código morto, logs temporários ou comentários de depuração
- [ ] Não há P0/P1/P2 conhecido
- [ ] P3 residual está documentado com follow-up
- [ ] O HEAD revisado é o mesmo que será submetido ao merge
- [ ] Este PR não autoriza deploy, migration remota ou mudança operacional não descrita
