# Contribuição — BioMed Health

Este documento define o fluxo obrigatório para mudanças no repositório BioMed Health. O objetivo é preservar segurança clínica, isolamento multiempresa, rastreabilidade e qualidade de engenharia.

## 1. Princípios

- `main` é a fonte oficial do código integrado.
- Toda mudança deve ocorrer em branch própria e Pull Request.
- Um PR deve ter um único objetivo técnico claramente delimitado.
- Correções, documentação, migrations, refatorações e funcionalidades não devem ser misturadas sem justificativa explícita.
- Nenhuma evidência de teste pode ser presumida. Declare somente o que foi efetivamente executado.
- Dados clínicos e coletivos devem permanecer `fail-closed` em falhas de autenticação, autorização, RLS, tenant ou proveniência.
- `service_role`, segredos e credenciais nunca podem ser enviados ao frontend ou versionados.

## 2. Preparação do ambiente

Use Node conforme `.nvmrc` e execute os comandos a partir da raiz do workspace:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

A política de dependências está em `DEPENDENCY_MANAGEMENT.md`.

## 3. Nomenclatura de branches

Padrões recomendados:

- `feat/<escopo>-<descricao>`
- `fix/<escopo>-<descricao>`
- `chore/<escopo>-<descricao>`
- `docs/<escopo>-<descricao>`
- `test/<escopo>-<descricao>`
- `refactor/<escopo>-<descricao>`
- `ci/<escopo>-<descricao>`

Use nomes curtos, descritivos e sem termos genéricos como `updates`, `changes` ou `new`.

## 4. Requisitos do Pull Request

Todo PR deve informar:

1. objetivo e problema resolvido;
2. escopo incluído e explicitamente excluído;
3. arquivos e módulos afetados;
4. impacto em segurança, LGPD, dados clínicos e multi-tenant;
5. impacto em banco, migrations, RLS, grants, RPCs e rollback;
6. testes criados ou ajustados;
7. comandos efetivamente executados e resultados;
8. riscos residuais e dívida técnica conhecida;
9. evidências ou capturas quando houver mudança visual;
10. autorização adicional exigida, quando aplicável.

O template em `.github/pull_request_template.md` deve ser preenchido sem remover seções relevantes.

## 5. Critérios mínimos de qualidade

Antes do merge, o PR deve:

- estar atualizado com a base aplicável;
- possuir escopo revisável e coerente;
- passar pela CI obrigatória;
- não introduzir warnings de lint ou erros de TypeScript;
- ter testes compatíveis com a mudança;
- preservar contratos de domínio existentes ou documentar sua evolução;
- não criar fallback silencioso para dados clínicos;
- não reduzir isolamento por organização, unidade ou vínculo clínico;
- não alterar migrations já aplicadas; correções devem ocorrer em nova migration;
- documentar rollback de toda mudança de banco;
- atualizar documentação mestre quando houver mudança de baseline, arquitetura ou backlog.

## 6. Banco de dados e Supabase

PRs com SQL, migration, policy, grant, trigger, função ou RPC devem incluir:

- migration forward-only numerada;
- rollback correspondente ou procedimento de reversão documentado;
- análise de compatibilidade com dados existentes;
- análise de RLS e privilégios;
- testes SQL positivos e negativos;
- comportamento concorrente e idempotência, quando aplicável;
- confirmação de que `anon` e `authenticated` recebem apenas os privilégios necessários;
- proibição de `SECURITY DEFINER` sem `search_path` explícito e justificativa;
- validação de isolamento entre tenants e unidades.

Nenhuma migration remota deve ser aplicada apenas com base no merge do PR. A aplicação em ambiente exige autorização operacional separada.

## 7. Mudanças clínicas, coletivas e de IA

Mudanças que afetem prontuário, plano de cuidado, jornada, avaliações, indicadores coletivos ou IA exigem análise adicional de:

- finalidade e base de acesso;
- minimização de dados;
- proveniência e auditoria;
- imutabilidade ou versionamento;
- risco de reidentificação;
- separação entre correlação, hipótese e causalidade;
- supervisão humana e limites de automação;
- comportamento seguro em falhas.

Chamadas de IA não podem ser feitas diretamente pelo React com dados clínicos ou segredos. A futura camada de IA deverá operar por gateway servidor, contratos, políticas e trilha de auditoria.

## 8. Revisão e merge

- O autor deve realizar autoauditoria do diff antes de solicitar revisão.
- Achados P0, P1 ou P2 bloqueiam o merge.
- P3 pode ser aceito somente quando documentado como não bloqueante e com follow-up claro.
- O HEAD auditado não pode mudar entre a revisão final e o merge sem nova verificação.
- O merge deve usar o método aprovado para o repositório e preservar rastreabilidade.
- Não usar merge para contornar CI vermelha, review pendente ou gate documental.

A política detalhada está em `ENGINEERING_REVIEW_AND_MERGE_POLICY.md`.

## 9. Commits

Use mensagens objetivas, preferencialmente no padrão:

```text
<tipo>(<escopo>): <descricao>
```

Exemplos:

```text
fix(management): clear stale success message
ci: establish permanent quality gate
docs(architecture): record D02 gate evidence
```

## 10. Segurança e comunicação

Não publique em issues, PRs, commits ou logs:

- credenciais;
- tokens;
- chaves privadas;
- dados pessoais reais;
- dados clínicos identificáveis;
- arquivos de produção;
- dumps de banco sem sanitização.

Ao identificar possível vulnerabilidade ou vazamento, interrompa a publicação pública e comunique o responsável pelo repositório por canal privado.