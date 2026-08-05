# Política de Revisão e Merge — BioMed Health

## 1. Finalidade

Esta política transforma revisão, CI e merge em gates formais de engenharia. Ela se aplica a código, documentação, banco, infraestrutura, segurança e arquitetura.

## 2. Classificação de achados

### P0 — Crítico

Risco imediato de vazamento, perda de dados, quebra severa de isolamento, corrupção, indisponibilidade relevante ou exposição de segredo.

**Resultado:** merge proibido.

### P1 — Alto

Falha de segurança, integridade ou regra de negócio com impacto significativo; ausência de rollback seguro em mudança destrutiva; regressão clínica relevante.

**Resultado:** merge proibido.

### P2 — Médio

Defeito funcional reproduzível, cobertura insuficiente de cenário importante, inconsistência arquitetural relevante ou documentação necessária ausente.

**Resultado:** merge proibido até correção ou reclassificação fundamentada.

### P3 — Baixo

Melhoria editorial, manutenção de baixo risco ou dívida pequena sem impacto material no comportamento atual.

**Resultado:** pode ser aceito quando documentado, com responsável e follow-up claro.

## 3. Gates obrigatórios

Um PR somente pode ser integrado quando:

1. possui objetivo e escopo explícitos;
2. o diff foi revisado integralmente;
3. a CI está verde no HEAD atual;
4. não há P0, P1 ou P2 aberto;
5. testes correspondem ao risco da mudança;
6. mudanças de banco possuem migration, rollback e análise de RLS;
7. mudanças clínicas/coletivas preservam comportamento seguro e auditável;
8. documentação afetada foi atualizada;
9. não há credenciais, dados pessoais reais ou artefatos temporários;
10. o HEAD não mudou após a revisão final.

## 4. Evidência de validação

A descrição do PR deve separar:

- **executado e aprovado**;
- **não executado**;
- **não aplicável**;
- **pendência conhecida**.

Não são aceitas afirmações genéricas como “testado” ou “funciona” sem indicar comando, ambiente ou evidência.

## 5. Regras específicas de banco

### Merge não equivale a deploy

O merge de migration ou configuração não autoriza aplicação remota. A execução em HML ou produção exige decisão operacional separada, baseline confirmado e plano de reversão.

### Proibições

- editar migration já aplicada;
- ampliar grants sem justificativa e teste negativo;
- usar `SECURITY DEFINER` sem `search_path` explícito;
- expor função sensível diretamente a `anon`;
- reduzir RLS para facilitar desenvolvimento;
- realizar correção destrutiva sem backup ou estratégia de recuperação.

## 6. Regras para segurança clínica e coletiva

São bloqueantes:

- fallback para mock após erro de autenticação, RLS ou tenant;
- retorno de dado vazio como sucesso quando a origem falhou;
- ausência de proveniência em leitura clínica crítica;
- exposição de contagem que viole limiar de privacidade;
- possibilidade de reconstrução por drilldown/diferença não mitigada;
- escrita clínica sem versão, autoria ou trilha quando exigida pelo domínio.

## 7. Regras futuras para IA

PRs de IA deverão incluir, no mínimo:

- finalidade e usuário autorizado;
- classes de dados enviadas ao modelo;
- política de minimização/redação;
- modelo e versão;
- prompt ou template versionado;
- fontes utilizadas e proveniência;
- limites de confiança e linguagem;
- supervisão humana;
- registro auditável da execução;
- testes de segurança, qualidade e falha.

Nenhum modelo poderá receber acesso irrestrito ao banco clínico.

## 8. Métodos de merge

O método escolhido deve preservar rastreabilidade e manter `main` compreensível. PRs devem ser pequenos o suficiente para auditoria. Não é permitido usar merge administrativo para ignorar CI, review ou gate documental.

## 9. Alterações após aprovação

Qualquer commit novo após a revisão final invalida a conclusão anterior até que:

- o novo diff seja inspecionado;
- a CI do novo HEAD conclua;
- os riscos sejam reavaliados.

## 10. Exceções

Exceções são permitidas somente em resposta a incidente real e devem registrar:

- motivo;
- risco aceito;
- aprovador;
- ações compensatórias;
- prazo de correção definitiva;
- evidências pós-implantação.

Urgência não elimina rastreabilidade.