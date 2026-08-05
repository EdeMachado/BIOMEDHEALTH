import type { CollectiveScope } from './types';

export type CollectiveIdentity = {
  id: string;
  organizationId: string;
};

export type CollectiveContext = {
  userId: string;
  organizationId: string;
  selectedUnitId: string | null;
};

export type CollectiveScopeFormInput = {
  scopeKind: 'all_units' | 'unit' | 'selected_units';
  unitId: string;
  selectedUnitIdsRaw: string;
};

export type CollectiveScopeBuildResult =
  | { ok: true; scope: CollectiveScope }
  | { ok: false; message: string };

export function buildCollectiveContext(
  identity: CollectiveIdentity | null | undefined
): CollectiveContext | null {
  const userId = identity?.id?.trim();
  const organizationId = identity?.organizationId?.trim();

  if (!userId || !organizationId) return null;

  return {
    userId,
    organizationId,
    selectedUnitId: null,
  };
}

export function parseExplicitCollectiveUnitIds(
  raw: string
): { ok: true; unitIds: [string, ...string[]] } | { ok: false; message: string } {
  const parts = raw
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      ok: false,
      message:
        'Escopo selected_units exige ao menos um unitId explicito (separados por virgula ou espaco).',
    };
  }

  if (new Set(parts).size !== parts.length) {
    return {
      ok: false,
      message: 'IDs de unidade duplicados nao sao permitidos.',
    };
  }

  return { ok: true, unitIds: parts as [string, ...string[]] };
}

export function buildCollectiveScope(
  input: CollectiveScopeFormInput
): CollectiveScopeBuildResult {
  if (input.scopeKind === 'all_units') {
    return {
      ok: true,
      scope: {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'all_units',
      },
    };
  }

  if (input.scopeKind === 'unit') {
    const unitId = input.unitId.trim();

    if (!unitId) {
      return {
        ok: false,
        message:
          'Escopo unitario exige unitId explicito no formulario. selectedUnitId de sessao nao e usado.',
      };
    }

    return {
      ok: true,
      scope: { scopeType: 'unit', unitId },
    };
  }

  const parsed = parseExplicitCollectiveUnitIds(input.selectedUnitIdsRaw);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    scope: {
      scopeType: 'organization',
      unitId: null,
      unitApplicability: 'selected_units',
      unitIds: parsed.unitIds,
    },
  };
}
