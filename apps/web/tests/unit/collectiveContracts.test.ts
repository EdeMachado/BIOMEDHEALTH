import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  isNonEmptyArray,
  parseCollectiveScope,
  validateCreateCampaignInputStructure,
  type CollectiveScope,
  type CreateCampaignInput,
  type NonEmptyArray,
  type SafeAggregateResult,
  type UpdateCampaignInput,
} from '@/domains/collective';

describe('SUP-D01-A collective contracts', () => {
  describe('NonEmptyArray / isNonEmptyArray', () => {
    it('aceita lista com um ou mais elementos', () => {
      expect(isNonEmptyArray(['u1'])).toBe(true);
      expect(isNonEmptyArray(['u1', 'u2'])).toBe(true);
    });

    it('rejeita vazio, null e nao-array', () => {
      expect(isNonEmptyArray([])).toBe(false);
      expect(isNonEmptyArray(null)).toBe(false);
      expect(isNonEmptyArray(undefined)).toBe(false);
      expect(isNonEmptyArray('x')).toBe(false);
    });
  });

  describe('parseCollectiveScope — casos validos', () => {
    it('organization + all_units', () => {
      const result = parseCollectiveScope({
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'all_units',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual({
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'all_units',
      });
    });

    it('organization + selected_units com uma unidade', () => {
      const result = parseCollectiveScope({
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
        unitIds: ['unit-1'] as const,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.scopeType).toBe('organization');
      if (result.value.scopeType === 'organization' && result.value.unitApplicability === 'selected_units') {
        expect(result.value.unitIds).toEqual(['unit-1']);
      }
    });

    it('organization + selected_units com multiplas unidades', () => {
      const result = parseCollectiveScope({
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
        unitIds: ['unit-1', 'unit-2'] as const,
      });
      expect(result.ok).toBe(true);
    });

    it('unit com unitId', () => {
      const result = parseCollectiveScope({
        scopeType: 'unit',
        unitId: 'unit-9',
      });
      expect(result).toEqual({
        ok: true,
        value: { scopeType: 'unit', unitId: 'unit-9' },
      });
    });
  });

  describe('parseCollectiveScope — casos invalidos', () => {
    it('organization com unitId preenchido', () => {
      expect(
        parseCollectiveScope({
          scopeType: 'organization',
          unitId: 'unit-1',
          unitApplicability: 'all_units',
        }).ok,
      ).toBe(false);
    });

    it('unit sem unitId', () => {
      expect(parseCollectiveScope({ scopeType: 'unit', unitId: null }).ok).toBe(false);
      expect(parseCollectiveScope({ scopeType: 'unit' }).ok).toBe(false);
    });

    it('all_units com unitIds', () => {
      expect(
        parseCollectiveScope({
          scopeType: 'organization',
          unitId: null,
          unitApplicability: 'all_units',
          unitIds: ['unit-1'],
        }).ok,
      ).toBe(false);
    });

    it('selected_units sem unitIds', () => {
      expect(
        parseCollectiveScope({
          scopeType: 'organization',
          unitId: null,
          unitApplicability: 'selected_units',
        }).ok,
      ).toBe(false);
    });

    it('selected_units com array vazio', () => {
      expect(
        parseCollectiveScope({
          scopeType: 'organization',
          unitId: null,
          unitApplicability: 'selected_units',
          unitIds: [],
        }).ok,
      ).toBe(false);
    });

    it('unit com unitApplicability ou unitIds', () => {
      expect(
        parseCollectiveScope({
          scopeType: 'unit',
          unitId: 'u1',
          unitApplicability: 'all_units',
        }).ok,
      ).toBe(false);
      expect(
        parseCollectiveScope({
          scopeType: 'unit',
          unitId: 'u1',
          unitIds: ['u1'],
        }).ok,
      ).toBe(false);
    });
  });

  describe('CreateCampaignInput estrutural', () => {
    const base = {
      organizationId: 'org-1',
      title: 'Campanha',
      description: 'Desc',
      channel: 'email',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-31T00:00:00.000Z',
    };

    it('aceita combinacoes validas com audiência herdada', () => {
      expect(
        validateCreateCampaignInputStructure({
          ...base,
          scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
          audience: { audienceLabel: 'Colaboradores' },
        }).ok,
      ).toBe(true);

      expect(
        validateCreateCampaignInputStructure({
          ...base,
          scope: {
            scopeType: 'organization',
            unitId: null,
            unitApplicability: 'selected_units',
            unitIds: ['u1', 'u2'],
          },
        }).ok,
      ).toBe(true);

      expect(
        validateCreateCampaignInputStructure({
          ...base,
          scope: { scopeType: 'unit', unitId: 'u1' },
        }).ok,
      ).toBe(true);
    });

    it('rejeita audiência tentando redefinir escopo', () => {
      const result = validateCreateCampaignInputStructure({
        ...base,
        scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
        audience: {
          audienceLabel: 'X',
          organizationId: 'org-other',
        },
      });
      expect(result.ok).toBe(false);
    });

    it('rejeita organizationId ausente', () => {
      expect(
        validateCreateCampaignInputStructure({
          title: 'Campanha',
          description: 'Desc',
          channel: 'email',
          startsAt: '2026-08-01T00:00:00.000Z',
          endsAt: '2026-08-31T00:00:00.000Z',
          scope: { scopeType: 'unit', unitId: 'u1' },
        }).ok,
      ).toBe(false);
    });
  });

  describe('contratos TypeScript (expectTypeOf / @ts-expect-error)', () => {
    it('tipa ramos validos de CollectiveScope e CreateCampaignInput', () => {
      const orgAll: CollectiveScope = {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'all_units',
      };
      const orgSelected: CollectiveScope = {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
        unitIds: ['u1'],
      };
      const unitScope: CollectiveScope = {
        scopeType: 'unit',
        unitId: 'u1',
      };

      expectTypeOf(orgAll).toMatchTypeOf<CollectiveScope>();
      expectTypeOf(orgSelected).toMatchTypeOf<CollectiveScope>();
      expectTypeOf(unitScope).toMatchTypeOf<CollectiveScope>();

      const createInput: CreateCampaignInput = {
        organizationId: 'org-1',
        scope: orgAll,
        title: 'T',
        description: 'D',
        channel: 'email',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-31T00:00:00.000Z',
        audience: { audienceLabel: 'Grupo' },
      };
      expectTypeOf(createInput.organizationId).toEqualTypeOf<string>();
      expectTypeOf(createInput.scope).toMatchTypeOf<CollectiveScope>();

      const update: UpdateCampaignInput = {
        organizationId: 'org-1',
        campaignId: 'c1',
        scope: unitScope,
        title: 'Novo titulo',
      };
      expectTypeOf(update.scope).toEqualTypeOf<CollectiveScope | undefined>();

      // D01-D: audience null remove audiencia; undefined preserva
      const clearAudience: UpdateCampaignInput = {
        organizationId: 'org-1',
        campaignId: 'c1',
        audience: null,
      };
      expectTypeOf(clearAudience.audience).toEqualTypeOf<
        import('@/domains/collective').CollectiveAudienceInput | null | undefined
      >();
      expect(clearAudience.audience).toBeNull();
    });

    it('tipa SafeAggregateResult com suppressed preparado (sem enforcement)', () => {
      const ok: SafeAggregateResult = {
        status: 'ok',
        value: 12,
        n: 12,
        scope: { scopeType: 'unit', unitId: 'u1' },
      };
      const suppressed: SafeAggregateResult = {
        status: 'suppressed',
        reason: 'BELOW_MIN_GROUP',
        minGroup: 10,
        scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
      };
      expectTypeOf(ok).toMatchTypeOf<SafeAggregateResult>();
      expectTypeOf(suppressed).toMatchTypeOf<SafeAggregateResult>();
      expect(suppressed.status).toBe('suppressed');
    });

    it('rejeita estados invalidos em tempo de compilacao', () => {
      // organization com unitId string
      // @ts-expect-error organization exige unitId null
      const badOrgUnitId: CollectiveScope = {
        scopeType: 'organization',
        unitId: 'u1',
        unitApplicability: 'all_units',
      };
      void badOrgUnitId;

      // unit sem unitId
      // @ts-expect-error unit exige unitId string
      const badUnitMissing: CollectiveScope = {
        scopeType: 'unit',
      };
      void badUnitMissing;

      // all_units com unitIds
      const badAllWithIds: CollectiveScope = {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'all_units',
        // @ts-expect-error all_units nao admite unitIds
        unitIds: ['u1'],
      };
      void badAllWithIds;

      // selected_units sem unitIds
      // @ts-expect-error selected_units exige unitIds NonEmptyArray
      const badSelectedMissing: CollectiveScope = {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
      };
      void badSelectedMissing;

      // selected_units com array vazio
      // @ts-expect-error selected_units exige NonEmptyArray
      const emptyIds: NonEmptyArray<string> = [];
      void emptyIds;

      // unit com unitApplicability
      const badUnitApplicability: CollectiveScope = {
        scopeType: 'unit',
        unitId: 'u1',
        // @ts-expect-error unit nao admite unitApplicability
        unitApplicability: 'all_units',
      };
      void badUnitApplicability;

      // UpdateCampaignInput nao permite patch parcial de campos de escopo
      const badPartialScope: UpdateCampaignInput = {
        organizationId: 'org-1',
        campaignId: 'c1',
        // @ts-expect-error scope parcial invalido — exige CollectiveScope completo
        scope: { scopeType: 'organization', unitApplicability: 'all_units' },
      };
      void badPartialScope;
    });
  });
});
