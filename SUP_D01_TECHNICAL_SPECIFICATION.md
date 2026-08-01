# SUP-D01 — Especificação Técnica (Gestão Coletiva / Escopo Institucional)

| Item | Valor |
|---|---|
| Ticket | `SUP-D01` |
| Título | Schema de gestão coletiva com recorte por unidade/programa |
| Status deste documento | **APROVADA PARA IMPLEMENTAÇÃO CONTROLADA** |
| Baseline da revisão de aprovação | `origin/main` = `9930c61c87ad40689704ff5f127b3255609a4560` |
| Incorporação documental | PR #18 (merge `9930c61…`) |
| Ratificação arquitetural | PR #17 — fronteira org×unit no domínio institucional/coletivo |
| Data da aprovação formal | 2026-08-01 |
| Documento mestre | `PROJECT_MASTER_HANDOFF.md` (§6.1) |
| Backlog | `SUPABASE_IMPLEMENTATION_BACKLOG.md` (SUP-D01) |

> **Natureza:** especificação **aprovada para implementação controlada**. A fronteira arquitetural foi **ratificada** no PR #17; a SPEC foi incorporada pelo PR #18 e formalmente aprovada nesta revisão.
> **Esta aprovação não implementa o SUP-D01.** Não autoriza automaticamente D01-A, D01-B nem qualquer bloco subsequente.
> Cada bloco de implementação exige **autorização mutável específica**. Não autoriza SUP-D02, SUP-C01, SUP-B04 nem reabertura de C04.2b.
> Não autoriza conectar a UI demonstrativa de gestão (`ManagementPages`) ao backend real.
> Onde houver divergência com o banco atual, prevalece o contrato desta SPEC **somente após** a autorização explícita do bloco correspondente.

### Legenda de classificação das afirmações

