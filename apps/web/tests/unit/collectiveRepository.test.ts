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

describe('SUP-D01-C collective repository mode', () => {
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
    expect(() => createCollectiveRepositoryFactory({ mode: 'supabase' })).toThrow(
      /exige client/
    );
  });
});

describe('SUP-D01-C atomicidade e validacao', () => {
  it('detecta writes multi-tabela', () => {
    expect(requiresMultiTableWrite(allUnitsScope)).toBe(false);
    expect(requiresMultiTableWrite(unitScope)).toBe(false);
    expect(requiresMultiTableWrite(selectedUnitsScope)).toBe(true);
    expect(requiresMultiTableWrite(allUnitsScope, true)).toBe(true);
  });

  it('rejeita create selected_units com ATOMICITY_REQUIRED', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      organizationId: 'org-1',
      title: 'Camp',
      description: 'Desc',
      channel: 'email',
      startsAt: '2026-08-01',
      endsAt: '2026-08-15',
      scope: selectedUnitsScope,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ATOMICITY_REQUIRED');
  });

  it('rejeita audiencia no create', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      organizationId: 'org-1',
      title: 'Camp',
      description: 'Desc',
      channel: 'email',
      startsAt: '2026-08-01',
      endsAt: '2026-08-15',
      scope: allUnitsScope,
      audience: { audienceLabel: 'Adultos' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ATOMICITY_REQUIRED');
  });

  it('rejeita organizationId conflitante', () => {
    const result = validateCreateCampaignWrite(ctx(), {
      organizationId: 'org-other',
      title: 'Camp',
      description: 'Desc',
      channel: 'email',
      startsAt: '2026-08-01',
      endsAt: '2026-08-15',
      scope: allUnitsScope,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CROSS_TENANT_DATA');
  });

  it('bloqueia limpeza selected_units → all_units sem RPC', () => {
    const result = validateUpdateCampaignWrite(
      ctx(),
      {
        organizationId: 'org-1',
        campaignId: 'c1',
        scope: allUnitsScope,
      },
      selectedUnitsScope
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ATOMICITY_REQUIRED');
  });

  it('aceita create all_units e unit', () => {
    expect(
      validateCreateCampaignWrite(ctx(), {
        organizationId: 'org-1',
        title: 'Camp',
        description: 'Desc',
        channel: 'email',
        startsAt: '2026-08-01',
        endsAt: '2026-08-15',
        scope: allUnitsScope,
      }).ok
    ).toBe(true);
    expect(
      validateCreateCampaignWrite(ctx(), {
        organizationId: 'org-1',
        title: 'Camp',
        description: 'Desc',
        channel: 'email',
        startsAt: '2026-08-01',
        endsAt: '2026-08-15',
        scope: unitScope,
      }).ok
    ).toBe(true);
  });

  it('rejeita action plan selected_units', () => {
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
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ATOMICITY_REQUIRED');
  });
});

describe('SUP-D01-C mock collective repository', () => {
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
      organizationId: 'org-1',
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

    const deleted = await repo.deleteCampaign(ctx(), created.data.id);
    expect(deleted.ok).toBe(true);
    const missing = await repo.getCampaign(ctx(), created.data.id);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('nao mascara ATOMICITY_REQUIRED como sucesso', async () => {
    const repo = createMockCollectiveRepository();
    const result = await repo.createCampaign(ctx(), {
      organizationId: 'org-1',
      title: 'X',
      description: 'Y',
      channel: 'email',
      startsAt: '2026-08-01',
      endsAt: '2026-08-15',
      scope: selectedUnitsScope,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ATOMICITY_REQUIRED');
  });

  it('CRUD de planos all_units', async () => {
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
    const listed = await repo.listActionPlans({ context: ctx() });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.some((p) => p.id === created.data.id)).toBe(true);
  });
});

describe('SUP-D01-C supabase collective repository', () => {
  function makeClient(handlers: {
    getUser?: () => Promise<{ data: { user: { id?: string } | null }; error: null | { code?: string; message?: string } }>;
    fromImpl?: (table: string) => unknown;
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
    };
  }

  it('mapeia 42501 como CROSS_TENANT_DATA (autorizacao)', async () => {
    const client = makeClient({
      fromImpl: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } }),
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

  it('create all_units persiste e nao cai para mock apos erro tecnico', async () => {
    const insert = vi.fn(() => ({
      select: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: { code: 'XX000', message: 'boom' } }),
      }),
    }));
    const client = makeClient({
      fromImpl: () => ({ insert }),
    });
    const repo = createSupabaseCollectiveRepository({ client: client as never });
    const result = await repo.createCampaign(ctx(), {
      organizationId: 'org-1',
      title: 'X',
      description: 'Y',
      channel: 'email',
      startsAt: '2026-08-01',
      endsAt: '2026-08-15',
      scope: allUnitsScope,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TECHNICAL_ERROR');
    expect(insert).toHaveBeenCalled();
  });

  it('bloqueia selected_units antes de qualquer escrita', async () => {
    const insert = vi.fn();
    const client = makeClient({
      fromImpl: () => ({ insert }),
    });
    const repo = createSupabaseCollectiveRepository({ client: client as never });
    const result = await repo.createCampaign(ctx(), {
      organizationId: 'org-1',
      title: 'X',
      description: 'Y',
      channel: 'email',
      startsAt: '2026-08-01',
      endsAt: '2026-08-15',
      scope: selectedUnitsScope,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ATOMICITY_REQUIRED');
    expect(insert).not.toHaveBeenCalled();
  });
});
