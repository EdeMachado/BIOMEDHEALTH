import type { CollectiveScope, NonEmptyArray } from './types';

export type CollectiveScopeParseFailure = {
  ok: false;
  reason:
    | 'NOT_OBJECT'
    | 'INVALID_SCOPE_TYPE'
    | 'ORGANIZATION_REQUIRES_NULL_UNIT'
    | 'ORGANIZATION_REQUIRES_APPLICABILITY'
    | 'ALL_UNITS_MUST_NOT_HAVE_UNIT_IDS'
    | 'SELECTED_UNITS_REQUIRES_NONEMPTY_UNIT_IDS'
    | 'UNIT_REQUIRES_UNIT_ID'
    | 'UNIT_MUST_NOT_HAVE_APPLICABILITY'
    | 'UNIT_MUST_NOT_HAVE_UNIT_IDS'
    | 'HYBRID_OR_UNKNOWN_SHAPE';
};

export type CollectiveScopeParseResult =
  | { ok: true; value: CollectiveScope }
  | CollectiveScopeParseFailure;

export function isNonEmptyArray<T>(value: unknown): value is NonEmptyArray<T> {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item !== undefined);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valida estrutura do escopo coletivo (D01-A).
 * Não consulta banco; unit ∈ organization permanece no D01-B+.
 */
export function parseCollectiveScope(input: unknown): CollectiveScopeParseResult {
  if (!isPlainObject(input)) {
    return { ok: false, reason: 'NOT_OBJECT' };
  }

  const scopeType = input['scopeType'];
  if (scopeType !== 'organization' && scopeType !== 'unit') {
    return { ok: false, reason: 'INVALID_SCOPE_TYPE' };
  }

  if (scopeType === 'organization') {
    if (input['unitId'] !== null) {
      return { ok: false, reason: 'ORGANIZATION_REQUIRES_NULL_UNIT' };
    }

    const applicability = input['unitApplicability'];
    if (applicability !== 'all_units' && applicability !== 'selected_units') {
      return { ok: false, reason: 'ORGANIZATION_REQUIRES_APPLICABILITY' };
    }

    if ('unitIds' in input && input['unitIds'] !== undefined && applicability === 'all_units') {
      return { ok: false, reason: 'ALL_UNITS_MUST_NOT_HAVE_UNIT_IDS' };
    }

    if (applicability === 'all_units') {
      return {
        ok: true,
        value: {
          scopeType: 'organization',
          unitId: null,
          unitApplicability: 'all_units',
        },
      };
    }

    const unitIds = input['unitIds'];
    if (!isNonEmptyArray<string>(unitIds) || !unitIds.every((id) => typeof id === 'string' && id.length > 0)) {
      return { ok: false, reason: 'SELECTED_UNITS_REQUIRES_NONEMPTY_UNIT_IDS' };
    }

    return {
      ok: true,
      value: {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
        unitIds,
      },
    };
  }

  if ('unitApplicability' in input && input['unitApplicability'] !== undefined) {
    return { ok: false, reason: 'UNIT_MUST_NOT_HAVE_APPLICABILITY' };
  }
  if ('unitIds' in input && input['unitIds'] !== undefined) {
    return { ok: false, reason: 'UNIT_MUST_NOT_HAVE_UNIT_IDS' };
  }
  const unitId = input['unitId'];
  if (typeof unitId !== 'string' || unitId.length === 0) {
    return { ok: false, reason: 'UNIT_REQUIRES_UNIT_ID' };
  }

  return {
    ok: true,
    value: {
      scopeType: 'unit',
      unitId,
    },
  };
}

export function isCollectiveScope(value: unknown): value is CollectiveScope {
  return parseCollectiveScope(value).ok;
}

export type CreateCampaignStructuralFailure =
  | CollectiveScopeParseFailure
  | { ok: false; reason: 'MISSING_ORGANIZATION_ID' | 'MISSING_REQUIRED_FIELDS' };

export type CreateCampaignStructuralResult =
  | { ok: true }
  | CreateCampaignStructuralFailure;

/**
 * Validação estrutural mínima de CreateCampaignInput.
 * Não valida unit ∈ organization (D01-B).
 */
export function validateCreateCampaignInputStructure(input: unknown): CreateCampaignStructuralResult {
  if (!isPlainObject(input)) {
    return { ok: false, reason: 'NOT_OBJECT' };
  }
  const organizationId = input['organizationId'];
  if (typeof organizationId !== 'string' || organizationId.length === 0) {
    return { ok: false, reason: 'MISSING_ORGANIZATION_ID' };
  }
  for (const key of ['title', 'description', 'channel', 'startsAt', 'endsAt'] as const) {
    const value = input[key];
    if (typeof value !== 'string' || value.length === 0) {
      return { ok: false, reason: 'MISSING_REQUIRED_FIELDS' };
    }
  }
  const scopeResult = parseCollectiveScope(input['scope']);
  if (!scopeResult.ok) {
    return scopeResult;
  }
  const audience = input['audience'];
  if (audience !== undefined) {
    if (!isPlainObject(audience) || typeof audience['audienceLabel'] !== 'string') {
      return { ok: false, reason: 'MISSING_REQUIRED_FIELDS' };
    }
    for (const forbidden of ['organizationId', 'unitId', 'unitIds', 'scopeType', 'unitApplicability'] as const) {
      if (forbidden in audience && audience[forbidden] !== undefined) {
        return { ok: false, reason: 'HYBRID_OR_UNKNOWN_SHAPE' };
      }
    }
  }
  return { ok: true };
}
