import type { CollectiveScope, CreateCampaignInput, UpdateCampaignInput } from '@/domains/collective';
import { validateCreateCampaignInputStructure } from '@/domains/collective';
import { fail, ok } from '@/services/repositories/collective/errors';
import type {
  ActionPlanScope,
  CollectiveContext,
  CollectiveResult,
  CreateActionPlanInput,
  UpdateActionPlanInput,
} from '@/services/repositories/collective/types';

/** Historico D01-C: writes multi-tabela exigiam RPC. Em D01-D as mutacoes atomicas cobrem esses casos. */
export function requiresMultiTableWrite(scope: CollectiveScope, hasAudience?: boolean): boolean {
  if (hasAudience) return true;
  return scope.scopeType === 'organization' && scope.unitApplicability === 'selected_units';
}

export function scopeToColumns(scope: CollectiveScope): {
  scope_type: string;
  unit_id: string | null;
  unit_applicability: string | null;
} {
  if (scope.scopeType === 'unit') {
    return { scope_type: 'unit', unit_id: scope.unitId, unit_applicability: null };
  }
  return {
    scope_type: 'organization',
    unit_id: null,
    unit_applicability: scope.unitApplicability,
  };
}

export function columnsToScope(input: {
  scope_type: string;
  unit_id: string | null;
  unit_applicability: string | null;
  unitIds?: string[];
}): CollectiveResult<CollectiveScope> {
  if (input.scope_type === 'unit') {
    if (!input.unit_id) return fail('INVALID_INPUT', { message: 'Escopo unit exige unit_id.' });
    return ok({ scopeType: 'unit', unitId: input.unit_id });
  }
  if (input.scope_type !== 'organization') {
    return fail('INVALID_INPUT', { message: 'scope_type invalido.' });
  }
  if (input.unit_applicability === 'all_units') {
    return ok({ scopeType: 'organization', unitId: null, unitApplicability: 'all_units' });
  }
  if (input.unit_applicability === 'selected_units') {
    const ids = input.unitIds ?? [];
    if (ids.length === 0) {
      return fail('INVALID_INPUT', {
        message: 'selected_units sem associacoes persistidas.',
      });
    }
    return ok({
      scopeType: 'organization',
      unitId: null,
      unitApplicability: 'selected_units',
      unitIds: ids as [string, ...string[]],
    });
  }
  return fail('INVALID_INPUT', { message: 'unit_applicability invalida.' });
}

export function assertContext(context: CollectiveContext): CollectiveResult<true> {
  if (!context.userId) return fail('NO_SESSION');
  if (!context.organizationId) return fail('INVALID_INPUT', { message: 'organizationId obrigatorio.' });
  return ok(true);
}

export function assertSameOrganization(
  contextOrg: string,
  resourceOrg: string
): CollectiveResult<true> {
  if (contextOrg !== resourceOrg) return fail('CROSS_TENANT_DATA');
  return ok(true);
}

/** Rejeita unitIds vazios ou duplicados (sem dedupe silencioso). */
export function assertUnitIdsValid(unitIds: readonly string[]): CollectiveResult<true> {
  if (unitIds.length === 0) {
    return fail('INVALID_INPUT', { message: 'selected_units exige ao menos uma unidade.' });
  }
  const seen = new Set<string>();
  for (const id of unitIds) {
    if (!id || typeof id !== 'string') {
      return fail('INVALID_INPUT', { message: 'unitId invalido.' });
    }
    if (seen.has(id)) {
      return fail('INVALID_INPUT', { message: 'unitIds duplicados nao sao permitidos.' });
    }
    seen.add(id);
  }
  return ok(true);
}

export function assertAudienceCriteriaEmpty(
  audience: { criteria?: Record<string, string | number | boolean> } | null | undefined
): CollectiveResult<true> {
  if (!audience || audience.criteria === undefined) return ok(true);
  if (Object.keys(audience.criteria).length > 0) {
    return fail('INVALID_INPUT', {
      message: 'criteria nao vazio nao e suportado no D01-D (reservado ao SUP-D02).',
      details: { reason: 'criteria_not_supported' },
    });
  }
  return ok(true);
}

function assertScopeUnitIds(scope: CollectiveScope): CollectiveResult<true> {
  if (scope.scopeType === 'organization' && scope.unitApplicability === 'selected_units') {
    return assertUnitIdsValid(scope.unitIds);
  }
  return ok(true);
}

export function validateCreateCampaignWrite(
  context: CollectiveContext,
  input: CreateCampaignInput
): CollectiveResult<true> {
  const ctx = assertContext(context);
  if (!ctx.ok) return ctx;
  if (input.organizationId !== context.organizationId) return fail('CROSS_TENANT_DATA');
  const structural = validateCreateCampaignInputStructure(input);
  if (!structural.ok) {
    return fail('INVALID_INPUT', { details: { reason: structural.reason } });
  }
  const units = assertScopeUnitIds(input.scope);
  if (!units.ok) return units;
  const audience = assertAudienceCriteriaEmpty(input.audience);
  if (!audience.ok) return audience;
  return ok(true);
}

export function validateUpdateCampaignWrite(
  context: CollectiveContext,
  input: UpdateCampaignInput,
  existingScope?: CollectiveScope
): CollectiveResult<true> {
  void existingScope;
  const ctx = assertContext(context);
  if (!ctx.ok) return ctx;
  if (input.organizationId !== context.organizationId) return fail('CROSS_TENANT_DATA');
  if (input.scope) {
    const units = assertScopeUnitIds(input.scope);
    if (!units.ok) return units;
  }
  if (input.audience !== undefined && input.audience !== null) {
    const audience = assertAudienceCriteriaEmpty(input.audience);
    if (!audience.ok) return audience;
    if (!input.audience.audienceLabel?.trim()) {
      return fail('INVALID_INPUT', { message: 'audienceLabel obrigatorio.' });
    }
  }
  return ok(true);
}

export function validateCreateActionPlanWrite(
  context: CollectiveContext,
  input: CreateActionPlanInput
): CollectiveResult<true> {
  const ctx = assertContext(context);
  if (!ctx.ok) return ctx;
  if (input.organizationId !== context.organizationId) return fail('CROSS_TENANT_DATA');
  if (!input.originIndicator || !input.issueDescription || !input.actionText || !input.ownerName) {
    return fail('INVALID_INPUT');
  }
  return assertScopeUnitIds(input.scope);
}

export function validateUpdateActionPlanWrite(
  context: CollectiveContext,
  input: UpdateActionPlanInput,
  existingScope?: ActionPlanScope
): CollectiveResult<true> {
  void existingScope;
  const ctx = assertContext(context);
  if (!ctx.ok) return ctx;
  if (input.organizationId !== context.organizationId) return fail('CROSS_TENANT_DATA');
  if (input.scope) return assertScopeUnitIds(input.scope);
  return ok(true);
}

export function isActionPlanScope(value: unknown): value is ActionPlanScope {
  return typeof value === 'object' && value !== null && 'scopeType' in value;
}

export function scopeToRpcPayload(scope: CollectiveScope): {
  scope_type: string;
  unit_id: string | null;
  unit_applicability: string | null;
  unit_ids: string[];
} {
  const cols = scopeToColumns(scope);
  const unit_ids =
    scope.scopeType === 'organization' && scope.unitApplicability === 'selected_units'
      ? [...scope.unitIds]
      : [];
  return { ...cols, unit_ids };
}
