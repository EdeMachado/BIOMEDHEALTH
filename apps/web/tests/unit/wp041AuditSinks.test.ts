import { describe, expect, it, vi } from 'vitest';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';
import { createPersistingConsentAuditSink } from '@/domains/consent/persistingConsentAuditSink';
import { createPersistingClinicalAuditSink } from '@/domains/clinical/clinicalAuditSink';
import * as auditTrail from '@/domains/audit/auditTrail';
import type { ConsentContext, UserConsent } from '@/services/repositories/consent/types';

describe('sanitizeAuditMetadata', () => {
  it('aceita codigo canonico com correlationId', () => {
    const meta = sanitizeAuditMetadata({
      code: 'consent_accepted',
      entity: 'consent',
      entityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      correlationId: 'corr12345678abcdef',
      result: 'sucesso',
    });
    expect(meta.reason).toContain('code=consent_accepted');
    expect(meta.reason).toContain('corr=corr12345678abcdef');
    expect(meta.entityId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('rejeita codigo desconhecido', () => {
    expect(() =>
      sanitizeAuditMetadata({
        code: 'dump_clinical_notes',
        entity: 'clinical_record',
        result: 'sucesso',
      })
    ).toThrow(/codigo nao permitido/);
  });

  it('rejeita payload clinico bruto no reason', () => {
    expect(() =>
      sanitizeAuditMetadata({
        code: 'clinical_record_draft_saved',
        entity: 'clinical_record',
        result: 'sucesso',
        rawReason: 'diagnostico: hipertensao e anotacao completa',
      })
    ).toThrow(/bloqueado/);
  });
});

describe('persisting consent/clinical sinks', () => {
  it('consent sink registra evento sanitizado sem fallback', () => {
    const spy = vi.spyOn(auditTrail, 'registerAuditEvent').mockImplementation(() => undefined);
    const sink = createPersistingConsentAuditSink({
      actorEmail: 'user@demo.test',
      actorRole: 'usuario',
    });
    const context: ConsentContext = {
      sessionUserId: 'u1',
      userId: 'u1',
      organizationId: 'org-1',
    };
    const consent = {
      id: 'consent-1',
      organizationId: 'org-1',
      userId: 'u1',
      consentDocumentId: 'doc-1',
      source: 'web',
      acceptedAt: new Date().toISOString(),
      revokedAt: null,
      revokedSource: null,
      revokedReason: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies UserConsent;

    sink.registerAccepted({ context, consent });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'consent_accepted',
        entity: 'consent',
        entityId: 'consent-1',
        organizationId: 'org-1',
        result: 'sucesso',
      })
    );
    const reason = spy.mock.calls[0]?.[0]?.reason ?? '';
    expect(reason).not.toMatch(/diagnost|prontuario|cpf/i);
    spy.mockRestore();
  });

  it('clinical sink nao inclui texto clinico', () => {
    const spy = vi.spyOn(auditTrail, 'registerAuditEvent').mockImplementation(() => undefined);
    const sink = createPersistingClinicalAuditSink({
      actorEmail: 'pro@demo.test',
      actorRole: 'medico',
      organizationId: 'org-1',
    });
    sink.registerSensitiveOperation({
      code: 'clinical_record_concluded',
      entity: 'clinical_record',
      entityId: 'rec-1',
      result: 'sucesso',
      correlationId: 'corrclinical0001abcd',
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'clinical_record_concluded',
        entityId: 'rec-1',
      })
    );
    const reason = String(spy.mock.calls[0]?.[0]?.reason ?? '');
    expect(reason).toContain('code=clinical_record_concluded');
    spy.mockRestore();
  });

  it('clinical sink falha fechado sem organizationId (nao chama register)', () => {
    const spy = vi.spyOn(auditTrail, 'registerAuditEvent').mockImplementation(() => undefined);
    const sink = createPersistingClinicalAuditSink({
      actorEmail: 'pro@demo.test',
      actorRole: 'medico',
      organizationId: '',
    });
    sink.registerSensitiveOperation({
      code: 'care_plan_created',
      entity: 'care_plan',
      result: 'sucesso',
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
