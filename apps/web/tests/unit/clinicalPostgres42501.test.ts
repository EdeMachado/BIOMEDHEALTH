import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLINICAL_INSUFFICIENT_PRIVILEGE_ERROR_CODE,
  CLINICAL_INSUFFICIENT_PRIVILEGE_KIND,
  CLINICAL_INSUFFICIENT_PRIVILEGE_TRANSIENT,
  classifyPostgresInsufficientPrivilege,
  isPostgresInsufficientPrivilege,
  POSTGRES_INSUFFICIENT_PRIVILEGE_SQLSTATE,
} from '@/services/repositories/clinical/postgresInsufficientPrivilege';
import {
  evaluateClinicalFallback,
  type ClinicalFallbackPolicy,
} from '@/services/repositories/clinical/fallbackPolicy';
import { instrumentClinicalRepository } from '@/services/repositories/clinical/instrumentRepository';
import type { ClinicalObservabilityEvent } from '@/services/repositories/clinical/observability';
import { createSupabaseCarePlanRepository } from '@/services/repositories/carePlan/supabaseCarePlanRepository';
import { createSupabaseClinicalRecordRepository } from '@/services/repositories/clinicalRecord/supabaseClinicalRecordRepository';
import { createSupabaseClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/supabaseClinicalAgendaRepository';
import { createSupabaseClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/supabaseClinicalPortfolioRepository';
import { createClinicalPortfolioRepositoryFactory } from '@/services/repositories/clinicalPortfolio/factory';
import { createClinicalRecordRepositoryFactory } from '@/services/repositories/clinicalRecord/factory';
import { createCarePlanRepositoryFactory } from '@/services/repositories/carePlan/factory';
import { createClinicalAgendaRepositoryFactory } from '@/services/repositories/clinicalAgenda/factory';

const context = {
  sessionUserId: 'pro-1',
  professionalUserId: 'pro-1',
  organizationId: 'org-1',
};

function assertCanonicalAuthorizationDenial(error: {
  code: string;
  kind: string;
  transient: boolean;
}) {
  expect(error.code).toBe('CROSS_TENANT_DATA');
  expect(error.kind).toBe('authorization');
  expect(error.transient).toBe(false);
  expect(error.code).not.toBe('PLAN_CLOSED');
  expect(error.code).not.toBe('RECORD_CONCLUDED');
  expect(error.code).not.toBe('TECHNICAL_ERROR');
}

function createRpcErrorClient(forcedError: { code?: string; message?: string }) {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'pro-1' } }, error: null }),
    },
    rpc: () => Promise.resolve({ data: null, error: forcedError }),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
                order: () => Promise.resolve({ data: [], error: null }),
              }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
              order: () => Promise.resolve({ data: [], error: null }),
            }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  };
}

describe('clinical postgres 42501 source of truth', () => {
  it('classifies 42501 as CROSS_TENANT_DATA authorization non-transient', () => {
    expect(isPostgresInsufficientPrivilege('42501')).toBe(true);
    expect(isPostgresInsufficientPrivilege('42501'.toLowerCase())).toBe(true);
    expect(isPostgresInsufficientPrivilege('P0001')).toBe(false);
    expect(isPostgresInsufficientPrivilege(undefined)).toBe(false);

    const classification = classifyPostgresInsufficientPrivilege();
    expect(classification).toEqual({
      code: CLINICAL_INSUFFICIENT_PRIVILEGE_ERROR_CODE,
      kind: CLINICAL_INSUFFICIENT_PRIVILEGE_KIND,
      transient: CLINICAL_INSUFFICIENT_PRIVILEGE_TRANSIENT,
    });
    expect(classification.code).toBe('CROSS_TENANT_DATA');
    expect(classification.kind).toBe('authorization');
    expect(classification.transient).toBe(false);
    expect(POSTGRES_INSUFFICIENT_PRIVILEGE_SQLSTATE).toBe('42501');
  });
});

