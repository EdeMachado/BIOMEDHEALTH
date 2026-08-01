import { describe, expect, it, vi } from 'vitest';
import {
  createCollectiveRepositoryFactory,
  resolveCollectiveRepositoryMode,
} from '@/services/repositories/collective/factory';
import { createMockCollectiveRepository } from '@/services/repositories/collective/mockCollectiveRepository';
import { createSupabaseCollectiveRepository } from '@/services/repositories/collective/supabaseCollectiveRepository';
import type { CollectiveContext } from '@/services/repositories/collective/types';
import {
  requiresMultiTableWrite,
  validateCreateActionPlanWrite,
  validateCreateCampaignWrite,
  validateUpdateCampaignWrite,
} from '@/services/repositories/collective/validation';

function ctx(overrides: Partial<CollectiveContext> = {}): CollectiveContext {
  return {
    userId: 'user-1',
    organizationId: 'org-1',
    selectedUnitId: null,
    ...overrides,
  };
}

const allUnitsScope = {
  scopeType: 'organization' as const,
  unitId: null,
  unitApplicability: 'all_units' as const,
};

const selectedUnitsScope = {
  scopeType: 'organization' as const,
  unitId: null,
  unitApplicability: 'selected_units' as const,
  unitIds: ['unit-1'] as [string, ...string[]],
};

const unitScope = { scopeType: 'unit' as const, unitId: 'unit-1' };

const campaignBase = {
  organizationId: 'org-1',
  title: 'Camp',
  description: 'Desc',
  channel: 'email',
  startsAt: '2026-08-01',
  endsAt: '2026-08-15',
};

describe('SUP-D01-D collective repository mode', () => {
  it('seleciona mock quando flag especifica e global ausentes', () => {
    expect(resolveCollectiveRepositoryMode({})).toBe('mock');
  });

  it('herda mock de VITE_ENABLE_SUPABASE_AUTH=false', () => {
    expect(resolveCollectiveRepositoryMode({ VITE_ENABLE_SUPABASE_AUTH: 'false' })).toBe('mock');
  });

  it('herda supabase de VITE_ENABLE_SUPABASE_AUTH=true', () => {
    expect(resolveCollectiveRepositoryMode({ VITE_ENABLE_SUPABASE_AUTH: 'true' })).toBe('supabase');
  });

  it('prioriza flag especifica sobre a global', () => {
    expect(
      resolveCollectiveRepositoryMode({
        VITE_ENABLE_SUPABASE_AUTH: 'true',
        VITE_COLLECTIVE_REPOSITORY_MODE: 'mock',
      })
    ).toBe('mock');
  });

  it('falha deterministicamente com flag especifica invalida', () => {
    expect(() =>
      resolveCollectiveRepositoryMode({ VITE_COLLECTIVE_REPOSITORY_MODE: 'hybrid' })
    ).toThrow(/VITE_COLLECTIVE_REPOSITORY_MODE/);
  });

  it('falha deterministicamente com flag global invalida quando especifica ausente', () => {
    expect(() => resolveCollectiveRepositoryMode({ VITE_ENABLE_SUPABASE_AUTH: 'yes' })).toThrow(
      /VITE_ENABLE_SUPABASE_AUTH/
    );
  });

  it('factory mock nao exige client', () => {
    const repo = createCollectiveRepositoryFactory({ mode: 'mock' });
    expect(repo).toBeTruthy();
  });

  it('factory supabase exige client (fail-closed)', () => {
    expect(() => createCollectiveRepositoryFactory({ mode: 'supabase' })).toThrow(/exige client/);
  });
});

