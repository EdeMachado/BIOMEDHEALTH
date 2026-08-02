# SUP-D02 — Especificação Técnica (Indicadores Agregados e Anti-Drilldown)

| Item | Valor |
|---|---|
| Ticket | `SUP-D02` |
| Título | Camada de indicadores agregados e políticas anti-drilldown |
| Status deste documento | **PLANEJAMENTO / ESPECIFICAÇÃO AUTORIZADOS** — aguardando aprovação formal para implementação controlada |
| Baseline de elaboração | `origin/main` = `89de7abb02262236d5633c82ebedd09424c65a49` (pós merge PR #26) |
| Dependência D01 | **Satisfeita** — ciclo SUP-D01-A/B/C/D em `main` (PRs #20–#24; docs #23/#26) |
| Implementação | **NÃO INICIADA** e **NÃO AUTORIZADA** por este documento |
| Documento mestre | `PROJECT_MASTER_HANDOFF.md` |
| Backlog | `SUPABASE_IMPLEMENTATION_BACKLOG.md` (SUP-D02) |
| SPEC relacionada | `SUP_D01_TECHNICAL_SPECIFICATION.md` (contratos de escopo + `SafeAggregateResult`) |
| Data | 2026-08-01 |

> **Natureza:** especificação técnica para implementação **futura** em fatias controladas.  
> **Esta SPEC não implementa o SUP-D02.** Não cria SQL, RPCs, repositories, UI nem testes.  
> Cada fatia de implementação exigirá **autorização mutável específica**.  
> Não autoriza SUP-D03, Fase E, correção da issue #25, nem reabertura do D01.

### Legenda

| Rótulo | Significado |
|---|---|
| **Fato confirmado** | Verificado no código / migrations / docs em `main` no baseline |
| **Decisão ratificada** | Já aprovada (architecture / handoff / SPEC D01) |
| **Contrato desta SPEC** | Norma proposta para implementação controlada (sujeita a aprovação formal) |
| **Proposta técnica** | Nome/estrutura ilustrativa; pode mudar na implementação |
| **Decisão pendente** | Requer aprovação humana antes ou durante a primeira fatia |
| **Fora do escopo** | Explicitamente excluído do D02 |

---

## 1. Identificação e status

### 1.1 Relação com outros tickets

| Ticket | Relação |
|---|---|
| **SUP-D01** | Pré-requisito concluído: escopo `organization`/`unit`, `all_units`/`selected_units`, RLS coletiva, RPCs atômicas, contrato tipado `SafeAggregateResult` |
| **SUP-D03** | Migração progressiva de UI/adapters de indicadores mock → real; **depende** de D02; **não** iniciado |
| **Fase E / SUP-E01** | Auditoria append-only persistente; D02 pode **preparar** eventos `indicator.*` / `export.*`, mas RPC append-only permanece E01 |
| **Issue #25** | P3 UI de campanhas/planos; **fora** do D02; permanece aberta |

### 1.2 Estado canônico

- Planejamento e especificação: **autorizados neste change set documental**.
- Implementação: **não iniciada** / **não autorizada**.
- Fase D do projeto: permanece **parcial** até D02 (e subsequentemente D03) serem entregues sob autorização.

---

## 2. Problema e objetivo

### 2.1 Necessidade (**decisão ratificada** + backlog)

A BioMed Gestão precisa de **leitura coletiva segura**: cartões, séries e tabelas agregadas por organização e, quando autorizado, por unidade — sem expor indivíduos.

### 2.2 Por que agregar

Dados-fonte (`assessments`, `user_journeys`, metadados de `campaigns`/`action_plans`, etc.) são nominais ou vinculáveis. Gestão institucional **não** é destinatária de prontuário nem de listas nominais (**decisão ratificada**).

### 2.3 Riscos a controlar

- Grupos pequenos (reidentificação).
- Combinação de filtros / inferência por diferença.
- Drill-down, exportação ou logs que revelem indivíduos.
- Bypass de limiar no cliente.
- Leitura raw de tabelas pessoais por papéis gerenciais.

### 2.4 Objetivo do D02

Entregar a **camada de agregação com limiar e anti-drilldown** (SQL/RPC + contratos repository + preparação de UI), de modo que:

1. toda resposta gerencial de indicador seja agregada ou `suppressed`;
2. o limiar mínimo de **10** indivíduos no recorte efetivo seja enforced no **servidor**;
3. nenhum ID/nome/campo clínico individual retorne na superfície D02;
4. filtros respeitem organização e unidades autorizadas (vocabulário D01).

---

## 3. Estado atual inventariado (**fato confirmado**)

### 3.1 Banco / migrations

| Artefato | Estado |
|---|---|
| `0017_collective_campaign_scope_integrity.sql` | Escopo, aplicabilidades, RLS `app_auth.can_select_*` / `can_write_*` |
| `0018_collective_atomic_mutations.sql` | Seis RPCs mutação coletiva; `SECURITY INVOKER` |
| Views/funções de agregação gerencial | **Ausentes** |
| Enforcement SQL de limiar / `suppressed` | **Ausente** |
| Próximo número de migration previsto | **`0019`** (previsão; não criar neste ato) |

Tabelas-fonte citadas no backlog para agregação futura: `assessments`, `user_journeys`, `campaigns`, `action_plans` (mais memberships/units). Sem catálogo fechado de métricas no código.

### 3.2 Domínio / repositories

| Artefato | Estado |
|---|---|
| `apps/web/src/domains/collective/types.ts` → `SafeAggregateResult` | Contrato tipado com `minGroup: 10` e `reason: 'BELOW_MIN_GROUP'`; **não calculado** em runtime |
| `CollectiveRepository` | Apenas campanhas/planos; **sem** métodos de indicador |
| Factory `VITE_COLLECTIVE_REPOSITORY_MODE` | Fail-closed; sem fallback Supabase→mock |
| `assertAudienceCriteriaEmpty` / RPC audience | `criteria` populacionais **recusados** (reservados a evolução; não são D02 UI demo) |

### 3.3 UI Gestão

| Página | Fonte | Estado |
|---|---|---|
| `ManagementOverviewPage` | `demoData.collectiveIndicators`, `riskDistribution`, `trendByMonth`, `programDistribution` | **Demo**; filtros cosméticos |
| `ManagementIndicatorsPage` | HTML hardcoded | **Demo** |
| Campanhas / planos | Repository coletivo + RPCs 0018 | **Real** (D01) |
| `ManagementAuditPage` | `sessionStorage` (`biomed_demo_audit_events`) | **Demo** |

Rotas: `apps/web/src/app/routes/router.tsx` (`/gestao`, `/gestao/indicadores`, …).

### 3.4 Auth / tenant

| Tema | Estado |
|---|---|
| Papéis (`access.ts`) | `gestor_institucional`, `sst`, `admin_cliente`, `admin_biomed`, `auditor`, clínicos, `usuario` |
| `user_roles.unit_id` | Org-wide (`null`) vs unit-scoped |
| `selectedUnitId` de sessão | **Sempre `null`** em `AuthContext` e contexto coletivo da UI |
| Membership ativa | Pré-requisito D01; reutilizar no D02 |

### 3.5 Auditoria

| Camada | Estado |
|---|---|
| Tabela `audit_events` | Existe (0001); SELECT restrito; **sem** INSERT app via RPC |
| SUP-E01 | Não iniciado — escrita append-only futura |
| App | Demo local |

### 3.6 Testes relevantes existentes

- SQL D01-B/D01-D (escopo/RLS/RPCs) — regressão obrigatória do D01.
- Vitest collective repository / `managementCollective` — campanhas/planos, **não** indicadores.
- Sem suíte de limiar/`suppressed`/anti-diferencial.

### 3.7 Lacunas que impedem implementação imediata

1. Sem autorização mutável de implementação (esta SPEC ainda requer aprovação formal).
2. Sem camada SQL/RPC de agregação.
3. Sem repository de indicadores.
4. UI overview/indicadores demo.
5. `selectedUnitId` não ativado (ambiguidade unit-scoped).
6. Sem bloqueio sistemático de SELECT raw nominal para papéis gerenciais nas tabelas-fonte.
7. Catálogo de indicadores de produto **não** ratificado (só fixtures demo).
8. Anti-diferencial / exportação sem desenho implementado.
9. Auditoria persistente de leitura agregada depende de E01 ou fatia mínima acordada.

---

## 4. Escopo funcional

### 4.1 Incluído (**contrato desta SPEC** + backlog)

- Funções/RPCs (ou views + RPC) de **agregação gerencial** por período e escopo autorizado.
- Limiar mínimo **10** no recorte efetivo (**decisão ratificada**).
- Resposta tipada alinhada a `SafeAggregateResult` (extensível com `empty` — ver §8).
- Filtros apenas sobre dimensões agregáveis permitidas.
- Isolamento por `organization_id` e unidades autorizadas (vocabulário D01: `scope_type`, `all_units`, `selected_units`, `unit`).
- Preparação de contrato repository + tipos; conexão parcial de UI **somente** sob fatia autorizada (migração completa de painéis = **SUP-D03**).
- Testes de limiar, isolamento, anti-nominal e regressão D01.

### 4.2 Indicadores

| Classe | Tratamento |
|---|---|
| Fixtures demo (`collectiveIndicators`, risco, tendência, programas) | **Não** são catálogo aprovado — apenas referência UX |
| Contagens estruturais de campanhas/planos (metadados sem pessoas) | Podem ser fatia inicial **sem** limiar de pessoas, se não derivarem de indivíduos |
| Indicadores derivados de pessoas (`assessments`, jornadas, adesão) | Exigem limiar; catálogo concreto = **decisão pendente** de produto |

**Contrato desta SPEC:** a infraestrutura D02 deve ser **agnóstica a um catálogo fechado**: cada indicador registrado declara fonte, numerador/denominador, dimensões permitidas e se aplica limiar de pessoas.

### 4.3 Dimensões e filtros permitidos (**proposta técnica**)

| Dimensão | Regra |
|---|---|
| Organização | Sempre a do contexto autenticado; **proibido** aceitar `organization_id` estrangeiro do cliente como autoridade |
| Unidade | Subconjunto das units autorizadas ao ator; unit-scoped não amplia para outras units |
| Período | Intervalo explícito (ver §10); granularidade mínima a definir (pendente) |
| Programa / jornada | Somente se houver vínculo agregável não nominal e dimensão aprovada |
| Escopo coletivo D01 | Consultas sobre campanhas/planos respeitam `can_select_*` |

### 4.4 Estados de resultado

| Estado | Significado |
|---|---|
| `ok` | Agregado liberado; `n ≥ minGroup` quando limiar de pessoas se aplica |
| `empty` | Recorte autorizado sem observações (n=0) — **não** confundir com `suppressed` |
| `suppressed` | Amostra insuficiente (`BELOW_MIN_GROUP`) ou política anti-diferencial |
| Erro tipado | Auth, input inválido, técnico — sem vazar existência cross-tenant |

### 4.5 Múltiplas units / sem units

- Múltiplas units: agregado do **universo autorizado ∩ solicitado**; limiar no recorte **efetivo final**.
- Sem units autorizadas e consulta unitária: **deny** (não retornar agregado org implícito).
- Ambiguidade de contexto unitário com `selectedUnitId` null: **deny-by-default** para consultas unit-scoped até seletor/access ticket (**decisão pendente** / gap conhecido).

### 4.6 Exportação e drill-down

| Tema | Classificação |
|---|---|
| Drill-down nominal | **Proibido** (**decisão ratificada**) |
| Exportação de agregados | Mesmos controles de limiar/anti-diferencial; auditar — **D02** se autorizado na fatia; senão follow-up |
| Detalhamento “por unidade” | Só se cada célula respeitar limiar isoladamente |

### 4.7 Fora do escopo

Ver §18.

---

## 5. Modelo de autorização

Papéis reais: `apps/web/src/shared/types/access.ts`.

| Papel | Solicitar indicadores agregados | Org | Units | Dimensões | Bloqueios | Nominal |
|---|---|---|---|---|---|---|
| `gestor_institucional` | Sim (leitura) | Própria | Todas da org (se org-wide) | Permitidas | Cross-org; below limiar | **Não** |
| `admin_cliente` | Sim | Própria | Org-wide | Permitidas | Idem | **Não** |
| `admin_biomed` | Sim (plataforma/org contexto) | Contexto ativo | Conforme vínculo | Permitidas | Idem | **Não** |
| `sst` | Sim | Própria | Se unit-scoped: **só** sua unit (+ campanhas org aplicáveis como metadado, não como lista nominal) | Permitidas no universo | Outras units; below limiar | **Não** |
| `auditor` | Sim (leitura) | Própria | Conforme vínculo | Permitidas | Escrita; nominal | **Não** |
| `gestor_clinico` / `medico` / `profissional_saude` | **Não** (painel gerencial D02) | — | — | — | Acesso gestão indicadores | **Não** via D02 |
| `usuario` | **Não** | — | — | — | — | Próprio histórico = outro domínio |

**Regra esperada (**decisão ratificada**):** ausência total de acesso nominal no D02.  
**Conflito humano se encontrado:** qualquer policy futura que permita SELECT raw de PHI a papel gerencial via superfície D02.

Frontend **não** é fronteira de segurança; RLS + RPC INVOKER + membership.

---

## 6. Limiar de privacidade

### 6.1 Valor numérico

| Tema | Status |
|---|---|
| `minGroup = 10` | **Decisão ratificada** (architecture planning; SPEC D01; `SafeAggregateResult`; backlog D02) |
| Configurável por organização | **Não** ratificado — default fixo **10**; alteração = **decisão pendente** (não implementar admin de limiar no D02-MVP) |

### 6.2 Medida e momento (**contrato desta SPEC**)

- Medida: **contagem de indivíduos distintos** no recorte efetivo após **todos** os filtros (não “linhas de evento” se um indivíduo gera N eventos — salvo indicador explicitamente de eventos **e** ainda assim sem IDs).
- Momento: **no servidor**, após montar o universo e **antes** de devolver valor ao cliente.
- Cliente **não** pode reduzir/ignorar limiar; parâmetros de `minGroup` no payload devem ser **ignorados** ou rejeitados.

### 6.3 Tratamentos

| Caso | Resposta |
|---|---|
| `n = 0` | `empty` (sem fingir suppressed) |
| `0 < n < 10` | `suppressed` + `reason: 'BELOW_MIN_GROUP'` + `minGroup: 10`; **sem** valor bruto |
| `n ≥ 10` | `ok` + `value` + `n` (se `n` em si não violar política — ver §7) |
| Denominador pequeno em taxa | Suprimir taxa se numerador **ou** denominador &lt; 10 (proposta; confirmar por indicador) |
| Percentuais / médias / séries | Cada ponto/célula com limiar próprio; série não “completa” buracos com zeros ambíguos de suppressed |

### 6.4 Proibições

- Retornar valor bruto junto com `suppressed`.
- Logar `n` exato &lt; 10, listas de IDs ou payloads nominais.
- Mensagens de erro que confirmem existência cross-tenant.

---

## 7. Prevenção de reidentificação

| Ataque / risco | Tratamento D02 | Classificação |
|---|---|---|
| Combinação excessiva de filtros | Limitar dimensões simultâneas; rejeitar combos não aprovados | **Obrigatório** (política de dimensões) |
| Consultas repetidas com pequenas diferenças | Auditoria de acesso; rate limit opcional | Auditoria **obrigatória** (evento); rate limit = **follow-up** se abuso observado |
| Total org − subconjunto | Não expor pares que permitam diferença trivial para n&lt;10; ou suprimir ambos | **Obrigatório** na fatia de anti-diferencial |
| Períodos estreitos / units pequenas | Limiar no recorte final | **Obrigatório** |
| Categorias raras | Suprimir células | **Obrigatório** |
| Inferência por diferença | Testes de aceite D02; evitar APIs que devolvam “complemento” | **Obrigatório** (testes) |
| Paginação / drill-down individual | Proibido | **Obrigatório** |
| Cache | Cache só de respostas já suppressed-safe; chave sem PII; TTL curto | **Obrigatório** se houver cache |
| Exportação | Mesmo limiar; auditar | Fatia opcional / follow-up |
| Logs | Sem valores suppressed brutos; sem IDs | **Obrigatório** |

---

## 8. Contrato de dados (**proposta técnica** — não vinculante como API final)

### 8.1 Entrada conceitual

```ts
/** Proposta — nomes sujeitos a confirmação na implementação */
type AggregateQuery = {
  /** organizationId NÃO é autoridade: inferido do contexto autenticado */
  indicatorId: string;
  period: { start: string; end: string }; // ISO date; timezone §10
  unitIds?: string[]; // subconjunto autorizado; omitido = universo permitido ao ator
  filters?: Record<string, string | number | boolean>; // apenas chaves allowlisted
};
```

### 8.2 Saída conceitual (extensão do D01)

```ts
/** Alinhado a SafeAggregateResult; `empty` é extensão proposta do D02 */
type AggregateResponse =
  | { status: 'ok'; indicatorId: string; value: number; n: number; scope: CollectiveScope }
  | { status: 'empty'; indicatorId: string; n: 0; scope: CollectiveScope }
  | {
      status: 'suppressed';
      indicatorId: string;
      reason: 'BELOW_MIN_GROUP' | 'ANTI_DIFFERENTIAL';
      minGroup: 10;
      scope: CollectiveScope;
    };
```

Garantias:

- Sem `user_id`, nomes, documentos, IDs de paciente/avaliação individual.
- `organization_id` efetivo só o do contexto.
- Erros tipados estáveis (`AUTHORIZATION_DENIED`, `INVALID_INPUT`, `NOT_FOUND` de indicador, `TECHNICAL_ERROR`).

### 8.3 Exemplos mínimos (não vinculantes)

- Pedido com `n=9` → `{ status: 'suppressed', reason: 'BELOW_MIN_GROUP', minGroup: 10, … }` sem `value`.
- Pedido com `n=0` → `{ status: 'empty', n: 0, … }`.
- Pedido com `n=12`, value=7 → `{ status: 'ok', value: 7, n: 12, … }`.

---

## 9. Arquitetura de segurança

| Camada | Responsabilidade futura |
|---|---|
| Auth / JWT | Identidade; sem papéis “trust client” |
| Membership | Ativa na org do contexto |
| RPC SQL | Preferência **`SECURITY INVOKER`** (padrão D01-D); agregação sob RLS do caller |
| `SECURITY DEFINER` | **Não** autorizar sem análise explícita de risco, `search_path`, ownership e grants mínimos |
| RLS | Continua autoridade final; avaliar deny de SELECT raw em tabelas nominais para papéis só-gestão **ou** encapsular 100% via RPC sem GRANT de tabela |
| Repository | Traduz erros; sem fallback mock; sem post-process que “invente” agregado |
| UI | Exibe `ok` / `empty` / `suppressed`; nunca interpreta ausência de campo como zero real ambíguo |
| Auditoria | Eventos de consulta/supressão/deny (persistência plena = E01) |

Proteção contra acesso direto: app user não deve obter linhas nominais por PostgREST em tabelas-fonte usadas na agregação, se o papel for apenas gerencial.

---

## 10. Consistência estatística e temporal

| Tema | Diretriz / pendência |
|---|---|
| Numerador / denominador | Declarados por indicador no registro de catálogo |
| Deduplicação | Por `user_id` (ou chave de pessoa) no recorte, salvo indicador de eventos |
| Timezone | **Decisão pendente** — propor `America/Sao_Paulo` ou UTC documentado |
| Intervalos | Propor `[start, end)` ou inclusivo fechado — **pendente**; deve ser único em toda a API |
| Cancelados / inativos | Excluir memberships inativas e registros status não elegíveis — regras por fonte **pendentes** |
| Unit histórica | Contar pela unit do fato no período vs unit atual — **pendente** |
| Cartões vs gráficos vs export | Mesma RPC/função canônica |
| Arredondamento | Percentuais: política única (ex. 1 casa) — **pendente** |
| Dados atrasados | Documentar lag; sem preencher suppressed com estimativas |

---

## 11. Desempenho (**conceitual**)

| Tema | Avaliação |
|---|---|
| Volume | Multi-tenant; começar sob demanda |
| Pré-agregação / matviews | Somente se medição exigir; risco de cache staleness/vazamento |
| Índices | Prever apoio a `(organization_id, created_at)` etc. **após** EXPLAIN — não criar agora |
| Paginação | Irrelevante para escalares; séries com bound de pontos |
| Cache | Opcional, só respostas safe; invalidação por período/org |
| Medição | EXPLAIN nas RPCs na fatia SQL |

Não escolher solução definitiva sem evidência.

---

## 12. Observabilidade e auditoria

Eventos mínimos (**proposta**; persistência E01):

| Campo | Incluir |
|---|---|
| actor_user_id, organization_id | Sim |
| indicatorId, period, unitIds (hashes ou counts, não PII) | Sim |
| resultado (`ok`/`empty`/`suppressed`/`denied`) | Sim |
| reason seguro | Sim (código, não n exato se &lt;10) |
| timestamp, request correlation | Sim |
| value / lista de IDs | **Não** |

---

## 13. Estratégia de implementação futura

Nenhuma fatia está iniciada ou autorizada.

| Fatia | Objetivo | Arquivos previstos (proposta) | Migration | Aceite resumido | Auditoria pré-merge |
|---|---|---|---|---|---|
| **D02-A** | Catálogo mínimo + RPC/função INVOKER de 1–N indicadores piloto + limiar | `supabase/migrations/0019_…`, policies validation, rollback | Prevista `0019` | n&lt;10 suppressed; cross-org deny; sem IDs | **Sim** |
| **D02-B** | Repository + tipos (`AggregateResponse`) + factory/flag | `domains/collective` ou `domains/indicators`, `repositories/…` | — | Fail-closed; sem fallback mock | **Sim** |
| **D02-C** | Ligação controlada overview **ou** indicadores (1 tela) consumindo repository | `ManagementPages.tsx` (trecho), testes integração | — | UI distingue ok/empty/suppressed; demo removido só na tela autorizada | **Sim** |
| **D02-D** | Anti-diferencial + testes de abuso + docs | SQL/tests/docs | Possível ajuste `0019`/`0020` | Aceite anti-diff; regressão D01 | **Sim** |

Rollback: SQL simétrico + flag off. Riscos: vazamento por GRANT excessivo; UI que mostre zero no lugar de suppressed.

**SUP-D03** permanece responsável pela migração ampla mock→real de todos os painéis.

---

## 14. Estratégia de testes (planejada — não executar agora)

- Migration/RPC: limiar 9/10/11; empty; filtros; INVOKER grants.
- Isolamento org e unit-scoped.
- Papéis negados (clínico, usuario).
- Adulteração de `organization_id` / `unit_ids` no payload.
- Ausência de colunas nominais no JSON.
- Combos de filtros / diferença.
- Concorrência de leitura (sem corrupção; sem vazamento).
- Repository + mock parity.
- UI: suppressed ≠ “0”; sem toast de sucesso enganoso.
- Regressão SUP-D01 (campanhas/planos/RPCs 0018).
- Rollback da migration D02.

---

## 15. Migration e rollback futuros

| Tema | Previsão |
|---|---|
| Número | `0019_…` (próximo após `0018`) |
| Objetos possíveis | Funções/RPCs agregação; possivelmente view; grants; **sem** destruir D01 |
| Compatibilidade | Extensão; UI demo permanece até fatia C |
| Rollback | `supabase/rollbacks/0019_…` espelhando drops |
| Deploy parcial | Flag app off → demo; SQL pode existir sem exposição |
| Dependência app | Repository só após RPC estável |

**Nenhum arquivo SQL neste ato.**

---

## 16. Critérios de aceite globais do SUP-D02

1. Nenhuma resposta D02 contém identificador pessoal/clínico.
2. Limiar 10 enforced no servidor; cliente não contorna.
3. `suppressed` sem valor bruto; `empty` distinto.
4. Isolamento cross-org e unit-scoped verificados.
5. RLS/RPC INVOKER sem bypass DEFINER não analisado.
6. Papéis clínicos/usuario sem painel de indicadores D02.
7. Anti-diferencial coberto por testes acordados na fatia D.
8. Sem fallback Supabase→mock.
9. Regressão D01 verde.
10. Rollback SQL documentado e testado em Postgres descartável.
11. Documentação (handoff/backlog/SPEC) alinhada ao merge.
12. Auditoria independente por fatia antes do merge.
13. Exportação (se existir) sob o mesmo limiar.
14. UI autorizada não apresenta demo como dado real na mesma superfície.
15. Fase D **não** marcada concluída até D02 (+ governança D03) conforme handoff.

---

## 17. Decisões e pendências

| Tema | Evidência | Decisão proposta | Alternativa | Impacto | Status | Aprovação humana | Bloqueia impl.? |
|---|---|---|---|---|---|---|---|
| Limiar = 10 | Architecture, D01, types | Manter fixo | Config por org | Alto | **Resolvido (ratificado)** | Não | Não |
| Catálogo de indicadores | Só demoData | Infra agnóstica + piloto mínimo na D02-A | Catálogo completo antes | Alto | **Pendente** | Sim (produto) | Bloqueia escopo da D02-A concreta |
| `empty` vs `suppressed` | Lacuna no tipo D01 | Estender contrato com `empty` | Só ok/suppressed | Médio | **Proposta SPEC** | Sim (aceite formal SPEC) | Não se D02-A adotar |
| Timezone / intervalo | Ausente | Documentar UTC ou America/Sao_Paulo + `[start,end)` | Outro | Médio | **Pendente** | Sim | Bloqueia consistência |
| `selectedUnitId` | Sempre null | Deny unit-ambíguo; ticket access paralelo | Ativar seletor no D02 | Alto | **Pendente (paralelo)** | Sim | Bloqueia consultas unit-scoped UX |
| Deny SELECT raw gestão | Policies atuais | Encapsular via RPC e/ou revoke selects | Só confiança UI | Crítico | **Pendente de desenho D02-A** | Sim (segurança) | Sim |
| Exportação | Backlog D02 | Adiar à fatia explícita | Incluir D02-A | Médio | **Pendente** | Sim | Não (MVP sem export) |
| Rate limit | — | Follow-up | Incluir MVP | Baixo | Follow-up | Não | Não |
| Matviews | — | Sob demanda primeiro | Pré-agregar | Médio | Resolvido como default sob demanda | Não | Não |
| SECURITY DEFINER | Padrão D01 INVOKER | Evitar | DEFINER excepcional | Alto | **Resolvido na SPEC: preferir INVOKER** | Se excepcionar | Não |

---

## 18. Fora do escopo

- Prontuário / ficha clínica / evoluções nominais.
- Acesso nominal a qualquer título no painel gestão.
- Implementação neste PR documental.
- SUP-D03 (migração ampla mock→real).
- Fase E / SUP-E01 (salvo preparação de nomes de evento).
- Issue #25 (P3 campanhas/planos).
- Alterações de AuthContext/guards/rotas não indispensáveis (seletor de unit = ticket próprio).
- Analytics preditiva; BI externo.
- Reabertura ou alteração retrospectiva da SPEC D01 (P3 editorial §12 permanece follow-up separado).
- `program_participations` nominais.
- Vocabulário incompatível (`all_active_units`, `organization_only`) — **não** adotar.

---

## 19. Autorização de trabalho

| Etapa | Estado |
|---|---|
| Inventário técnico | Concluído neste change set |
| Planejamento / SPEC D02 | **Autorizado e produzido** (`SUP_D02_TECHNICAL_SPECIFICATION.md`) |
| Aprovação formal da SPEC para implementação | **Pendente** |
| D02-A…D (código/SQL) | **Não iniciados / não autorizados** |
| SUP-D03 / Fase E / #25 | Fora |

> **Próximo ato após merge documental e revisão:** aprovação formal desta SPEC (ou revisão) e, só então, ordem mutável da fatia **D02-A**.
