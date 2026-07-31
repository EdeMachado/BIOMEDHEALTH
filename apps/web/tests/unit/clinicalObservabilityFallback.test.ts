import { describe, expect, it } from 'vitest';
import {
  CLINICAL_FALLBACK_BLOCKED_CODES,
  DEFAULT_CLINICAL_FALLBACK_POLICY,
  evaluateClinicalFallback,
  resolveClinicalRuntimeEnvironment,
  shouldAttemptClinicalFallback,
} from '@/services/repositories/clinical/fallbackPolicy';
import { instrumentClinicalRepository } from '@/services/repositories/clinical/instrumentRepository';
import {
  createCorrelationId,
  sanitizeObservabilityDetails,
  type ClinicalObservabilityEvent,
} from '@/services/repositories/clinical/observability';
import { createClinicalAgendaRepositoryFactory } from '@/services/repositories/clinicalAgenda/factory';
import { createCarePlanRepositoryFactory } from '@/services/repositories/carePlan/factory';

describe('clinical fallback policy (SUP-C04.2a)', () => {
  const enabledNonProd = {
    enableTransientFallback: true,
    runtime: 'non-production' as const,
    enableMockDataFallback: true,
  };

  it('defaults keep fallback disabled', () => {
    expect(DEFAULT_CLINICAL_FALLBACK_POLICY.enableTransientFallback).toBe(false);
    expect(DEFAULT_CLINICAL_FALLBACK_POLICY.enableMockDataFallback).toBe(false);
    expect(
      shouldAttemptClinicalFallback({
        errorCode: 'TECHNICAL_ERROR',
        transient: true,
        operationKind: 'read',
        policy: DEFAULT_CLINICAL_FALLBACK_POLICY,
      })
    ).toBe(false);
  });

  it('blocks all security and domain codes', () => {
    for (const errorCode of CLINICAL_FALLBACK_BLOCKED_CODES) {
      const decision = evaluateClinicalFallback({
        errorCode,
        transient: false,
        operationKind: 'read',
        policy: enabledNonProd,
      });
      expect(decision.allow).toBe(false);
      if (!decision.allow) expect(decision.reason).toBe('blocked_error_code');
    }
  });

  it('blocks write operations even for transient technical errors', () => {
    const decision = evaluateClinicalFallback({
      errorCode: 'TECHNICAL_ERROR',
      transient: true,
      operationKind: 'write',
      policy: enabledNonProd,
    });
    expect(decision).toEqual({ allow: false, reason: 'write_operation' });
  });

  it('blocks production runtime', () => {
    expect(
      evaluateClinicalFallback({
        errorCode: 'TECHNICAL_ERROR',
        transient: true,
        operationKind: 'read',
        policy: { ...enabledNonProd, runtime: 'production' },
      })
    ).toEqual({ allow: false, reason: 'production_runtime' });
  });

  it('blocks when mock data fallback flag is off', () => {
    expect(
      evaluateClinicalFallback({
        errorCode: 'TECHNICAL_ERROR',
        transient: true,
        operationKind: 'read',
        policy: { ...enabledNonProd, enableMockDataFallback: false },
      })
    ).toEqual({ allow: false, reason: 'mock_data_fallback_disabled' });
  });

  it('allows only transient TECHNICAL_ERROR reads when both flags are on', () => {
    expect(
      shouldAttemptClinicalFallback({
        errorCode: 'TECHNICAL_ERROR',
        transient: true,
        operationKind: 'read',
        policy: enabledNonProd,
      })
    ).toBe(true);
    expect(
      shouldAttemptClinicalFallback({
        errorCode: 'TECHNICAL_ERROR',
        transient: false,
        operationKind: 'read',
        policy: enabledNonProd,
      })
    ).toBe(false);
  });

  it('resolves runtime from VITE_APP_ENV', () => {
    expect(resolveClinicalRuntimeEnvironment({ VITE_APP_ENV: 'production' })).toBe('production');
    expect(resolveClinicalRuntimeEnvironment({ VITE_APP_ENV: 'development' })).toBe('non-production');
  });
});

describe('clinical observability sanitization (SUP-C04.2a)', () => {
  it('strips sensitive keys from details', () => {
    const sanitized = sanitizeObservabilityDetails({
      errorCode: 'TECHNICAL_ERROR',
      email: 'a@b.com',
      summary: 'clinical text',
      token: 'secret',
      durationMs: 12,
    });
    expect(sanitized).toEqual({ errorCode: 'TECHNICAL_ERROR', durationMs: 12 });
  });

  it('creates correlation ids', () => {
    expect(createCorrelationId().length).toBeGreaterThan(8);
  });
});