describe('care plan mapBackendError 42501 normalization', () => {
  it('maps pure 42501 to CROSS_TENANT_DATA and not PLAN_CLOSED', async () => {
    const repository = createSupabaseCarePlanRepository({
      client: createRpcErrorClient({
        code: '42501',
        message: 'permission denied for table care_plans',
      }) as never,
    });
    const result = await repository.listCarePlans({ context, patientId: 'usr-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    assertCanonicalAuthorizationDenial(result.error);
    expect(result.error.code).not.toBe('PLAN_CLOSED');
  });

  it('maps 42501 with imutavel/encerrado message to authorization, not PLAN_CLOSED', async () => {
    const repository = createSupabaseCarePlanRepository({
      client: createRpcErrorClient({
        code: '42501',
        message: 'plano encerrado imutavel',
      }) as never,
    });
    const result = await repository.listCarePlans({ context, patientId: 'usr-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    assertCanonicalAuthorizationDenial(result.error);
  });

  it('keeps PLAN_CLOSED for imutavel/encerrado message without 42501', async () => {
    const repository = createSupabaseCarePlanRepository({
      client: createRpcErrorClient({
        message: 'plano encerrado imutavel',
      }) as never,
    });
    const result = await repository.listCarePlans({ context, patientId: 'usr-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PLAN_CLOSED');
    expect(result.error.kind).toBe('validation');
    expect(result.error.transient).toBe(false);
  });

  it('keeps TECHNICAL_ERROR transient path for network-like failures', async () => {
    const repository = createSupabaseCarePlanRepository({
      client: createRpcErrorClient({
        code: 'ETIMEDOUT',
        message: 'fetch failed: network timeout',
      }) as never,
    });
    const result = await repository.listCarePlans({ context, patientId: 'usr-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TECHNICAL_ERROR');
    expect(result.error.kind).toBe('technical');
    expect(result.error.transient).toBe(true);
  });
});

describe('clinical record mapBackendError 42501 normalization', () => {
  it('maps pure 42501 to CROSS_TENANT_DATA and not RECORD_CONCLUDED', async () => {
    const repository = createSupabaseClinicalRecordRepository({
      client: createRpcErrorClient({
        code: '42501',
        message: 'permission denied for table clinical_records',
      }) as never,
    });
    const result = await repository.getLinkedClinicalRecord({ context, patientId: 'usr-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    assertCanonicalAuthorizationDenial(result.error);
    expect(result.error.code).not.toBe('RECORD_CONCLUDED');
  });

  it('maps 42501 with imutavel message to authorization, not RECORD_CONCLUDED', async () => {
    const repository = createSupabaseClinicalRecordRepository({
      client: createRpcErrorClient({
        code: '42501',
        message: 'ficha imutavel apos conclusao',
      }) as never,
    });
    const result = await repository.getLinkedClinicalRecord({ context, patientId: 'usr-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    assertCanonicalAuthorizationDenial(result.error);
  });

  it('keeps RECORD_CONCLUDED for imutavel message without 42501', async () => {
    const repository = createSupabaseClinicalRecordRepository({
      client: createRpcErrorClient({
        message: 'ficha imutavel apos conclusao',
      }) as never,
    });
    const result = await repository.getLinkedClinicalRecord({ context, patientId: 'usr-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('RECORD_CONCLUDED');
    expect(result.error.kind).toBe('validation');
    expect(result.error.transient).toBe(false);
  });

  it('keeps TECHNICAL_ERROR for network-like failures and never from 42501', async () => {
    const repository = createSupabaseClinicalRecordRepository({
      client: createRpcErrorClient({
        code: 'ECONNRESET',
        message: 'socket hang up',
      }) as never,
    });
    const result = await repository.getLinkedClinicalRecord({ context, patientId: 'usr-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TECHNICAL_ERROR');
    expect(result.error.transient).toBe(true);

    const denied = await createSupabaseClinicalRecordRepository({
      client: createRpcErrorClient({ code: '42501', message: 'denied' }) as never,
    }).getLinkedClinicalRecord({ context, patientId: 'usr-1' });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).not.toBe('TECHNICAL_ERROR');
    expect(denied.error.transient).toBe(false);
  });
});

describe('agenda and portfolio keep canonical 42501 classification', () => {
  it('agenda maps 42501 to CROSS_TENANT_DATA authorization non-transient', async () => {
    const repository = createSupabaseClinicalAgendaRepository({
      client: createRpcErrorClient({ code: '42501', message: 'permission denied' }) as never,
    });
    const result = await repository.listLinkedClinicalAppointments({ context });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    assertCanonicalAuthorizationDenial(result.error);
  });

  it('portfolio maps 42501 to CROSS_TENANT_DATA authorization non-transient', async () => {
    const client = {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'pro-1' } }, error: null }),
      },
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { code: '42501', message: 'denied by rls' },
        }),
    };
    const repository = createSupabaseClinicalPortfolioRepository({ client });
    const result = await repository.listLinkedClinicalPatients({ context });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    assertCanonicalAuthorizationDenial(result.error);
  });
});

describe('42501 fallback and observability safety', () => {
  const enabledPolicy: ClinicalFallbackPolicy = {
    enableTransientFallback: true,
    runtime: 'non-production',
    enableMockDataFallback: true,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks fallback for CROSS_TENANT_DATA with blocked_error_code', () => {
    const decision = evaluateClinicalFallback({
      errorCode: 'CROSS_TENANT_DATA',
      transient: false,
      operationKind: 'read',
      policy: enabledPolicy,
    });
    expect(decision).toEqual({ allow: false, reason: 'blocked_error_code' });
  });

  it('emits only allowlisted observability fields for 42501-mapped denial', async () => {
    const events: ClinicalObservabilityEvent[] = [];
    const forbiddenKeys = [
      'cause',
      'stack',
      'query',
      'payload',
      'args',
      'arguments',
      'message',
      'email',
      'summary',
      'sections',
      'note',
    ];

    const denied = {
      ok: false as const,
      error: {
        code: 'CROSS_TENANT_DATA' as const,
        kind: 'authorization' as const,
        transient: false,
        message: 'permission denied for relation care_plans',
        cause: {
          source: 'repository' as const,
          code: '42501',
          message: 'permission denied for relation care_plans patient=usr-1',
        },
      },
    };

    const repo = instrumentClinicalRepository(
      {
        async listCarePlans() {
          return Promise.resolve(denied);
        },
      },
      {
        module: 'carePlan',
        mode: 'supabase',
        operationKinds: { listCarePlans: 'read' },
        fallbackPolicy: enabledPolicy,
        sink: (event) => events.push(event),
        createCorrelationId: () => 'corr-42501',
        now: (() => {
          let t = 0;
          return () => {
            t += 7;
            return t;
          };
        })(),
      }
    );

    const result = await repo.listCarePlans();
    expect(result).toBe(denied);

    const errorEvent = events.find((e) => e.type === 'repository_op_error');
    const blockedEvent = events.find((e) => e.type === 'fallback_blocked');
    expect(errorEvent).toMatchObject({
      correlationId: 'corr-42501',
      errorCode: 'CROSS_TENANT_DATA',
      errorKind: 'authorization',
      transient: false,
      durationMs: 7,
    });
    expect(blockedEvent).toMatchObject({
      correlationId: 'corr-42501',
      errorCode: 'CROSS_TENANT_DATA',
      blockReason: 'blocked_error_code',
      transient: false,
    });

    for (const event of events) {
      for (const key of forbiddenKeys) {
        expect(Object.prototype.hasOwnProperty.call(event, key)).toBe(false);
      }
      expect(JSON.stringify(event)).not.toContain('permission denied');
      expect(JSON.stringify(event)).not.toContain('patient=usr-1');
      expect(JSON.stringify(event)).not.toContain('cause');
      expect(JSON.stringify(event)).not.toContain('stack');
    }
  });

  it('factories never switch to mock for 42501-class denial path', async () => {
    const events: ClinicalObservabilityEvent[] = [];
    const sink = (event: ClinicalObservabilityEvent) => events.push(event);

    const portfolio = createClinicalPortfolioRepositoryFactory({
      mode: 'supabase',
      observabilitySink: sink,
      supabaseClient: {
        auth: {
          getUser: () => Promise.resolve({ data: { user: { id: 'pro-1' } }, error: null }),
        },
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { code: '42501', message: 'denied' },
          }),
      },
    });
    const portfolioResult = await portfolio.listLinkedClinicalPatients({ context });
    expect(portfolioResult.ok).toBe(false);
    if (!portfolioResult.ok) assertCanonicalAuthorizationDenial(portfolioResult.error);

    const record = createClinicalRecordRepositoryFactory({
      mode: 'supabase',
      observabilitySink: sink,
      supabaseClient: createRpcErrorClient({ code: '42501', message: 'denied' }) as never,
    });
    const recordResult = await record.getLinkedClinicalRecord({ context, patientId: 'usr-1' });
    expect(recordResult.ok).toBe(false);
    if (!recordResult.ok) assertCanonicalAuthorizationDenial(recordResult.error);

    const carePlan = createCarePlanRepositoryFactory({
      mode: 'supabase',
      observabilitySink: sink,
      supabaseClient: createRpcErrorClient({ code: '42501', message: 'denied' }) as never,
    });
    const carePlanResult = await carePlan.listCarePlans({ context, patientId: 'usr-1' });
    expect(carePlanResult.ok).toBe(false);
    if (!carePlanResult.ok) assertCanonicalAuthorizationDenial(carePlanResult.error);

    const agenda = createClinicalAgendaRepositoryFactory({
      mode: 'supabase',
      observabilitySink: sink,
      supabaseClient: createRpcErrorClient({ code: '42501', message: 'denied' }) as never,
    });
    const agendaResult = await agenda.listLinkedClinicalAppointments({ context });
    expect(agendaResult.ok).toBe(false);
    if (!agendaResult.ok) assertCanonicalAuthorizationDenial(agendaResult.error);

    expect(events.some((e) => e.mode === 'mock')).toBe(false);
    expect(events.every((e) => e.mode === 'supabase')).toBe(true);
    expect(
      events.filter((e) => e.type === 'fallback_blocked').every((e) => e.blockReason === 'policy_disabled')
    ).toBe(true);
  });
});
