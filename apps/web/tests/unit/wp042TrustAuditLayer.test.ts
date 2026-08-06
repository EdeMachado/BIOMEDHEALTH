import { describe, expect, it, vi } from 'vitest';
import { newCorrelationId, toDbResult, fromDbResult } from '@/domains/audit/auditContract';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';
import {
  auditedCreateCampaign,
  auditedDeleteCampaign,
  auditedUpdateCampaign,
  auditedCreateActionPlan,
  auditedDeleteActionPlan,
  auditedUpdateActionPlan,
  type AuditedCollectiveDeps,
} from '@/application/collective/auditedCollectiveMutations';
import { createNoopCollectiveAuditSink, type CollectiveAuditSink } from '@/domains/collective/collectiveAuditSink';
import { ok, fail } from '@/services/repositories/collective/errors';
import type { CampaignRecord, ActionPlanRecord, CollectiveRepository } from '@/services/repositories/collective';

function baseCampaign(overrides: Partial<CampaignRecord> = {}): CampaignRecord {
  return {
    id: 'camp-1',
    organizationId: 'org-1',
    title: 'Campanha',
    description: 'Desc',
    channel: 'email',
    startsAt: '2026-01-01',
    endsAt: '2026-01-31',
    campaignStatus: 'Ativa',
    status: 'ativo',
    scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function basePlan(overrides: Partial<ActionPlanRecord> = {}): ActionPlanRecord {
  return {
    id: 'plan-1',
    organizationId: 'org-1',
    originIndicator: 'adesao',
    issueDescription: 'issue',
    actionText: 'action',
    ownerName: 'Owner',
    dueDate: '2026-02-01',
    priority: 'Alta',
    actionStatus: 'Planejado',
    status: 'ativo',
    scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function recordingSink() {
  const calls: Array<Record<string, unknown>> = [];
  const sink: CollectiveAuditSink = {
    registerFinal(input) {
      calls.push({ ...input });
      return Promise.resolve({ ok: true, correlationId: input.correlationId ?? newCorrelationId() });
    },
  };
  return { sink, calls };
}

function deps(partial: Partial<AuditedCollectiveDeps> & { repository: CollectiveRepository }): AuditedCollectiveDeps {
  return {
    context: { userId: 'u1', organizationId: 'org-1', selectedUnitId: null },
    canWrite: true,
    actor: { actorEmail: 'g@demo.test', actorRole: 'gestor_institucional', organizationId: 'org-1' },
    auditSink: createNoopCollectiveAuditSink(),
    ...partial,
  };
}

const campaignInput = {
  organizationId: 'org-1',
  title: 'Campanha',
  description: 'Desc',
  channel: 'email',
  startsAt: '2026-01-01',
  endsAt: '2026-01-31',
  scope: { scopeType: 'organization' as const, unitId: null, unitApplicability: 'all_units' as const },
};

describe('auditContract', () => {
  it('mapeia resultados canonicos', () => {
    expect(toDbResult('success')).toBe('sucesso');
    expect(toDbResult('error')).toBe('falha');
    expect(toDbResult('denied')).toBe('negado');
    expect(fromDbResult('sucesso')).toBe('success');
  });

  it('gera correlationId deterministico no formato', () => {
    const id = newCorrelationId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});

describe('sanitizeAuditMetadata allowlist', () => {
  const corr = 'corr12345678abcdef';

  it('aceita metadata permitida coletiva', () => {
    const meta = sanitizeAuditMetadata({
      code: 'campaign_created',
      entity: 'campaign',
      correlationId: corr,
      result: 'sucesso',
      source: 'collective',
      metadata: { error_code: 'NOT_FOUND', previous_status: 'Planejado', next_status: 'Em andamento' },
    });
    expect(meta.reason).toContain('src=collective');
    expect(meta.reason).toContain('error_code=NOT_FOUND');
  });

  it('rejeita chave nao allowlist e objetos aninhados', () => {
    expect(() =>
      sanitizeAuditMetadata({
        code: 'campaign_created',
        entity: 'campaign',
        correlationId: corr,
        result: 'sucesso',
        metadata: { patient_name: 'Maria' },
      })
    ).toThrow(/chave nao permitida/);

    expect(() =>
      sanitizeAuditMetadata({
        code: 'campaign_created',
        entity: 'campaign',
        correlationId: corr,
        result: 'sucesso',
        metadata: { error_code: { nested: true } as unknown as string },
      })
    ).toThrow(/objetos aninhados/);
  });

  it('rejeita excesso de campos e valores longos', () => {
    const many = {
      error_code: 'a',
      scope_type: 'b',
      campaign_status: 'c',
      action_status: 'd',
      repository_mode: 'e',
      previous_status: 'f',
      next_status: 'g',
      extra_key: 'h',
      another: 'i',
    } as Record<string, string>;
    expect(() =>
      sanitizeAuditMetadata({
        code: 'campaign_created',
        entity: 'campaign',
        correlationId: corr,
        result: 'sucesso',
        metadata: many,
      })
    ).toThrow(/excesso|chave nao permitida/);

    expect(() =>
      sanitizeAuditMetadata({
        code: 'campaign_created',
        entity: 'campaign',
        correlationId: corr,
        result: 'sucesso',
        metadata: { error_code: 'x'.repeat(65) },
      })
    ).toThrow(/excede limite/);
  });

  it('bloqueia PHI/PII em rawReason e metadata', () => {
    expect(() =>
      sanitizeAuditMetadata({
        code: 'campaign_created',
        entity: 'campaign',
        correlationId: corr,
        result: 'sucesso',
        rawReason: 'email=paciente@teste.com',
      })
    ).toThrow(/bloqueado/);

    expect(() =>
      sanitizeAuditMetadata({
        code: 'campaign_created',
        entity: 'campaign',
        correlationId: corr,
        result: 'sucesso',
        metadata: { error_code: 'cpf=123' },
      })
    ).toThrow(/bloqueado/);
  });

  it('exige correlationId e source fechada', () => {
    expect(() =>
      sanitizeAuditMetadata({
        code: 'campaign_created',
        entity: 'campaign',
        result: 'sucesso',
      })
    ).toThrow(/correlationId obrigatorio/);

    expect(() =>
      sanitizeAuditMetadata({
        code: 'campaign_created',
        entity: 'campaign',
        correlationId: corr,
        result: 'sucesso',
        source: 'unknown' as 'application',
      })
    ).toThrow(/source invalida/);
  });
});

describe('audited collective mutations', () => {
  it('create campaign success registra um evento', async () => {
    const { sink, calls } = recordingSink();
    const repository = {
      createCampaign: vi.fn(() => Promise.resolve(ok(baseCampaign()))),
    } as unknown as CollectiveRepository;

    const result = await auditedCreateCampaign(deps({ repository, auditSink: sink }), campaignInput);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ code: 'campaign_created', result: 'success', entity: 'campaign' });
  });

  it('update/delete campaign success', async () => {
    const { sink, calls } = recordingSink();
    const repository = {
      updateCampaign: vi.fn(() => Promise.resolve(ok(baseCampaign({ campaignStatus: 'Encerrada' })))),
      deleteCampaign: vi.fn(() => Promise.resolve(ok({ id: 'camp-1' }))),
    } as unknown as CollectiveRepository;

    await auditedUpdateCampaign(
      deps({ repository, auditSink: sink }),
      { organizationId: 'org-1', campaignId: 'camp-1', campaignStatus: 'Encerrada' },
      { closed: true }
    );
    await auditedDeleteCampaign(deps({ repository, auditSink: sink }), 'camp-1');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ code: 'campaign_closed', result: 'success' });
    expect(calls[1]).toMatchObject({ code: 'campaign_deleted', result: 'success' });
  });

  it('action plan create/update/delete + advance', async () => {
    const { sink, calls } = recordingSink();
    const repository = {
      createActionPlan: vi.fn(() => Promise.resolve(ok(basePlan()))),
      updateActionPlan: vi.fn(() => Promise.resolve(ok(basePlan({ actionStatus: 'Em andamento' })))),
      deleteActionPlan: vi.fn(() => Promise.resolve(ok({ id: 'plan-1' }))),
    } as unknown as CollectiveRepository;

    await auditedCreateActionPlan(deps({ repository, auditSink: sink }), {
      organizationId: 'org-1',
      originIndicator: 'adesao',
      issueDescription: 'issue',
      actionText: 'action',
      ownerName: 'Owner',
      dueDate: '2026-02-01',
      priority: 'Alta',
      scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
    });
    await auditedUpdateActionPlan(
      deps({ repository, auditSink: sink }),
      { organizationId: 'org-1', actionPlanId: 'plan-1', actionStatus: 'Em andamento' },
      { advanced: true, previousStatus: 'Planejado', nextStatus: 'Em andamento' }
    );
    await auditedDeleteActionPlan(deps({ repository, auditSink: sink }), 'plan-1');
    expect(calls).toHaveLength(3);
    expect(calls[1]).toMatchObject({ code: 'action_plan_status_advanced', result: 'success' });
  });

  it('denied por papel e por ausencia de contexto', async () => {
    const { sink, calls } = recordingSink();
    const createCampaign = vi.fn(() => Promise.resolve(ok(baseCampaign())));
    const repository = { createCampaign } as unknown as CollectiveRepository;

    const deniedRole = await auditedCreateCampaign(
      deps({ repository, auditSink: sink, canWrite: false }),
      campaignInput
    );
    expect(deniedRole.ok).toBe(false);
    if (!deniedRole.ok) expect(deniedRole.error.code).toBe('AUTHORIZATION_DENIED');

    const deniedCtx = await auditedCreateCampaign(
      deps({ repository, auditSink: sink, context: null }),
      campaignInput
    );
    expect(deniedCtx.ok).toBe(false);
    if (!deniedCtx.ok) expect(deniedCtx.error.code).toBe('NO_SESSION');
    expect(calls.every((c) => c['result'] === 'denied')).toBe(true);
    expect(createCampaign).not.toHaveBeenCalled();
  });

  it('repository error vira evento error e nao success', async () => {
    const { sink, calls } = recordingSink();
    const repository = {
      createCampaign: vi.fn(() => Promise.resolve(fail('NOT_FOUND'))),
    } as unknown as CollectiveRepository;
    const result = await auditedCreateCampaign(deps({ repository, auditSink: sink }), campaignInput);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ code: 'repository_error', result: 'error' });
    expect(calls[0]?.['metadata']).toMatchObject({ error_code: 'NOT_FOUND' });
  });

  it('sink error apos sucesso falha fechado (AUDIT_REQUIRED_FAILED)', async () => {
    const sink: CollectiveAuditSink = {
      registerFinal() {
        return Promise.resolve({ ok: false, message: 'rpc down' });
      },
    };
    const repository = {
      createCampaign: vi.fn(() => Promise.resolve(ok(baseCampaign()))),
    } as unknown as CollectiveRepository;
    const result = await auditedCreateCampaign(deps({ repository, auditSink: sink }), campaignInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AUDIT_REQUIRED_FAILED');
  });

  it('nao dispara auditoria sem chamada de mutacao (apenas deps)', () => {
    const { calls } = recordingSink();
    expect(calls).toHaveLength(0);
  });
});