describe('instrumentClinicalRepository (SUP-C04.2a)', () => {
  it('emits start/end on successful read and never switches backend', async () => {
    const events: ClinicalObservabilityEvent[] = [];
    const repo = instrumentClinicalRepository(
      {
        async listLinkedClinicalAppointments() {
          return Promise.resolve({ ok: true as const, data: [] });
        },
      },
      {
        module: 'agenda',
        mode: 'supabase',
        operationKinds: { listLinkedClinicalAppointments: 'read' },
        sink: (event) => events.push(event),
        now: (() => {
          let t = 0;
          return () => {
            t += 5;
            return t;
          };
        })(),
        createCorrelationId: () => 'corr-1',
      }
    );

    const result = await repo.listLinkedClinicalAppointments();
    expect(result).toEqual({ ok: true, data: [] });
    expect(events.map((e) => e.type)).toEqual(['repository_op_start', 'repository_op_end']);
    expect(events[1]?.durationMs).toBe(5);
    expect(events.every((e) => e.correlationId === 'corr-1')).toBe(true);
  });

  it('records error and fallback_blocked for auth denial without changing result', async () => {
    const events: ClinicalObservabilityEvent[] = [];
    const denied = {
      ok: false as const,
      error: { code: 'CLINICAL_ACCESS_DENIED', kind: 'authorization', transient: false },
    };
    const repo = instrumentClinicalRepository(
      {
        async listLinkedClinicalAppointments() {
          return Promise.resolve(denied);
        },
      },
      {
        module: 'agenda',
        mode: 'supabase',
        operationKinds: { listLinkedClinicalAppointments: 'read' },
        fallbackPolicy: {
          enableTransientFallback: true,
          runtime: 'non-production',
          enableMockDataFallback: true,
        },
        sink: (event) => events.push(event),
        createCorrelationId: () => 'corr-deny',
      }
    );

    const result = await repo.listLinkedClinicalAppointments();
    expect(result).toBe(denied);
    expect(events.map((e) => e.type)).toEqual([
      'repository_op_start',
      'repository_op_error',
      'fallback_blocked',
    ]);
    expect(events[2]?.blockReason).toBe('blocked_error_code');
    expect(events[1]?.errorCode).toBe('CLINICAL_ACCESS_DENIED');
  });

  it('blocks write fallback and keeps original technical error', async () => {
    const events: ClinicalObservabilityEvent[] = [];
    const failed = {
      ok: false as const,
      error: { code: 'TECHNICAL_ERROR', kind: 'technical', transient: true },
    };
    const repo = instrumentClinicalRepository(
      {
        async createClinicalAppointment() {
          return Promise.resolve(failed);
        },
      },
      {
        module: 'agenda',
        mode: 'supabase',
        operationKinds: { createClinicalAppointment: 'write' },
        fallbackPolicy: {
          enableTransientFallback: true,
          runtime: 'non-production',
          enableMockDataFallback: true,
        },
        sink: (event) => events.push(event),
        createCorrelationId: () => 'corr-write',
      }
    );

    const result = await repo.createClinicalAppointment();
    expect(result).toBe(failed);
    expect(events.at(-1)?.type).toBe('fallback_blocked');
    expect(events.at(-1)?.blockReason).toBe('write_operation');
  });

  it('even when policy would allow, C04.2a does not switch and reports not implemented', async () => {
    const events: ClinicalObservabilityEvent[] = [];
    const failed = {
      ok: false as const,
      error: { code: 'TECHNICAL_ERROR', kind: 'technical', transient: true },
    };
    const repo = instrumentClinicalRepository(
      {
        async listLinkedClinicalAppointments() {
          return Promise.resolve(failed);
        },
      },
      {
        module: 'agenda',
        mode: 'supabase',
        operationKinds: { listLinkedClinicalAppointments: 'read' },
        fallbackPolicy: {
          enableTransientFallback: true,
          runtime: 'non-production',
          enableMockDataFallback: true,
        },
        sink: (event) => events.push(event),
        createCorrelationId: () => 'corr-eligible',
      }
    );

    const result = await repo.listLinkedClinicalAppointments();
    expect(result).toBe(failed);
    expect(events.at(-1)).toMatchObject({
      type: 'fallback_blocked',
      blockReason: 'data_switch_not_implemented',
    });
  });
});

describe('clinical factories instrumentation wiring (SUP-C04.2a)', () => {
  it('agenda factory instruments mock adapter without altering contract', async () => {
    const events: ClinicalObservabilityEvent[] = [];
    const repository = createClinicalAgendaRepositoryFactory({
      mode: 'mock',
      observabilitySink: (event) => events.push(event),
    });
    expect(typeof repository.listLinkedClinicalAppointments).toBe('function');
    expect(typeof repository.createClinicalAppointment).toBe('function');

    await repository.listLinkedClinicalAppointments({
      context: {
        sessionUserId: 'usr-1',
        professionalUserId: 'usr-1',
        organizationId: 'org-1',
      },
    });
    expect(events.some((e) => e.type === 'repository_op_start')).toBe(true);
    expect(
      events.some((e) => e.type === 'repository_op_end' || e.type === 'repository_op_error')
    ).toBe(true);
  });

  it('care plan factory default policy never attempts mock data fallback', async () => {
    const events: ClinicalObservabilityEvent[] = [];
    const repository = createCarePlanRepositoryFactory({
      mode: 'mock',
      observabilitySink: (event) => events.push(event),
    });

    const result = await repository.getOpenCarePlan({
      context: {
        sessionUserId: 'usr-1',
        professionalUserId: 'usr-1',
        organizationId: 'org-1',
      },
      patientId: 'patient-missing',
    });

    // Denied or empty is fine; must not invent success via fallback.
    if (!result.ok) {
      expect(events.some((e) => e.type === 'fallback_blocked')).toBe(true);
    }
  });
});
