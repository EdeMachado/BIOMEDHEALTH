# WP-02.3 — Database Security Review

## 1. Objetivo e limite de evidência

Esta revisão avalia a segurança do banco a partir das migrations `0001`–`0018` e da documentação versionada em `main`.

Ela comprova o **desenho versionado**. Não comprova, sem inventário operacional do Supabase remoto:

- owners efetivos;
- roles com `BYPASSRLS`;
- grants manuais ou divergentes;
- policies criadas fora das migrations;
- configuração de `PUBLIC` no schema `public`;
- objetos de Storage;
- aplicação integral das migrations em todos os ambientes.

## 2. Veredito

**Classificação geral: B — arquitetura segura com dois achados P2 e pendências remotas.**

A base demonstra boa disciplina de RLS, grants restritos, isolamento por vínculo persistido, RPCs transacionais, imutabilidade e histórico append-only. Entretanto, duas inconsistências precisam ser resolvidas antes de ampliar superfícies de acesso ou iniciar D02-A.

## 3. Controles positivos comprovados

### 3.1 Isolamento por vínculo persistido

A migration `0004` substitui dependência exclusiva de claims JWT por consultas a `user_organizations`, `user_roles`, `roles` e unidade aplicável.

Controles relevantes:

- vínculo organizacional ativo;
- papel ativo;
- escopo opcional por unidade;
- bloqueio de autoconcessão de papéis/perfis;
- validação de unidade pertencente à organização;
- RLS habilitada nas tabelas de acesso.

### 3.2 Deny-by-default e autenticação

As policies posteriores exigem `auth.uid() is not null` e verificações de vínculo/papel antes de leitura ou escrita.

### 3.3 Segurança clínica

As migrations clínicas posteriores adotam:

- assignment clínico ativo;
- `professional_id = auth.uid()` em operações próprias;
- supervisão por papel separado;
- planos encerrados imutáveis;
- eventos append-only;
- ausência de `DELETE` em históricos;
- RPC de reavaliação com lock e versão esperada;
- grants de escrita por coluna;
- helpers internos sem execução direta após o hardening `0015`.

### 3.4 RPCs e concorrência

As RPCs de avaliação, jornada, ficha, plano de cuidado e gestão coletiva verificam sessão, tenant, papel, contexto, estado e versão antes da mutação.

O padrão moderno observado é:

```sql
security definer
set search_path = pg_catalog, public
```

seguido de `REVOKE ALL` de `PUBLIC`/`anon` e `GRANT EXECUTE` apenas a `authenticated` quando a função constitui API pública.

### 3.5 Gestão coletiva

As migrations `0017` e `0018` estruturam escopo organizacional/unitário, aplicabilidade, consistência entre organização e unidade, mutações atômicas e controle otimista por versão.

## 4. Achados

### P2-SEC-01 — Helpers fundacionais `SECURITY DEFINER` com `search_path = public`

Na migration `0004`, as funções abaixo são `SECURITY DEFINER` e usam apenas `set search_path = public`:

- `app_auth.has_active_org_link(uuid)`;
- `app_auth.has_active_role(uuid, text[], uuid)`;
- `app_auth.can_manage_access(uuid, uuid)`;
- `app_auth.is_target_user_self(uuid)`.

Também usam referências não qualificadas a tabelas.

#### Risco

O padrão é inferior ao adotado nas migrations posteriores (`pg_catalog, public`). A explorabilidade depende dos privilégios efetivos de criação/alteração no schema `public`, que ainda não foram comprovados no ambiente remoto.

#### Correção requerida

Criar migration forward-only de hardening para:

1. substituir as funções com `set search_path = pg_catalog, public`;
2. qualificar referências como `public.user_organizations`, `public.user_roles` e `public.roles`;
3. preservar assinaturas e comportamento;
4. testar acesso positivo, negativo, cross-tenant e por unidade.

### P2-SEC-02 — Execução não explicitamente revogada dos helpers da `0004`

A migration `0004` concede `EXECUTE` a `authenticated`, porém não contém `REVOKE ALL ... FROM PUBLIC` nem revogação explícita de `anon` para os helpers fundacionais.

#### Risco

Funções PostgreSQL recebem `EXECUTE` de `PUBLIC` por padrão, salvo revogação. Embora os helpers dependam de `auth.uid()` e tendam a retornar falso sem sessão válida, a superfície não segue o princípio de menor privilégio adotado nas migrations posteriores.

#### Correção requerida

Na mesma migration de hardening:

- revogar de `PUBLIC` e `anon`;
- conceder somente a `authenticated` para helpers que precisam ser chamados por policies/RPCs;
- validar que policies continuam operando após a revogação.

