import { describe, expect, it } from 'vitest';
import { resolveClinicalUnitId } from '@/domains/clinical/clinicalUnitScope';

describe('WP-04.4 clinical unit scope', () => {
  it('fail-closed sem unit resolvivel', () => {
    const result = resolveClinicalUnitId({
      selectedUnitId: null,
      roleBindings: [
        { membershipId: 'm1', role: 'medico', unitId: null, status: 'active' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNIT_SCOPE_REQUIRED');
  });

  it('usa selectedUnitId quando presente', () => {
    const result = resolveClinicalUnitId({
      selectedUnitId: 'unit-a',
      roleBindings: [],
    });
    expect(result).toEqual({ ok: true, unitId: 'unit-a' });
  });

  it('resolve unit unica de role clinico', () => {
    const result = resolveClinicalUnitId({
      selectedUnitId: null,
      roleBindings: [
        { membershipId: 'm1', role: 'medico', unitId: 'unit-a', status: 'active' },
        { membershipId: 'm1', role: 'usuario', unitId: null, status: 'active' },
      ],
    });
    expect(result).toEqual({ ok: true, unitId: 'unit-a' });
  });

  it('nega quando ha multiplas units clinicas', () => {
    const result = resolveClinicalUnitId({
      selectedUnitId: null,
      roleBindings: [
        { membershipId: 'm1', role: 'medico', unitId: 'unit-a', status: 'active' },
        { membershipId: 'm1', role: 'profissional_saude', unitId: 'unit-b', status: 'active' },
      ],
    });
    expect(result.ok).toBe(false);
  });
});
