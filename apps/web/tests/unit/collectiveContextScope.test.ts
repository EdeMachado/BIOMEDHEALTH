import { describe, expect, it } from 'vitest';
import {
  buildCollectiveContext,
  buildCollectiveScope,
  parseExplicitCollectiveUnitIds,
} from '@/domains/collective';

describe('collective context and scope', () => {
  it('builds a valid institutional context', () => {
    expect(buildCollectiveContext({ id: ' user-1 ', organizationId: ' org-1 ' })).toEqual({
      userId: 'user-1',
      organizationId: 'org-1',
      selectedUnitId: null,
    });
    expect(buildCollectiveContext(null)).toBeNull();
  });

  it('parses explicit unit ids and rejects duplicates', () => {
    expect(parseExplicitCollectiveUnitIds('north, south;central')).toEqual({
      ok: true,
      unitIds: ['north', 'south', 'central'],
    });
    expect(parseExplicitCollectiveUnitIds('north, north')).toMatchObject({ ok: false });
  });

  it('builds organization and unit scopes', () => {
    expect(buildCollectiveScope({ scopeKind: 'all_units', unitId: '', selectedUnitIdsRaw: '' })).toEqual({
      ok: true,
      scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
    });

    expect(buildCollectiveScope({ scopeKind: 'unit', unitId: ' unit-north ', selectedUnitIdsRaw: '' })).toEqual({
      ok: true,
      scope: { scopeType: 'unit', unitId: 'unit-north' },
    });
  });

  it('requires explicit data for restricted scopes', () => {
    expect(buildCollectiveScope({ scopeKind: 'unit', unitId: ' ', selectedUnitIdsRaw: '' })).toMatchObject({ ok: false });
    expect(buildCollectiveScope({ scopeKind: 'selected_units', unitId: '', selectedUnitIdsRaw: ' ' })).toMatchObject({ ok: false });
  });

  it('builds selected-units scope', () => {
    expect(buildCollectiveScope({ scopeKind: 'selected_units', unitId: '', selectedUnitIdsRaw: 'north south' })).toEqual({
      ok: true,
      scope: {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
        unitIds: ['north', 'south'],
      },
    });
  });
});
