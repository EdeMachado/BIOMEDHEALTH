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

/** Writes that touch applicabilities or audience require multi-table atomicity (not in D01-C). */
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

export function assertContext(
  context: CollectiveContext
): CollectiveResult<true> {
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
  if (requiresMultiTableWrite(input.scope, Boolean(input.audience))) {
    return fail('ATOMICITY_REQUIRED', {
      details: {
        reason: 'selected_units_or_audience',
        requires: 'authorized_rpc_or_transaction',
      },
    });
  }
  return ok(true);
}

/**
 * @param existingScope — escopo já persistido; necessário para detectar
 * transição selected_units → all_units|unit (exige limpeza atômica de associações).
 */
export function validateUpdateCampaignWrite(
  context: CollectiveContext,
  input: UpdateCampaignInput,
  existingScope?: CollectiveScope
): CollectiveResult<true> {
  const ctx = assertContext(context);
  if (!ctx.ok) return ctx;
  if (input.organizationId !== context.organizationId) return fail('CROSS_TENANT_DATA');
  if (input.scope && requiresMultiTableWrite(input.scope, Boolean(input.audience))) {
    return fail('ATOMICITY_REQUIRED', {
      details: { reason: 'selected_units_or_audience_update' },
    });
  }
  if (input.audience) {
    return fail('ATOMICITY_REQUIRED', { details: { reason: 'audience_without_rpc' } });
  }
  if (
    input.scope &&
    existingScope &&
    existingScope.scopeType === 'organization' &&
    existingScope.unitApplicability === 'selected_units' &&
    !(
      input.scope.scopeType === 'organization' &&
      input.scope.unitApplicability === 'selected_units'
    )
  ) {
    return fail('ATOMICITY_REQUIRED', {
      details: { reason: 'clear_selected_units_associations' },
    });
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
  if (requiresMultiTableWrite(input.scope)) {
    return fail('ATOMICITY_REQUIRED', { details: { reason: 'selected_units_action_plan' } });
  }
  return ok(true);
}

export function validateUpdateActionPlanWrite(
  context: CollectiveContext,
  input: UpdateActionPlanInput,
  existingScope?: ActionPlanScope
): CollectiveResult<true> {
  const ctx = assertContext(context);
  if (!ctx.ok) return ctx;
  if (input.organizationId !== context.organizationId) return fail('CROSS_TENANT_DATA');
  if (input.scope && requiresMultiTableWrite(input.scope)) {
    return fail('ATOMICITY_REQUIRED', { details: { reason: 'selected_units_action_plan_update' } });
  }
  if (
    input.scope &&
    existingScope &&
    existingScope.scopeType === 'organization' &&
    existingScope.unitApplicability === 'selected_units' &&
    !(
      input.scope.scopeType === 'organization' &&
      input.scope.unitApplicability === 'selected_units'
    )
  ) {
    return fail('ATOMICITY_REQUIRED', {
      details: { reason: 'clear_selected_units_associations' },
    });
  }
  return ok(true);
}

export function isActionPlanScope(value: unknown): value is ActionPlanScope {
  return typeof value === 'object' && value !== null && 'scopeType' in value;
}