describe('SUP-D01-D atomicidade diagnostico e validacao', () => {
  it('requiresMultiTableWrite permanece true para selected_units e audiencia (diagnostico)', () => {
    expect(requiresMultiTableWrite(allUnitsScope)).toBe(false);
    expect(requiresMultiTableWrite(unitScope)).toBe(false);
    expect(requiresMultiTableWrite(selectedUnitsScope)).toBe(true);
    expect(requiresMultiTableWrite(allUnitsScope, true)).toBe(true);
  });

  it('aceita create selected_units (sem ATOMICITY_REQUIRED)', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      ...campaignBase,
      scope: selectedUnitsScope,
    });
    expect(result.ok).toBe(true);
  });

  it('aceita audiencia no create (sem ATOMICITY_REQUIRED)', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      ...campaignBase,
      scope: allUnitsScope,
      audience: { audienceLabel: 'Adultos' },
    });
    expect(result.ok).toBe(true);
  });

  it('aceita update selected_units → all_units (sem ATOMICITY_REQUIRED)', () => {
    const result = validateUpdateCampaignWrite(
      ctx(),
      {
        organizationId: 'org-1',
        campaignId: 'c1',
        scope: allUnitsScope,
      },
      selectedUnitsScope
    );
    expect(result.ok).toBe(true);
  });

  it('aceita create all_units e unit', () => {
    expect(
      validateCreateCampaignWrite(ctx(), {
        ...campaignBase,
        scope: allUnitsScope,
      }).ok
    ).toBe(true);
    expect(
      validateCreateCampaignWrite(ctx(), {
        ...campaignBase,
        scope: unitScope,
      }).ok
    ).toBe(true);
  });

  it('aceita action plan selected_units', () => {
    const result = validateCreateActionPlanWrite(ctx(), {
      organizationId: 'org-1',
      originIndicator: 'Adesao',
      issueDescription: 'Problema',
      actionText: 'Acao',
      ownerName: 'Gestora',
      dueDate: '2026-08-15',
      priority: 'Alta',
      scope: selectedUnitsScope,
    });
    expect(result.ok).toBe(true);
  });

  it('rejeita organizationId conflitante', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      ...campaignBase,
      organizationId: 'org-other',
      scope: allUnitsScope,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CROSS_TENANT_DATA');
  });

  it('rejeita criteria nao vazio com INVALID_INPUT', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      ...campaignBase,
      scope: allUnitsScope,
      audience: { audienceLabel: 'Grupo', criteria: { idade: 30 } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(result.error.details).toMatchObject({ reason: 'criteria_not_supported' });
  });

  it('rejeita unitIds duplicados com INVALID_INPUT', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      ...campaignBase,
      scope: {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
        unitIds: ['unit-1', 'unit-1'] as [string, ...string[]],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
    expect(result.error.message).toMatch(/duplicad/i);
  });

  it('rejeita selected_units vazio com INVALID_INPUT', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      ...campaignBase,
      scope: {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
        unitIds: [] as unknown as [string, ...string[]],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });
});

