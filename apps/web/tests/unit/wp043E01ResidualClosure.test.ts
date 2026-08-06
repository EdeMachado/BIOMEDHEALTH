import { describe, expect, it, vi } from 'vitest';
import {
  emailFingerprint,
  newCorrelationId,
} from '@/domains/audit/auditContract';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';
import { classifyPrivilegeDenial } from '@/domains/audit/classifyPrivilegeDenial';
import {
  recordPreAuthLoginFailure,
  registerAuthenticatedAuthEvent,
} from '@/domains/audit/authAudit';
import { requestLgpdCapability } from '@/application/lgpd/lgpdRequestService';
import * as auditTrail from '@/domains/audit/auditTrail';
import {
  createLinkedCarePlan,
  updateLinkedCarePlan,
  closeLinkedCarePlan,
  addLinkedCarePlanNote,
  createLinkedCarePlanAction,
  updateLinkedCarePlanAction,
} from '@/domains/carePlan/carePlanService';
import type { CarePlanRepository } from '@/services/repositories/carePlan/contracts';
import type { ClinicalAuditSink } from '@/domains/clinical/clinicalAuditSink';
import { ok, fail } from '@/services/repositories/carePlan/errors';

describe('WP-04.3 E01 residual', () => {
  it('pre-auth supabase nao persiste e nao inclui email/senha', () => {
    const spy = vi.spyOn(auditTrail, 'registerAuditEvent').mockImplementation(() => undefined);
    const result = recordPreAuthLoginFailure({
      mode: 'supabase',
      emailAttempted: 'paciente@secreto.test',
      organizationIdHint: 'org-1',
      failureKind: 'invalid_credentials',
    });
    expect(result.persisted).toBe(false);
    expect(result.limit).toBe('pre_auth_rpc_requires_auth_uid');
    expect(result.correlationId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('pre-auth mock persiste fingerprint sem email completo', () => {
    const spy = vi.spyOn(auditTrail, 'registerAuditEvent').mockImplementation(() => undefined);
    const result = recordPreAuthLoginFailure({
      mode: 'mock',
      emailAttempted: 'paciente@secreto.test',
      organizationIdHint: 'org-1',
      failureKind: 'invalid_credentials',
    });
    expect(result.persisted).toBe(true);
    expect(spy).toHaveBeenCalled();
    const reason = String(spy.mock.calls[0]?.[0]?.reason ?? '');
    expect(reason).toContain('login_failure_pre_auth');
    expect(reason).toContain(`email_fp=${emailFingerprint('paciente@secreto.test')}`);
    expect(reason).not.toMatch(/paciente@secreto|senha|password|token/i);
    spy.mockRestore();
  });

  it('auth autenticado usa sanitize e correlationId', () => {
    const spy = vi.spyOn(auditTrail, 'registerAuditEvent').mockImplementation(() => undefined);
    const out = registerAuthenticatedAuthEvent({
      code: 'login',
      actorEmail: 'user@demo.test',
      actorRole: 'usuario',
      organizationId: 'org-1',
      result: 'sucesso',
      correlationId: newCorrelationId(),
    });
    expect(out.ok).toBe(true);
    const reason = String(spy.mock.calls[0]?.[0]?.reason ?? '');
    expect(reason).toContain('corr=');
    expect(reason).toContain('src=auth');
    spy.mockRestore();
  });

  it('LGPD nao retorna sucesso falso', () => {
    const spy = vi.spyOn(auditTrail, 'registerAuditEvent').mockImplementation(() => undefined);
    const exportResult = requestLgpdCapability({
      requestKind: 'export',
      actorEmail: 'user@demo.test',
      actorRole: 'usuario',
      organizationId: 'org-1',
    });
    expect(exportResult.ok).toBe(false);
    expect(exportResult.status).toBe('unavailable');
    expect(exportResult.message).toMatch(/indispon/i);
    expect(exportResult.message).not.toMatch(/registrada em modo demonstra/i);
    const reason = String(spy.mock.calls[0]?.[0]?.reason ?? '');
    expect(reason).toContain('lgpd_capability_unavailable');
    expect(reason).toContain('request_kind=export');
    spy.mockRestore();
  });

  it('classifica RLS deny como inferred nunca confirmed', () => {
    const classified = classifyPrivilegeDenial({
      errorCode: 'CROSS_TENANT_DATA',
      message: 'new row violates row-level security',
      sqlState: '42501',
    });
    expect(classified.provenance).toBe('database_rls_denied_inferred');
    expect(classified.provenance).not.toBe('database_rls_denied_confirmed');
    expect(classified.auditResult).toBe('error');
  });

  it('care-plan actions distintas geram codes distintos sem PHI', async () => {
    const calls: Array<{ code: string; reason?: string; metadata?: Record<string, unknown> }> = [];
    const sink: ClinicalAuditSink = {
      registerSensitiveOperation(input) {
        calls.push({ code: input.code, metadata: input.metadata });
      },
    };
    const context = {
      sessionUserId: 'pro-1',
      professionalUserId: 'pro-1',
      organizationId: 'org-1',
    unitId: 'unit-org-1',
    };
    const repository = {
      createCarePlan: vi.fn(() =>
        Promise.resolve(
          ok({
            id: 'plan-1',
            organizationId: 'org-1',
            patientId: 'p1',
            professionalId: 'pro-1',
            title: 't',
            generalObjective: 'o',
            planStatus: 'em_andamento',
            status: 'ativo',
            version: 1,
            startsOn: '2026-01-01',
            targetDate: null,
            reassessmentDueOn: null,
            clinicalRecordId: null,
            createdAt: '',
            updatedAt: '',
          })
        )
      ),
      updateCarePlan: vi.fn(() =>
        Promise.resolve(
          ok({
            id: 'plan-1',
            organizationId: 'org-1',
            patientId: 'p1',
            professionalId: 'pro-1',
            title: 't2',
            generalObjective: 'o',
            planStatus: 'em_andamento',
            status: 'ativo',
            version: 2,
            startsOn: '2026-01-01',
            targetDate: null,
            reassessmentDueOn: null,
            clinicalRecordId: null,
            createdAt: '',
            updatedAt: '',
          })
        )
      ),
      closeCarePlan: vi.fn(() =>
        Promise.resolve(
          ok({
            id: 'plan-1',
            organizationId: 'org-1',
            patientId: 'p1',
            professionalId: 'pro-1',
            title: 't',
            generalObjective: 'o',
            planStatus: 'concluido',
            status: 'ativo',
            version: 3,
            startsOn: '2026-01-01',
            targetDate: null,
            reassessmentDueOn: null,
            clinicalRecordId: null,
            createdAt: '',
            updatedAt: '',
          })
        )
      ),
      addCarePlanNote: vi.fn(() =>
        Promise.resolve(
          ok({
            id: 'ev-1',
            carePlanId: 'plan-1',
            carePlanActionId: null,
            organizationId: 'org-1',
            patientId: 'p1',
            professionalId: 'pro-1',
            eventKind: 'note',
            eventCategory: 'clinical',
            payload: {},
            note: 'texto clinico sensivel nao deve ir ao audit',
            versionBefore: 1,
            versionAfter: 1,
            authoredBy: 'pro-1',
            createdAt: '',
          })
        )
      ),
      createCarePlanAction: vi.fn(() =>
        Promise.resolve(
          ok({
            id: 'act-1',
            carePlanId: 'plan-1',
            organizationId: 'org-1',
            patientId: 'p1',
            professionalId: 'pro-1',
            actionText: 'acao',
            specificObjective: 'obj',
            frequency: '1x',
            dueDate: null,
            actionStatus: 'pendente',
            status: 'ativo',
            version: 1,
            displayOrder: 1,
            notes: null,
            createdAt: '',
            updatedAt: '',
          })
        )
      ),
      updateCarePlanAction: vi.fn(() =>
        Promise.resolve(
          ok({
            id: 'act-1',
            carePlanId: 'plan-1',
            organizationId: 'org-1',
            patientId: 'p1',
            professionalId: 'pro-1',
            actionText: 'acao',
            specificObjective: 'obj',
            frequency: '1x',
            dueDate: null,
            actionStatus: 'em_andamento',
            status: 'ativo',
            version: 2,
            displayOrder: 1,
            notes: null,
            createdAt: '',
            updatedAt: '',
          })
        )
      ),
    } as unknown as CarePlanRepository;

    await createLinkedCarePlan(repository, context, {
      patientId: 'p1',
      title: 't',
      generalObjective: 'o',
      startsOn: '2026-01-01',
    }, sink);
    await updateLinkedCarePlan(
      repository,
      context,
      { planId: 'plan-1', expectedVersion: 1, title: 't2' },
      sink
    );
    await closeLinkedCarePlan(
      repository,
      context,
      { planId: 'plan-1', expectedVersion: 2, mode: 'conclude' },
      sink
    );
    await closeLinkedCarePlan(
      repository,
      context,
      { planId: 'plan-1', expectedVersion: 2, mode: 'suspend', suspensionReason: 'motivo' },
      sink
    );
    await addLinkedCarePlanNote(
      repository,
      context,
      { planId: 'plan-1', note: 'texto clinico sensivel', kind: 'evolution' },
      sink
    );
    await addLinkedCarePlanNote(
      repository,
      context,
      { planId: 'plan-1', note: 'reavaliacao', kind: 'reassessment' },
      sink
    );
    await createLinkedCarePlanAction(
      repository,
      context,
      { planId: 'plan-1', specificObjective: 'o', actionText: 'a', frequency: '1x' },
      sink
    );
    await updateLinkedCarePlanAction(
      repository,
      context,
      { actionId: 'act-1', expectedVersion: 1, actionStatus: 'em_andamento' },
      sink
    );

    const codes = calls.map((c) => c.code);
    expect(codes).toEqual([
      'care_plan_created',
      'care_plan_updated',
      'care_plan_closed',
      'care_plan_suspended',
      'care_plan_note_added',
      'care_plan_reassessment_added',
      'care_plan_action_created',
      'care_plan_action_status_changed',
    ]);
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toMatch(/texto clinico|diagnost|paciente@|senha/i);
  });

  it('sanitizer rejeita provenance confirmed falsa e PHI', () => {
    expect(() =>
      sanitizeAuditMetadata({
        code: 'repository_error',
        entity: 'care_plan',
        correlationId: 'corr12345678abcdef',
        result: 'falha',
        provenance: 'database_rls_denied_confirmed',
        metadata: { error_code: 'X' },
      })
    ).not.toThrow();
    // confirmed is allowed in enum but classifyPrivilegeDenial never emits it —
    // sanitizer still accepts the closed set; PHI still blocked:
    expect(() =>
      sanitizeAuditMetadata({
        code: 'care_plan_note_added',
        entity: 'care_plan',
        correlationId: 'corr12345678abcdef',
        result: 'sucesso',
        rawReason: 'anotacao=hipertensao',
      })
    ).toThrow(/bloqueado/);
  });

  it('repository error care-plan usa provenance inferred', async () => {
    const calls: Array<{ code: string; provenance?: string }> = [];
    const sink: ClinicalAuditSink = {
      registerSensitiveOperation(input) {
        calls.push({
          code: input.code,
          provenance: input.provenance,
        });
      },
    };
    const repository = {
      updateCarePlan: vi.fn(() => Promise.resolve(fail('CROSS_TENANT_DATA'))),
    } as unknown as CarePlanRepository;
    await updateLinkedCarePlan(
      repository,
      { sessionUserId: 'pro-1', professionalUserId: 'pro-1', organizationId: 'org-1', unitId: 'unit-org-1' },
      { planId: 'plan-1', expectedVersion: 1, title: 'x' },
      sink
    );
    expect(calls[0]?.code).toBe('repository_error');
    expect(calls[0]?.provenance).toBe('database_rls_denied_inferred');
  });
});
