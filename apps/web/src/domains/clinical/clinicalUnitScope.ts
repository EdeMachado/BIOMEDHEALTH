import type { AccessRoleBinding, AccessUnitScope } from '@/services/repositories/access/types';

const CLINICAL_ROLES = new Set(['medico', 'profissional_saude', 'gestor_clinico']);

/**
 * Resolve clinical unit scope without inventing org-wide access.
 * Fail-closed when unit cannot be determined uniquely.
 */
export function resolveClinicalUnitId(input: {
  selectedUnitId?: string | null;
  roleBindings?: AccessRoleBinding[];
  unitScopes?: AccessUnitScope[];
}): { ok: true; unitId: string } | { ok: false; code: 'UNIT_SCOPE_REQUIRED' } {
  const selected = input.selectedUnitId?.trim();
  if (selected) {
    return { ok: true, unitId: selected };
  }

  const units = new Set<string>();
  for (const binding of input.roleBindings ?? []) {
    if (binding.status !== 'active') continue;
    if (!CLINICAL_ROLES.has(binding.role)) continue;
    if (binding.unitId) units.add(binding.unitId);
  }
  for (const scope of input.unitScopes ?? []) {
    if (scope.status !== 'active') continue;
    if (scope.unitId) units.add(scope.unitId);
  }

  if (units.size === 1) {
    const [only] = [...units];
    if (only) return { ok: true, unitId: only };
  }

  return { ok: false, code: 'UNIT_SCOPE_REQUIRED' };
}

export function requireClinicalUnitId(unitId: string | null | undefined): string {
  const value = unitId?.trim();
  if (!value) {
    throw new Error('UNIT_SCOPE_REQUIRED');
  }
  return value;
}