describe('SUP-D01-D mock collective repository', () => {
  it('lista seed demo e isola por organizacao', async () => {
    const repo = createMockCollectiveRepository();
    const list = await repo.listCampaigns({ context: ctx() });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.length).toBeGreaterThan(0);

    const other = await repo.listCampaigns({ context: ctx({ organizationId: 'org-2' }) });
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.data.every((c) => c.organizationId === 'org-2')).toBe(true);
    expect(list.data.every((c) => c.organizationId === 'org-1')).toBe(true);
  });

  it('cria, atualiza, encerra e exclui campanha all_units', async () => {
    const repo = createMockCollectiveRepository();
    const created = await repo.createCampaign(ctx(), {
      ...campaignBase,
      title: 'Nova',
      description: 'Obj',
      channel: 'app',
      startsAt: '2026-09-01',
      endsAt: '2026-09-10',
      scope: allUnitsScope,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await repo.updateCampaign(ctx(), {
      organizationId: 'org-1',
      campaignId: created.data.id,
      title: 'Nova editada',
      campaignStatus: 'Encerrada',
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.title).toBe('Nova editada');
    expect(updated.data.campaignStatus).toBe('Encerrada');
    expect(updated.data.version).toBe(created.data.version + 1);

    const deleted = await repo.deleteCampaign(ctx(), created.data.id);
    expect(deleted.ok).toBe(true);
    const missing = await repo.getCampaign(ctx(), created.data.id);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('cria selected_units e transiciona escopo no update', async () => {
    const repo = createMockCollectiveRepository();
    const created = await repo.createCampaign(ctx(), {
      ...campaignBase,
      title: 'Selected',
      scope: selectedUnitsScope,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.scope).toMatchObject({
      unitApplicability: 'selected_units',
      unitIds: ['unit-1'],
    });

    const transitioned = await repo.updateCampaign(ctx(), {
      organizationId: 'org-1',
      campaignId: created.data.id,
      scope: allUnitsScope,
    });
    expect(transitioned.ok).toBe(true);
    if (!transitioned.ok) return;
    expect(transitioned.data.scope).toEqual(allUnitsScope);

    const back = await repo.updateCampaign(ctx(), {
      organizationId: 'org-1',
      campaignId: created.data.id,
      scope: {
        scopeType: 'organization',
        unitId: null,
        unitApplicability: 'selected_units',
        unitIds: ['unit-a', 'unit-b'],
      },
    });
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.data.scope).toMatchObject({
      unitApplicability: 'selected_units',
      unitIds: ['unit-a', 'unit-b'],
    });
  });

  it('audience upsert, null e preserve no update', async () => {
    const repo = createMockCollectiveRepository();
    const created = await repo.createCampaign(ctx(), {
      ...campaignBase,
      scope: allUnitsScope,
      audience: { audienceLabel: 'Inicial' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.audience?.audienceLabel).toBe('Inicial');

    const upserted = await repo.updateCampaign(ctx(), {
      organizationId: 'org-1',
      campaignId: created.data.id,
      audience: { audienceLabel: 'Atualizada' },
    });
    expect(upserted.ok).toBe(true);
    if (!upserted.ok) return;
    expect(upserted.data.audience?.audienceLabel).toBe('Atualizada');

    const preserved = await repo.updateCampaign(ctx(), {
      organizationId: 'org-1',
      campaignId: created.data.id,
      title: 'So titulo',
    });
    expect(preserved.ok).toBe(true);
    if (!preserved.ok) return;
    expect(preserved.data.audience?.audienceLabel).toBe('Atualizada');
    expect(preserved.data.title).toBe('So titulo');

    const cleared = await repo.updateCampaign(ctx(), {
      organizationId: 'org-1',
      campaignId: created.data.id,
      audience: null,
    });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.data.audience).toBeUndefined();
  });

  it('rejeita criteria nao vazio no mock create', async () => {
    const repo = createMockCollectiveRepository();
    const result = await repo.createCampaign(ctx(), {
      ...campaignBase,
      scope: allUnitsScope,
      audience: { audienceLabel: 'X', criteria: { a: 1 } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('CRUD de planos all_units e selected_units', async () => {
    const repo = createMockCollectiveRepository();
    const created = await repo.createActionPlan(ctx(), {
      organizationId: 'org-1',
      originIndicator: 'Adesao',
      issueDescription: 'Baixa adesao',
      actionText: 'Comunicar',
      ownerName: 'Marina',
      dueDate: '2026-08-20',
      priority: 'Alta',
      scope: allUnitsScope,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const selected = await repo.createActionPlan(ctx(), {
      organizationId: 'org-1',
      originIndicator: 'Adesao',
      issueDescription: 'Parcial',
      actionText: 'Segmentar',
      ownerName: 'Marina',
      dueDate: '2026-08-25',
      priority: 'Media',
      scope: selectedUnitsScope,
    });
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.data.scope).toMatchObject({
      unitApplicability: 'selected_units',
      unitIds: ['unit-1'],
    });

    const listed = await repo.listActionPlans({ context: ctx() });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.some((p) => p.id === created.data.id)).toBe(true);
    expect(listed.data.some((p) => p.id === selected.data.id)).toBe(true);
  });
});

describe('SUP-D01-D supabase collective repository', () => {
  const campaignRpcJson = {
    id: 'camp-1',
    organization_id: 'org-1',
    title: 'Campanha',
    description: 'Desc',
    channel: 'email',
    starts_at: '2026-08-01',
    ends_at: '2026-08-15',
    campaign_status: 'Rascunho',
    status: 'ativo',
    version: 1,
    scope_type: 'organization',
    unit_id: null,
    unit_applicability: 'all_units',
    unit_ids: [] as string[],
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };

  const actionPlanRpcJson = {
    id: 'plan-1',
    organization_id: 'org-1',
    origin_indicator: 'Adesao',
    issue_description: 'Baixa adesao',
    action_text: 'Comunicar',
    owner_name: 'Marina',
    due_date: '2026-08-20',
    priority: 'Alta',
    action_status: 'Planejado',
    status: 'ativo',
    version: 1,
    scope_type: 'organization',
    unit_id: null,
    unit_applicability: 'all_units',
    unit_ids: [] as string[],
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };

  const campaignRow = {
    id: 'camp-1',
    organization_id: 'org-1',
    title: 'Campanha',
    description: 'Desc',
    channel: 'email',
    starts_at: '2026-08-01',
    ends_at: '2026-08-15',
    campaign_status: 'Rascunho',
    status: 'ativo',
    version: 1,
    scope_type: 'organization',
    unit_id: null,
    unit_applicability: 'all_units',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };

  const actionPlanRow = {
    id: 'plan-1',
    organization_id: 'org-1',
    origin_indicator: 'Adesao',
    issue_description: 'Baixa adesao',
    action_text: 'Comunicar',
    owner_name: 'Marina',
    due_date: '2026-08-20',
    priority: 'Alta',
    action_status: 'Planejado',
    status: 'ativo',
    version: 1,
    scope_type: 'organization',
    unit_id: null,
    unit_applicability: 'all_units',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };

  function eqChain(final: unknown) {
    const chain: {
      eq: (col: string, val: unknown) => typeof chain;
      order: () => Promise<unknown>;
      maybeSingle: () => Promise<unknown>;
      select: (cols: string) => typeof chain;
      in: () => Promise<unknown>;
      filters: Array<[string, unknown]>;
    } = {
      filters: [],
      eq(col, val) {
        chain.filters.push([col, val]);
        return chain;
      },
      order: () => Promise.resolve(final),
      maybeSingle: () => Promise.resolve(final),
      select: () => chain,
      in: () => Promise.resolve(final),
    };
    return chain;
  }

  function makeClient(handlers: {
    getUser?: () => Promise<{
      data: { user: { id?: string } | null };
      error: null | { code?: string; message?: string };
    }>;
    fromImpl?: (table: string) => unknown;
    rpcImpl?: (
      fn: string,
      args?: Record<string, unknown>
    ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
  }) {
    return {
      auth: {
        getUser:
          handlers.getUser ??
          (() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: (table: string) => {
        if (handlers.fromImpl) return handlers.fromImpl(table);
        throw new Error(`unexpected table ${table}`);
      },
      rpc:
        handlers.rpcImpl ??
        ((fn: string) => {
          throw new Error(`unexpected rpc ${fn}`);
        }),
    };
  }

  it('mapeia 42501 como CROSS_TENANT_DATA (autorizacao)', async () => {
    const client = makeClient({
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }),
          }),
        }),
      }),
    });
    const repo = createSupabaseCollectiveRepository({ client: client as never });
    const result = await repo.listCampaigns({ context: ctx() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CROSS_TENANT_DATA');
    expect(result.error.kind).toBe('authorization');
  });

  it('retorna lista vazia legitima sem converter em mock', async () => {
    const client = makeClient({
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });
    const repo = createSupabaseCollectiveRepository({ client: client as never });
    const result = await repo.listCampaigns({ context: ctx() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('falha IDENTITY_MISMATCH quando sessao diverge', async () => {
    const client = makeClient({
      getUser: () => Promise.resolve({ data: { user: { id: 'other-user' } }, error: null }),
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });
    const repo = createSupabaseCollectiveRepository({ client: client as never });
    const result = await repo.listCampaigns({ context: ctx() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('IDENTITY_MISMATCH');
  });

  it('falha NO_SESSION sem usuario autenticado', async () => {
    const client = makeClient({
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    });
    const repo = createSupabaseCollectiveRepository({ client: client as never });
    const result = await repo.listCampaigns({ context: ctx() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_SESSION');
  });

  describe('campaigns via rpc atomico', () => {
    it('createCampaign chama rpc e mapeia resposta sem segundo get', async () => {
      const rpc = vi.fn(() => Promise.resolve({ data: campaignRpcJson, error: null }));
      let selectGetCount = 0;
      const client = makeClient({
        rpcImpl: rpc,
        fromImpl: (table) => {
          if (table === 'campaigns') {
            return {
              select: () => {
                selectGetCount += 1;
                return eqChain({ data: campaignRow, error: null });
              },
            };
          }
          throw new Error(`unexpected ${table}`);
        },
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.createCampaign(ctx(), {
        ...campaignBase,
        scope: selectedUnitsScope,
        audience: { audienceLabel: 'Grupo' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.id).toBe('camp-1');
      expect(selectGetCount).toBe(0);
      expect(rpc).toHaveBeenCalledTimes(1);
      const createCall = rpc.mock.calls[0] as unknown as [string, { p_payload: Record<string, unknown> }];
      expect(createCall[0]).toBe('collective_create_campaign_atomic');
      expect(createCall[1].p_payload).toMatchObject({
        organization_id: 'org-1',
        unit_applicability: 'selected_units',
        unit_ids: ['unit-1'],
        audience: { audience_label: 'Grupo' },
      });
    });

    it('updateCampaign faz get uma vez depois rpc; sem post-get', async () => {
      const updated = {
        ...campaignRpcJson,
        title: 'Atualizada',
        version: 2,
        audience: { audience_label: 'Nova' },
      };
      const rpc = vi.fn(() => Promise.resolve({ data: updated, error: null }));
      let selectCalls = 0;
      const client = makeClient({
        rpcImpl: rpc,
        fromImpl: (table) => {
          if (table === 'campaigns') {
            return {
              select: () => {
                selectCalls += 1;
                return eqChain({ data: campaignRow, error: null });
              },
            };
          }
          if (table === 'campaign_unit_applicabilities') {
            return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
          }
          if (table === 'campaign_audiences') {
            return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
          }
          throw new Error(`unexpected ${table}`);
        },
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.updateCampaign(ctx(), {
        organizationId: 'org-1',
        campaignId: 'camp-1',
        title: 'Atualizada',
        audience: { audienceLabel: 'Nova' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.title).toBe('Atualizada');
      expect(result.data.audience?.audienceLabel).toBe('Nova');
      expect(selectCalls).toBe(1);
      expect(rpc).toHaveBeenCalledTimes(1);
      const updateCall = rpc.mock.calls[0] as unknown as [string, { p_payload: Record<string, unknown> }];
      expect(updateCall[0]).toBe('collective_update_campaign_atomic');
      expect(updateCall[1].p_payload).toMatchObject({
        campaign_id: 'camp-1',
        expected_version: 1,
        title: 'Atualizada',
        audience: { audience_label: 'Nova' },
      });
    });

    it('deleteCampaign rpc: matching id → ok; zero/null → erro', async () => {
      const rpcOk = vi.fn(() => Promise.resolve({ data: { id: 'camp-1' }, error: null }));
      const repoOk = createSupabaseCollectiveRepository({
        client: makeClient({ rpcImpl: rpcOk }) as never,
      });
      const okResult = await repoOk.deleteCampaign(ctx(), 'camp-1');
      expect(okResult.ok).toBe(true);
      if (!okResult.ok) return;
      expect(okResult.data.id).toBe('camp-1');
      expect(rpcOk).toHaveBeenCalledWith('collective_delete_campaign_atomic', {
        p_organization_id: 'org-1',
        p_campaign_id: 'camp-1',
      });

      const rpcNull = vi.fn(() => Promise.resolve({ data: null, error: null }));
      const repoNull = createSupabaseCollectiveRepository({
        client: makeClient({ rpcImpl: rpcNull }) as never,
      });
      const nullResult = await repoNull.deleteCampaign(ctx(), 'camp-1');
      expect(nullResult.ok).toBe(false);
      if (nullResult.ok) return;
      expect(nullResult.error.code).toBe('AUTHORIZATION_DENIED');

      const rpcMismatch = vi.fn(() => Promise.resolve({ data: { id: 'other' }, error: null }));
      const repoMismatch = createSupabaseCollectiveRepository({
        client: makeClient({ rpcImpl: rpcMismatch }) as never,
      });
      const mismatch = await repoMismatch.deleteCampaign(ctx(), 'camp-1');
      expect(mismatch.ok).toBe(false);
      if (mismatch.ok) return;
      expect(mismatch.error.code).toBe('AUTHORIZATION_DENIED');
    });

    it('42501 → CROSS_TENANT_DATA', async () => {
      const client = makeClient({
        rpcImpl: () =>
          Promise.resolve({
            data: null,
            error: { code: '42501', message: 'permission denied' },
          }),
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.createCampaign(ctx(), {
        ...campaignBase,
        scope: allUnitsScope,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CROSS_TENANT_DATA');
    });

    it("COLLECTIVE:NO_ACTIVE_MEMBERSHIP → NO_ACTIVE_MEMBERSHIP (P3 debt)", async () => {
      const client = makeClient({
        rpcImpl: () =>
          Promise.resolve({
            data: null,
            error: { code: 'P0001', message: 'COLLECTIVE:NO_ACTIVE_MEMBERSHIP' },
          }),
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.createCampaign(ctx(), {
        ...campaignBase,
        scope: allUnitsScope,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NO_ACTIVE_MEMBERSHIP');
    });

    it('COLLECTIVE:CONFLICT → CONFLICT (version via rpc)', async () => {
      const rpc = vi.fn(() =>
        Promise.resolve({
          data: null,
          error: { code: 'P0001', message: 'COLLECTIVE:CONFLICT' },
        })
      );
      const client = makeClient({
        rpcImpl: rpc,
        fromImpl: (table) => {
          if (table === 'campaigns') {
            return { select: () => eqChain({ data: campaignRow, error: null }) };
          }
          if (table === 'campaign_unit_applicabilities') {
            return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
          }
          if (table === 'campaign_audiences') {
            return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
          }
          throw new Error(`unexpected ${table}`);
        },
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.updateCampaign(ctx(), {
        organizationId: 'org-1',
        campaignId: 'camp-1',
        title: 'X',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CONFLICT');
    });

    it('erro tecnico sanitizado e sem fallback mock', async () => {
      const client = makeClient({
        rpcImpl: () =>
          Promise.resolve({
            data: null,
            error: {
              code: 'XX000',
              message: 'disk full internal path /var/lib/postgresql/secret',
            },
          }),
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.createCampaign(ctx(), {
        ...campaignBase,
        scope: allUnitsScope,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('TECHNICAL_ERROR');
      expect(result.error.cause?.message?.length).toBeLessThanOrEqual(240);
      expect(result).not.toHaveProperty('data');
      expect(result.error.cause?.message).not.toMatch(/mock/i);
    });
  });

  describe('action plans via rpc atomico', () => {
    it('createActionPlan chama rpc e mapeia sem segundo get', async () => {
      const rpc = vi.fn(() => Promise.resolve({ data: actionPlanRpcJson, error: null }));
      let selectGetCount = 0;
      const client = makeClient({
        rpcImpl: rpc,
        fromImpl: (table) => {
          if (table === 'action_plans') {
            return {
              select: () => {
                selectGetCount += 1;
                return eqChain({ data: actionPlanRow, error: null });
              },
            };
          }
          throw new Error(`unexpected ${table}`);
        },
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.createActionPlan(ctx(), {
        organizationId: 'org-1',
        originIndicator: 'Adesao',
        issueDescription: 'Baixa adesao',
        actionText: 'Comunicar',
        ownerName: 'Marina',
        dueDate: '2026-08-20',
        priority: 'Alta',
        scope: selectedUnitsScope,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.id).toBe('plan-1');
      expect(selectGetCount).toBe(0);
      expect(rpc).toHaveBeenCalledTimes(1);
      const createPlanCall = rpc.mock.calls[0] as unknown as [
        string,
        { p_payload: Record<string, unknown> },
      ];
      expect(createPlanCall[0]).toBe('collective_create_action_plan_atomic');
      expect(createPlanCall[1].p_payload).toMatchObject({
        unit_applicability: 'selected_units',
        unit_ids: ['unit-1'],
      });
    });

    it('updateActionPlan get uma vez + rpc; sem post-get', async () => {
      const updated = { ...actionPlanRpcJson, action_text: 'Novo', version: 2 };
      const rpc = vi.fn(() => Promise.resolve({ data: updated, error: null }));
      let selectCalls = 0;
      const client = makeClient({
        rpcImpl: rpc,
        fromImpl: (table) => {
          if (table === 'action_plans') {
            return {
              select: () => {
                selectCalls += 1;
                return eqChain({ data: actionPlanRow, error: null });
              },
            };
          }
          if (table === 'action_plan_unit_applicabilities') {
            return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
          }
          throw new Error(`unexpected ${table}`);
        },
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.updateActionPlan(ctx(), {
        organizationId: 'org-1',
        actionPlanId: 'plan-1',
        actionText: 'Novo',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.actionText).toBe('Novo');
      expect(selectCalls).toBe(1);
      expect(rpc).toHaveBeenCalledTimes(1);
      const updatePlanCall = rpc.mock.calls[0] as unknown as [
        string,
        { p_payload: Record<string, unknown> },
      ];
      expect(updatePlanCall[0]).toBe('collective_update_action_plan_atomic');
      expect(updatePlanCall[1].p_payload).toMatchObject({
        action_plan_id: 'plan-1',
        expected_version: 1,
      });
    });

    it('deleteActionPlan rpc: matching id → ok; zero/null → erro', async () => {
      const rpcOk = vi.fn(() => Promise.resolve({ data: { id: 'plan-1' }, error: null }));
      const repoOk = createSupabaseCollectiveRepository({
        client: makeClient({ rpcImpl: rpcOk }) as never,
      });
      const okResult = await repoOk.deleteActionPlan(ctx(), 'plan-1');
      expect(okResult.ok).toBe(true);
      if (!okResult.ok) return;
      expect(okResult.data.id).toBe('plan-1');

      const rpcNull = vi.fn(() => Promise.resolve({ data: null, error: null }));
      const repoNull = createSupabaseCollectiveRepository({
        client: makeClient({ rpcImpl: rpcNull }) as never,
      });
      const nullResult = await repoNull.deleteActionPlan(ctx(), 'plan-1');
      expect(nullResult.ok).toBe(false);
      if (nullResult.ok) return;
      expect(nullResult.error.code).toBe('AUTHORIZATION_DENIED');
    });

    it('42501 → CROSS_TENANT_DATA', async () => {
      const client = makeClient({
        rpcImpl: () =>
          Promise.resolve({
            data: null,
            error: { code: '42501', message: 'permission denied' },
          }),
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.createActionPlan(ctx(), {
        organizationId: 'org-1',
        originIndicator: 'Adesao',
        issueDescription: 'Baixa adesao',
        actionText: 'Comunicar',
        ownerName: 'Marina',
        dueDate: '2026-08-20',
        priority: 'Alta',
        scope: allUnitsScope,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CROSS_TENANT_DATA');
    });

    it("COLLECTIVE:NO_ACTIVE_MEMBERSHIP → NO_ACTIVE_MEMBERSHIP", async () => {
      const client = makeClient({
        rpcImpl: () =>
          Promise.resolve({
            data: null,
            error: { message: 'COLLECTIVE:NO_ACTIVE_MEMBERSHIP' },
          }),
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.createActionPlan(ctx(), {
        organizationId: 'org-1',
        originIndicator: 'Adesao',
        issueDescription: 'Baixa adesao',
        actionText: 'Comunicar',
        ownerName: 'Marina',
        dueDate: '2026-08-20',
        priority: 'Alta',
        scope: allUnitsScope,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NO_ACTIVE_MEMBERSHIP');
    });

    it('COLLECTIVE:CONFLICT → CONFLICT', async () => {
      const client = makeClient({
        rpcImpl: () =>
          Promise.resolve({
            data: null,
            error: { code: 'P0001', message: 'COLLECTIVE:CONFLICT' },
          }),
        fromImpl: (table) => {
          if (table === 'action_plans') {
            return { select: () => eqChain({ data: actionPlanRow, error: null }) };
          }
          if (table === 'action_plan_unit_applicabilities') {
            return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
          }
          throw new Error(`unexpected ${table}`);
        },
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.updateActionPlan(ctx(), {
        organizationId: 'org-1',
        actionPlanId: 'plan-1',
        actionText: 'X',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CONFLICT');
    });

    it('erro tecnico sanitizado sem fallback mock', async () => {
      const client = makeClient({
        rpcImpl: () =>
          Promise.resolve({
            data: null,
            error: { code: 'XX000', message: 'boom internal' },
          }),
      });
      const repo = createSupabaseCollectiveRepository({ client: client as never });
      const result = await repo.createActionPlan(ctx(), {
        organizationId: 'org-1',
        originIndicator: 'Adesao',
        issueDescription: 'Baixa adesao',
        actionText: 'Comunicar',
        ownerName: 'Marina',
        dueDate: '2026-08-20',
        priority: 'Alta',
        scope: allUnitsScope,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('TECHNICAL_ERROR');
      expect(result).not.toHaveProperty('data');
    });
  });
});