### P2-PRIV-01 — Policy legada permite leitura institucional de `risk_results` individualizado

A policy `risk_results_collective_or_owner`, criada em `0002`, autoriza papéis institucionais (`gestor_institucional`, `sst`, `admin_cliente`, `admin_biomed`, `auditor`) a selecionar linhas de `risk_results` da organização.

O modelo canônico atual determina que gestão institucional consuma apenas informação agregada, com limiar mínimo e sem canal individual indireto.

#### Risco

Se a policy ainda estiver ativa e a role possuir `SELECT`, usuários institucionais podem acessar resultado de risco individual, contrariando a separação entre domínio pessoal/clínico e gestão coletiva.

#### Correção requerida

Antes de D02-A:

1. confirmar a policy efetiva no remoto;
2. remover acesso institucional individualizado por migration forward-only;
3. preservar leitura pelo titular e por fluxo clínico explicitamente autorizado;
4. expor gestores somente a RPC agregada protegida, após o Gate D02;
5. incluir testes negativos para gestor, SST, auditor e admin cliente.

## 5. Observações P3

### P3-01 — Policies legadas baseadas em claims

A migration `0002` contém policies demonstrativas baseadas em `app.organization_id` e `app.role` no JWT. Parte delas foi substituída por regras persistidas posteriores, mas o inventário precisa demonstrar quais permanecem ativas ao final de `0018`.

### P3-02 — Catálogos globais legíveis por autenticados

`profiles`, `roles`, `permissions` e `role_permissions` possuem leitura por qualquer usuário autenticado. Isso pode ser aceitável para catálogos sem informação sensível, mas deve ser ratificado como decisão de produto.

### P3-03 — `audit_events` ainda não é trilha canônica integral

Há estrutura e policy de leitura, mas a persistência completa dos eventos relevantes ainda precisa ser confirmada. Logs de frontend não substituem auditoria de banco.

## 6. Matriz de superfícies

| Superfície | Estado estático | Próxima verificação |
|---|---|---|
| RLS de acesso/tenant | Forte, com legado a reconciliar | inventário remoto de policies |
| RLS clínica | Forte | executar testes SQL completos |
| Gestão coletiva | Forte para D01 | confirmar grants/policies remotos |
| `SECURITY DEFINER` moderno | Adequado | inventário de todas as funções |
| Helpers `0004` | P2 | migration de hardening |
| `risk_results` individual | P2 | remover acesso institucional |
| Grants de tabelas | Parcialmente explícitos | comparar ACL remota |
| `anon` | revogado nos módulos modernos | inventário remoto completo |
| Owners/BYPASSRLS | não comprovado | consulta operacional |
| Storage | não comprovado | inventário de buckets/policies |

## 7. Consultas requeridas no inventário remoto

O próximo diagnóstico operacional deve coletar, sem expor dados pessoais:

- `pg_roles`: `rolsuper`, `rolbypassrls`, `rolcreaterole`, `rolcreatedb`;
- `pg_class.relrowsecurity` e `relforcerowsecurity`;
- `pg_policy` completo;
- `information_schema.role_table_grants`;
- `information_schema.routine_privileges`;
- owners de tabelas, schemas e funções;
- `prosecdef` e `proconfig` de todas as funções;
- privilégios de `CREATE` e `USAGE` nos schemas;
- objetos e policies de `storage`.

## 8. Ordem de correção

1. versionar bootstrap local/HML e consultas de inventário;
2. confirmar estado remoto;
3. criar migration de hardening dos helpers `0004`;
4. remover acesso institucional individual a `risk_results`;
5. executar testes SQL positivos e negativos;
6. atualizar tipos e documentação;
7. somente depois reavaliar o Gate do D02-A.

## 9. Regra de segurança consolidada

Nenhuma nova superfície de dados clínicos, pessoais ou coletivos poderá ser liberada apenas porque uma tabela possui RLS. A autorização deve ser demonstrada conjuntamente por:

- identidade autenticada;
- vínculo ativo;
- papel e unidade aplicáveis;
- finalidade de uso;
- grants mínimos;
- policy/RPC coerente;
- proveniência e auditoria;
- teste negativo cross-tenant;
- comportamento `fail-closed`.

## 10. Conclusão

O banco possui uma base de segurança acima da média para o estágio do produto. Os achados não indicam vazamento comprovado, mas representam inconsistências reais de hardening e finalidade. Por isso, são classificados como P2 e devem ser resolvidos antes da futura camada de indicadores agregados e IA.