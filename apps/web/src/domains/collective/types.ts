/**
 * SUP-D01-A — contratos e tipos do escopo coletivo.
 * Fonte normativa: SUP_D01_TECHNICAL_SPECIFICATION.md §5 / §9.
 *
 * Limites deste módulo:
 * - apenas tipos e validações estruturais locais;
 * - não mapeia colunas de banco como se já existissem;
 * - unit ∈ organization e RLS/membership ficam para D01-B+;
 * - enforcement de limiar/anti-diferencial fica para SUP-D02.
 */

/** Lista com pelo menos um elemento (contrato approved SPEC). */
export type NonEmptyArray<T> = readonly [T, ...T[]];

export type CollectiveScopeType = 'organization' | 'unit';

/** Literais de aplicabilidade organizacional (SPEC). */
export type UnitApplicabilityLiteral = 'all_units' | 'selected_units';

/**
 * Escopo discriminado — sem organizationId aqui.
 * Fonte única de organizationId: recurso pai (CreateCampaignInput / UpdateCampaignInput).
 */
export type CollectiveScope =
  | {
      scopeType: 'organization';
      unitId: null;
      unitApplicability: 'all_units';
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
    };

/**
 * Audiência herda escopo/aplicabilidade da campanha.
 * Sem organizationId / unitId / scopeType / unitApplicability próprios.
 */
export type CollectiveAudienceInput = {
  audienceLabel: string;
  /** Critérios agregáveis permitidos; nunca ampliam o universo da campanha */
  criteria?: Record<string, string | number | boolean>;
};

export type CreateCampaignInput = {
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

/**
 * Atualização: campos de metadados opcionais.
 * Se `scope` for informado, deve ser um CollectiveScope completo (não patch parcial de campos).
 */
export type UpdateCampaignInput = {
  organizationId: string;
  campaignId: string;
  scope?: CollectiveScope;
  title?: string;
  description?: string;
  channel?: string;
  startsAt?: string;
  endsAt?: string;
  campaignStatus?: string;
  /**
   * `undefined` — não alterar audiência.
   * `null` — remover audiência explicitamente.
   * objeto — upsert da audiência singular.
   */
  audience?: CollectiveAudienceInput | null;
};

/** Leitura contratual (sem afirmar persistência D01-B). */
export type CampaignContract = {
  id: string;
  organizationId: string;
  scope: CollectiveScope;
  title: string;
  description: string;
  channel: string;
  startsAt: string;
  endsAt: string;
  audience?: CollectiveAudienceInput;
};

/**
 * Contrato de saída preparado no D01; enforcement pleno no SUP-D02.
 * Não calcular suppressed neste bloco.
 */
export type SafeAggregateResult =
  | { status: 'ok'; value: number; n: number; scope: CollectiveScope }
  | { status: 'suppressed'; reason: 'BELOW_MIN_GROUP'; minGroup: 10; scope: CollectiveScope };

export type PersonalContext = { userId: string };

/**
 * Contexto institucional contratual (SPEC).
 * Não altera AuthContext / selectedUnitId em runtime (D01-A).
 */
export type InstitutionalContext = {
  userId: string;
  organizationId: string;
  selectedUnitId?: string | null;
};