| Rótulo | Significado |
|---|---|
| **Decisão ratificada (PR #17)** | Fronteira arquitetural já integrada em `main` |
| **Contrato desta SPEC** | Norma aprovada para implementação controlada (blocos sob autorização específica) |
| **Proposta técnica** | Nome/estrutura ilustrativa; pode mudar na implementação |
| **Estado atual documentado** | Verificado no repositório / docs no baseline de aprovação |
| **Implementação futura** | Trabalho após autorização de bloco; não entregue |
| **Dependência / gap** | Outro ticket ou lacuna conhecida |

---

## 1. Propósito do BIOMED HEALTH

**Decisão ratificada (PR #17):** o BIOMED HEALTH é um **ecossistema modular de saúde**, não um produto exclusivamente de gestão coletiva.

| Módulo | Finalidade |
|---|---|
| **Minha BioMed** | Experiência e jornada individual |
| **BioMed Clínica** | Cuidado e acompanhamento assistencial |
| **BioMed Gestão** | Saúde coletiva e programas institucionais |
| **BioMed Ocupacional** | Saúde corporativa e ocupacional (evolução) |
| **BioMed Intelligence** | Análises e apoio à decisão (evolução) |

O **SUP-D01** funda a persistência segura da **gestão coletiva** e prepara parte da inteligência populacional. **Não** representa a totalidade funcional ou estratégica do produto.

---

## 2. Objetivo e fronteira do SUP-D01

### 2.1 Finalidade

Estruturar a base de dados e os contratos de domínio para:

- campanhas institucionais;
- públicos-alvo (audiências) coletivas **herdadas** da campanha;
- planos de ação coletivos;
- escopo explícito `organization` \| `unit`;
- aplicabilidade operacional de campanhas organizacionais (`all_units` \| `selected_units`);
- preparação estrutural para indicadores agregados (**SUP-D02**), sem drill-down nominal.

### 2.2 Módulos beneficiados

- **BioMed Gestão** (primário);
- **BioMed Intelligence** (consumo futuro de agregados — **implementação futura** / D02);
- **BioMed Ocupacional** (programas institucionais correlatos, sem absorver o prontuário pessoal).

### 2.3 Incluído no núcleo do SUP-D01

- evolução conceitual de `campaigns`, `campaign_audiences`, `action_plans`;
- contrato normativo de escopo (`scope_type`: **somente** `organization` \| `unit`);
- aplicabilidade organizacional (`unit_applicability`) e associação explícita campanha–unidade quando necessário;
- invariantes de `organization_id` / `unit_id` / null no domínio coletivo;
- contratos futuros de repository/serviço, RLS, auditoria e testes (**implementação futura**);
- preparação do contrato de resultado agregado/`suppressed` para o limiar (enforcement pleno no **SUP-D02**).

### 2.4 Fora do escopo / evoluções futuras

- envio real de notificações;
- integração externa de BI;
- views finais de indicadores, limiar completo, anti-diferencial e proteção contra reidentificação (**SUP-D02**);
- repositórios/UI dual-mode de gestão (**SUP-D03**);
- implementação do gap `unit_id` em agenda clínica (**SUP-C01** residual — **paralelo**, não pré-requisito);
- rollout preventivo (**SUP-B04**);
- switch mock clínico (**SUP-C04.2b** — encerrada);
- redesign do módulo access (além de consumir vínculos existentes);
- `program_participations` / engajamento nominal usuário↔programa (**evolução futura**; ver §11);
- grupos populacionais avançados e bases legais adicionais além do apontamento a consentimento B01;
- tornarem dados pessoais/clínicos propriedade da organização;
- qualquer fluxo excepcional de acesso nominal por papéis de gestão (**não** antecipado nesta SPEC).

### 2.5 Separação de domínios

| Domínio | Titularidade típica | Exige `organization_id`? | Papel do SUP-D01 |
|---|---|---|---|
| Individual / Minha BioMed | usuário (`user_id`) | **Não** como regra universal (**decisão ratificada**) | Fora do núcleo |
| Clínico / assistencial | paciente + profissional + finalidade | só quando institucionalmente contextualizado; **não** implica propriedade do prontuário pela org | Fora; origem de programa gera *vínculo*, não absorção |
| Ocupacional | vínculo emprego/programa | sim quando institucional | Fronteira futura |
| Coletivo / Gestão | organização (e unit quando aplicável) | **Sim** | **Núcleo do D01** |

Quando um atendimento individual se originar de programa institucional, distinguir sempre:

1. dado clínico/pessoal do paciente;
2. vínculo contratual/assistencial;
3. organização patrocinadora;
4. unidade de origem (se aplicável);
5. dados coletivos derivados;
6. permissões de cada agente.

**Decisão ratificada:** a organização **não** se torna proprietária do prontuário pessoal apenas por financiar, solicitar ou sediar o atendimento.

### 2.6 Relação com outros tickets

| Ticket | Relação |
|---|---|
| SUP-C01 (`unit_id` agenda) | Dívida **paralela**; **não** bloqueia D01; D01 **não** pressupõe execução prévia do C01 |
| SUP-B04 | Independente; não iniciar aqui |
| SUP-C04.2b | Encerrada; não reabrir |
| SUP-D02 | Enforcement de agregações/limiar/anti-diferencial |
| SUP-D03 | Repos/UI dual-mode gestão |
| Access | Consome `user_organizations` / `user_roles.unit_id`; D01 não redesenha access |

---

## 3. Casos de uso

| ID | Caso | Escopo / aplicabilidade | Notas |
|---|---|---|---|
| UC-01 | Campanha para toda a organização | `scope_type=organization`, `unit_applicability=all_units` | Visível a usuários unit-scoped da mesma org (todas as units válidas, inclusive futuras — §5) |
| UC-02 | Campanha organizacional para lista explícita de units | `scope_type=organization`, `unit_applicability=selected_units` + associações | Lista explícita, não vazia; unit ∈ org |
| UC-03 | Campanha para uma unidade | `scope_type=unit` + `unit_id` | Sem `unit_applicability`; sem associações extras |
| UC-04 | Público-alvo / audiência | Herda campanha | Sem escopo próprio |
| UC-05 | Ação / plano coletivo | Mesmos invariantes de escopo da entidade coletiva | Agregado; execução individual é outro domínio |
| UC-06 | Preparação para indicador organizacional | Contexto org | Limiar pleno no **D02** |
| UC-07 | Preparação para indicador por unidade | Filtro unit | Limiar pleno no **D02** |
| UC-08 | Gestor organizacional | Papéis org-wide | CRUD coletivo conforme matriz |
| UC-09 | Gestor / usuário unit-scoped | `user_roles.unit_id` set | Regras §6.2 |
| UC-10 | Profissional de saúde | Clínico | Sem painel gerencial nominal via D01 |
| UC-11 | Usuário individual | Minha BioMed | Fora do núcleo D01; sem ceder titularidade do histórico |
| UC-12 | Desligamento / transferência | Membership/role | Histórico pessoal preservado; perde acesso coletivo |
| UC-13 | Usuário sem organização | B2C / pessoal | Funcionalidades independentes **sem** exigir org (**decisão ratificada**) |

---

## 4. Modelo conceitual de dados

> **Proposto / contrato desta SPEC.** Schema atual (`0001`, **estado atual documentado**) tem `campaigns` / `campaign_audiences` / `action_plans` apenas com `organization_id` (sem `scope_type` / `unit_id` / aplicabilidade).

### 4.1 Núcleo

| Entidade (conceitual) | Finalidade | Titularidade | organization_id | unit_id | Aplicabilidade | Dados pessoais/clínicos | Auditoria |
|---|---|---|---|---|---|---|---|
| `Campaign` (evolução de `campaigns`) | Campanha coletiva | organização | **obrigatório** | null se organization; NOT NULL se unit | ver §5 | **não** | create/update/scope/applicability/close |
| `CampaignUnitApplicability` (**proposta técnica** de nome; tabela nova) | Associação campanha↔unit para `selected_units` | organização | via campanha | obrigatório por linha | só selected_units | não | associate/remove |
| `CampaignAudience` (evolução de `campaign_audiences`) | Critérios de público-alvo | organização | herdado | **sem coluna própria** | herdada | **sem identificadores nominais** | change audience |
| `ActionPlan` (evolução de `action_plans`) | Plano de ação coletivo | organização | **obrigatório** | conforme `scope_type` (mesmos invariantes) | se organization: `all_units` \| `selected_units` (análogo) | não | create/update/close |

### 4.2 Campos normativos de `Campaign`

| Campo | Regra (**contrato desta SPEC**) |
|---|---|
| `organization_id` | Obrigatório |
| `scope_type` | Somente `organization` \| `unit` — **não** existe `multi_unit` |
| `unit_id` | `null` **somente** se `scope_type = organization`; preenchido e ∈ org se `scope_type = unit` |
| `unit_applicability` | Somente se `scope_type = organization`: `all_units` \| `selected_units`. **Não aplicável** se `scope_type = unit` |

### 4.3 `CampaignUnitApplicability`

Utilizada **somente** quando `scope_type = organization` **e** `unit_applicability = selected_units`.

Requisitos conceituais para futura implementação:

- `campaign_id`, `unit_id`;
- unicidade `(campaign_id, unit_id)`;
- cada `unit_id` deve satisfazer `organization_units.organization_id = Campaign.organization_id` (e status válido conforme regra);
- lista não vazia obrigatória para `selected_units`;
- ausência de linhas **não** interpreta como `all_units` — é erro / deny-by-default;
- em `all_units` ou `scope_type = unit`: **não** deve haver associações;
- alterações auditáveis.

### 4.4 `CampaignAudience`

- Pertence a uma campanha;
- **herda** organização, `scope_type`, `unit_id` e `unit_applicability` da campanha;
- **não** possui `organization_id` / `unit_id` / `scope_type` / `unit_applicability` próprios;
- **não** há override;
- filtros adicionais (labels/critérios) operam **somente** dentro do universo autorizado da campanha;
- nenhum filtro pode **ampliar** o universo.

### 4.5 Invariantes de titularidade

- Desligamento remove/encerra vínculo institucional; **não** apaga histórico pessoal do usuário.
- Agregados derivados podem existir sem expor o dado-fonte individual à gestão.
- Participação nominal usuário↔programa **não** integra o núcleo D01 (§11).

### 4.6 Estado atual versus futuro

| Aspecto | Estado atual documentado | Lacuna | Contrato desta SPEC | Implementação futura |
|---|---|---|---|---|
| `campaigns.organization_id` | NOT NULL | — | mantém | — |
| `scope_type` | ausente | sim | `organization` \| `unit` | migration + CHECK |
| `unit_id` em campanhas/planos | ausente | sim | nullable + coerência com scope | migration + CHECK |
| `unit_applicability` | ausente | sim | all_units \| selected_units (só org) | migration + CHECK |
| associação selected_units | ausente | sim | `CampaignUnitApplicability` | tabela nova |
| audiência com unit próprio | N/A no modelo alvo | — | **proibido** | constraints |
| RLS gestão | JWT org legado (`0002`) | sem membership/unit | membership + escopo/aplicabilidade | policies futuras |
| Limiar ≥10 | regra ratificada | sem views | contrato `suppressed` | **SUP-D02** |

---

## 5. Contrato de escopo e aplicabilidade

### 5.1 Escopo de autorização (`scope_type`) — **contrato desta SPEC**

```text
scope_type ∈ { 'organization', 'unit' }
```

| `scope_type` | `unit_id` | `unit_applicability` | Associações `CampaignUnitApplicability` |
|---|---|---|---|
| `organization` | **MUST be null** | **MUST** ser `all_units` ou `selected_units` | vazias se `all_units`; ≥1 se `selected_units` |
| `unit` | **MUST be NOT NULL** e ∈ org | **MUST NOT** ser usado (N/A) | **MUST** estar vazias |

**Não existe** valor `multi_unit` (nem equivalente renomeado).

### 5.2 Semântica de `unit_id = null` — **decisão ratificada + contrato desta SPEC**

No domínio institucional/coletivo:

1. `organization_id` é sempre obrigatório.
2. `scope_type = organization` exige `unit_id = null`.
3. `scope_type = unit` exige `unit_id` preenchido.
4. `unit_id = null` significa **exclusivamente** escopo organizacional **explícito**.
5. `null` **não** pode ser usado para inferir multiunidade, lista implícita ou “todas as units selecionadas”.
6. `null` acidental / contexto ausente / falha de seleção **não** amplia autorização (deny-by-default).
7. Se `unit_id` presente → unidade pertence a `organization_id` (status válido conforme regra).

### 5.3 Aplicabilidade operacional (somente campanhas/planos organizacionais)

Separe formalmente:

- **Escopo de autorização** (`scope_type` + `unit_id`);
- **Aplicabilidade operacional** (`unit_applicability`) — só quando `scope_type = organization`.

| `unit_applicability` | Significado normativo |
|---|---|
| `all_units` | Alcança **todas as unidades válidas** da mesma organização, **incluindo** units válidas criadas **posteriormente**; nunca units de outra org; **sem** linhas em `CampaignUnitApplicability` |
| `selected_units` | Alcança **exclusivamente** units explicitamente associadas; lista **não vazia**; cada unit ∈ org; unicidade `(campaign_id, unit_id)`; ausência de associações = **inválido** / negação — **nunca** promove para `all_units` |

Para `scope_type = unit`: aplicabilidade N/A; apenas a `unit_id` da entidade.

### 5.4 Mudança de escopo / aplicabilidade

Operação auditada; revalida associações; transição ilegal (ex.: `selected_units` sem linhas; `unit` com applicability) deve ser rejeitada.

---

## 6. Autorização e RLS futura

> **Implementação futura.** Não declarar RLS já implementada. Estado atual: policies JWT em `campaigns` / `action_plans` (**estado atual documentado**, `0002`).

### 6.1 Princípios

- Deny-by-default.
- Isolamento por `organization_id` em todo objeto coletivo.
- Isolamento por unidade conforme `scope_type` e `unit_applicability`.
- Filtros no **servidor** (serviço + RLS); frontend **não** é fronteira de segurança.
- Sem fallback silencioso; sem mock como sucesso degradado.
- Service role: apenas jobs controlados; sem bypass de limiar em respostas de app.
- Auditoria de decisões sensíveis (deny, mudança de escopo/aplicabilidade, export).

### 6.2 Visibilidade normativa

#### Usuário organization-scoped (papel org-wide na org ativa)

- Acessa somente recursos da **própria** organização;
- Respeita permissões funcionais (CRUD vs leitura);
- Não acessa outra organização;
- **Não** recebe acesso nominal/clínico por força do vínculo coletivo.

#### Usuário unit-scoped (`user_roles.unit_id` da org ativa)

Pode acessar (metadados de campanha/plano coletivo, conforme papel):

- campanhas `scope_type = unit` da **sua** `unit_id`;
- campanhas `scope_type = organization` + `unit_applicability = all_units` da **sua** organização;
- campanhas `scope_type = organization` + `unit_applicability = selected_units` **somente se** sua unidade estiver na associação explícita;

Não pode:

- campanhas de outras units;
- `selected_units` onde sua unit não está listada;
- recursos de outra organização;
- dados nominais/clínicos via painel D01.

#### Usuário com múltiplos vínculos

- Deve operar com **contexto organizacional** e, quando aplicável, **unitário** explicitamente selecionado;
- Autorização recalculada no **servidor e no banco** para o contexto ativo;
- Troca de contexto **não** reaproveita autorização de outro vínculo;
- Ausência ou ambiguidade de contexto → **negação por padrão**;
- **Dependência / gap:** `selectedUnitId` na sessão hoje permanece tipicamente `null` (**estado atual documentado**); ativação é ticket access/UX separado — D01 não redesenha access.

### 6.3 Matriz de permissões (papéis reais — confirmados em `apps/web/src/shared/types/access.ts`)

Legenda: C=criar, R=ler metadados coletivos, U=alterar, E=encerrar, A=ver agregados (preparação D01 / enforcement D02), I=ver dados individuais nominais no painel de gestão.

| Papel | Escopo típico | C | R | U | E | A | I (painel gestão) |
|---|---|---|---|---|---|---|---|
| `gestor_institucional` | org-wide | sim | sim | sim | sim | sim* | **não** |
| `sst` | org / unit conforme vínculo | sim† | sim | sim† | sim† | sim* | **não** |
| `admin_cliente` | org | sim | sim | sim | sim | sim* | **não** |
| `admin_biomed` | org (plataforma) | sim | sim | sim | sim | sim* | **não** |
| `auditor` | org (leitura) | não | sim | não | não | sim* (leitura) | **não** |
| `gestor_clinico` | clínico | não | não‡ | não | não | não | **não** |
| `medico` / `profissional_saude` | assignment | não | não‡ | não | não | não | **não** |
| `usuario` | próprio | não | — | não | não | não | próprio histórico (outro domínio) |

\* Agregação plena e limiar: **SUP-D02**. D01 prepara contrato/`suppressed`.
† Escrita SST unit-scoped: somente na própria unit (+ leitura de campanhas org aplicáveis conforme §6.2).
‡ Leitura operacional de campanha para comunicação clínica, se existir, é **ticket futuro** com permissão explícita — **não** painel gerencial.

**Norma `admin_biomed`:** nenhum papel de gestão coletiva recebe acesso nominal/pessoal/clínico/assistencial no painel por força do SUP-D01. Fluxo excepcional exigiria ticket, base legal, autorização e auditoria **próprios** — **fora desta SPEC**.

---

## 7. Privacidade, limiar e faseamento D01/D02

| Regra | Definição | Fase |
|---|---|---|
| Limiar | ≥ **10** pessoas no recorte coletivo **efetivamente consultado**, após todos os filtros; sem recomposição artificial do universo | **Decisão ratificada**; enforcement **D02** |
| Abaixo do limiar | Resultado `suppressed` (não fingir “zero real” ambíguo) | Contrato em D01; enforcement D02 |
| Diferencial / reidentificação | Proibir contorno por filtros sucessivos, cruzamentos, diferenças, exportações | **D02** |
| Exportação | Mesmos controles; auditar | **D02** (preparação de eventos em D01) |
| Clínica vs gestão | Limiar **não** impede atendimento clínico autorizado | **Decisão ratificada** |

**Faseamento normativo:**

- **SUP-D01:** define campos, contratos, estados e critérios de **preparação estrutural** + negação segura; pode incluir tipo `SafeAggregateResult` como contrato.
- **SUP-D02:** implementa agregações, limiar, anti-diferencial e proteção contra reidentificação.
- D01 **não** declara aceito um mecanismo que só o D02 implementará.

---

## 8. Repositories e serviços futuros

**Implementação futura / proposta técnica** (não existentes como módulo gestão no MVP atual):

1. Operações coletivas exigem contexto institucional (`organizationId` + ator + papel + contexto unitário quando aplicável).
2. Jornadas/pessoais independentes **não** passam por este repository.
3. APIs distinguem `organization` vs `unit` e `all_units` vs `selected_units`.
4. Rejeitar `unitId` incompatível (`UNIT_ORG_MISMATCH`); rejeitar `selected_units` sem associações.
5. Sem fallback silencioso.
6. Filtros de escopo/aplicabilidade no servidor.
7. Interface de agregação segura preparada; enforcement no D02.
8. Auditoria dos eventos da §10.

---

## 9. Tipos e contratos futuros (conceituais)

> **Proposta técnica** — não criar arquivos de produção nesta etapa. Nomes sujeitos a confirmação na implementação.

```ts
/** Nomes propostos — sujeitos a confirmação na futura implementação */
type CollectiveScopeType = 'organization' | 'unit';

type UnitApplicability = 'all_units' | 'selected_units';

/** Pseudotipo conceitual: lista com pelo menos um elemento */
type NonEmptyArray<T> = readonly [T, ...T[]];

/**
 * Escopo discriminado — sem organizationId aqui.
 * Fonte única de organizationId: recurso pai (ex.: CreateCampaignInput.organizationId).
 * unit ∈ organization valida-se contra esse organizationId do recurso.
 */
type CollectiveScope =
  | {
      scopeType: 'organization';
      unitId: null;
      unitApplicability: 'all_units';
      /** Ramo all_units: sem unitIds */
    }
  | {
      scopeType: 'organization';
      unitId: null;
      unitApplicability: 'selected_units';
      unitIds: NonEmptyArray<string>;
    }
  | {
      scopeType: 'unit';
      unitId: string;
      /** Sem unitApplicability; sem unitIds */
    };

/** Escopo sempre herdado da campanha — sem override de org/unit/aplicabilidade */
type CollectiveAudienceInput = {
  audienceLabel: string;
  /** Critérios agregáveis permitidos; nunca ampliam o universo da campanha */
  criteria?: Record<string, string | number | boolean>;
};

type CreateCampaignInput = {
  /** Fonte única de organizationId do recurso coletivo */
  organizationId: string;
  scope: CollectiveScope;
  title: string;
  description: string;
  channel: string;
  startsAt: string;
  endsAt: string;
  audience?: CollectiveAudienceInput;
};

/** Contrato preparado no D01; enforcement pleno no D02 */
type SafeAggregateResult =
  | { status: 'ok'; value: number; n: number; scope: CollectiveScope }
  | { status: 'suppressed'; reason: 'BELOW_MIN_GROUP'; minGroup: 10; scope: CollectiveScope };

type PersonalContext = { userId: string };
type InstitutionalContext = {
  userId: string;
  organizationId: string;
  selectedUnitId?: string | null;
};
```

Validações conceituais: ramos discriminados acima; `unitIds` (somente `selected_units`) ∈ `CreateCampaignInput.organizationId`; `all_units` e `unit` **não** possuem `unitIds`; `unit` **não** possui `unitApplicability`.

Flags ilustrativas `VITE_*_MANAGEMENT_*` (**proposta técnica**, desligadas por default se adotadas) — **não existentes** no estado atual; não inventar paths de componentes.

---

## 10. Auditoria (eventos mínimos)

| Evento | Quando |
|---|---|
| `campaign.created` / `campaign.updated` | CRUD |
| `campaign.scope_changed` | mudança `scope_type` / `unit_id` |
| `campaign.applicability_changed` | mudança `unit_applicability` |
| `campaign.unit_associated` / `campaign.unit_removed` | `selected_units` |
| `campaign.audience_changed` | público-alvo |
| `campaign.closed` | encerramento |
| `action_plan.*` | análogo |
| `access.denied` | negação escopo/papel/contexto |
| `indicator.*` / `export.*` | **SUP-D02** (podem ser antecipados como nomes; não são aceite D01) |

Escrita append-only via RPC (alinhado à Fase E / planning) — **implementação futura**.

---

## 11. Evoluções futuras explicitamente excluídas do núcleo

| Item | Tratamento |
|---|---|
| `program_participations` | **Fora do núcleo D01**; evolução futura com decisão própria; **sem** tabela/contrato/migration normativa nesta SPEC; **sem** `user_id` nominal no núcleo coletivo |
| `population_groups` avançados | Evolução futura / D02+ |
| Bases legais adicionais de campanha | Apontar a consentimento versionado (B01); texto jurídico = decisão humana pendente |
| Seletor de unidade na sessão | Ticket access/UX; não expandir access neste ticket |

---

## 12. Compatibilidade e rollout

| Tema | Diretriz |
|---|---|
| Schema atual | Extensão não destrutiva preferida |
| Histórico | Campanhas existentes → `scope_type='organization'`, `unit_id=null`, `unit_applicability='all_units'` (backfill **explícito**) |
| Feature flags | Opcionais; default off (**proposta**) |
| Incremental | (1) tipos/contrato (2) schema+constraints (3) RLS membership (4) repos (5) UI — **cada passo** só após autorização |
| RLS legado (`0002` JWT) | Deve ser **substituído/evoluído** no bloco de isolamento do D01; não permanece como fronteira definitiva |
| UI gestão atual | `ManagementPages` permanece **demonstrativa** até autorização explícita de conexão a dados reais |
| `selectedUnitId` | Hoje tipicamente `null` (**estado atual**); ambiguidade → **deny-by-default** (§6.2); ativação de seletor = ticket access/UX separado |
| Rollback | SQL simétrico + flag off |
| Observabilidade | erros tipados; sem PHI |
| Risco pessoal/clínico | regressão: usuário sem org; clínica sem painel; sem absorção de prontuário |

### 12.1 Faseamento controlado da implementação (não autorizado automaticamente)

| Bloco | Conteúdo típico | Autorização |
|---|---|---|
| **D01-A** | Contratos e tipos TypeScript conceituais → arquivos de produção acordados | Exige ordem **específica** |
| **D01-B** | Schema/migration (`scope_type`, `unit_id`, `unit_applicability`, associação, CHECKs, backfill) | Condicionado a D01-A verificado + ordem **específica** |
| Posterior (fora desta aprovação) | Repos/serviços, RLS mínima D01, UI real, testes de integração | Ordens futuras separadas |
| **SUP-D02** | Agregações, limiar, anti-diferencial, exportação | **Não** autorizado por esta SPEC |
| **SUP-C01 / SUP-B04 / C04.2b** | Paralelo / não iniciar / encerrada | Fora do D01 |

Correção de `catch → mock` em assessment/consent é **ticket próprio**, fora do SUP-D01.

---

## 13. Testes futuros (após autorização de implementação)

**SUP-D01:**

- CHECK `scope_type`×`unit_id`×`unit_applicability`;
- FK/trigger unit∈org; unique associação;
- `selected_units` sem linhas rejeitado; `all_units` com linhas rejeitado;
- audiência sem override;
- RLS/serviço: cross-org deny; unit-scoped vs all/selected; multi-vínculo com contexto;
- deny-by-default sem contexto;
- regressão: Minha BioMed sem org obrigatória (futuro B2C); clínica isolada; desligamento preserva histórico.

**SUP-D02 (não são aceite de conclusão do D01):**

- n=9 suppressed; n=10 ok; diferencial de filtros; exportação.

---

## 14. Critérios de aceite (implementação futura do SUP-D01)

**20** critérios verificáveis no D01, numerados de **1** a **20**:

1. Registro coletivo exige `organization_id`.
2. `unit_id` coerente com `scope_type` (`null` só em `organization`; preenchido em `unit`).
3. `unit_id = null` exclusivamente organizacional explícito; não amplia autorização.
4. Unidade informada pertence à organização.
5. `scope_type` ∈ {`organization`,`unit`} apenas.
6. Em `organization`: `unit_applicability` ∈ {`all_units`,`selected_units`}.
7. `selected_units`: lista explícita não vazia; unicidade; unit∈org; ausência de lista ≠ `all_units`.
8. `all_units`: sem associações; alcança units válidas atuais e futuras da mesma org.
9. Em `unit`: sem `unit_applicability` e sem associações extras.
10. Audiência herda escopo/aplicabilidade; sem `unit_id` próprio; sem ampliar universo.
11. Usuário unit-scoped vê apenas campanhas autorizadas (§6.2).
12. Múltiplos vínculos exigem contexto explícito; ambiguidade → deny.
13. Deny-by-default; frontend não é fronteira de segurança.
14. Nenhum papel de gestão (incl. `admin_biomed`) obtém acesso nominal/clínico no painel via D01.
15. Organização patrocinadora ≠ titular do prontuário pessoal.
16. Desligamento não elimina histórico pessoal.
17. Contrato `SafeAggregateResult` / `suppressed` preparado; **enforcement completo do limiar ≠ aceite concluído do D01** (fica no D02).
18. Sem dependência funcional da implementação do gap SUP-C01.
19. Sem efeito colateral B04 / C04.2b / C01.
20. **Aprovação desta SPEC não autoriza implementação por si só** — cada bloco (D01-A, D01-B, …) exige ordem explícita e separada.

---

## 15. Decisões residuais (não reabrem a ratificação PR #17)

| Decisão | Alternativas | Recomendação | Bloqueia esta aprovação? |
|---|---|---|---|
| Nome físico da tabela de associação | `campaign_unit_applicabilities` vs outro | Preferir nome alinhado a `unit_applicability` | Não |
| Escrita SST unit-scoped | só própria unit vs ampla | Só própria unit (+ ler org aplicável) | Não |
| Nome das flags Vite | vários | Default off; confirmar na impl. | Não |
| Texto jurídico de campanha | provisório vs formal | Aprovação humana (pendente B01) | Parcial p/ produção regulada |

Decisões D1–D7 e a ratificação do PR #17 **não** são reabertas aqui.

---

## 16. Autorização de trabalho

| Etapa | Estado |
|---|---|
| Análise arquitetural | Concluída |
| Ratificação org×unit (PR #17) | Integrada em `main` |
| Especificação SUP-D01 (PR #18) | Incorporada em `main` (`9930c61…`) |
| Revisão formal desta SPEC | **Aprovada para implementação controlada** (2026-08-01) |
| D01-A (contratos/tipos) | **Concluído** — `apps/web/src/domains/collective/` (PR #20, `36c6d2…`) |
| D01-B (schema/migration/RLS) | **Implementado nesta trilha** — `0017_collective_campaign_scope_integrity.sql`; validação local PASS; PR pendente de revisão humana; **sem** UI/repos |
| Repos / UI real de gestão | **Não autorizados** |
| SUP-D02 / C01 / B04 / C04.2b | Fora / paralelo / não iniciar / encerrada |

> **Rastreabilidade D01-A:** entrega tipada conforme §9; `suppressed` apenas no contrato `SafeAggregateResult`; sem persistência naquele bloco.
> **Rastreabilidade D01-B:** persistência estrutural + constraints + RLS membership conforme §4–§6; audiência herda org da campanha (coluna física preexistente com trigger); sem agregações/limiar; sem acesso nominal. O SUP-D01 **não** está integralmente implementado (faltam UI/repos e D02).

---

## 17. Referências

- `PROJECT_MASTER_HANDOFF.md` (§6.1)
- `SUPABASE_IMPLEMENTATION_BACKLOG.md` (SUP-D01)
- `SUPABASE_ARCHITECTURE_PLANNING.md` (decisão 2026-07-31)
- `DATA_MODEL.md`
- PR #17 (ratificação)
- Schema atual: `supabase/migrations/0001_init_schema.sql`
- RLS legado gestão: `supabase/migrations/0002_rls_policies.sql` (**estado atual**)
- Papéis: `apps/web/src/shared/types/access.ts` (**confirmado no repositório**)
