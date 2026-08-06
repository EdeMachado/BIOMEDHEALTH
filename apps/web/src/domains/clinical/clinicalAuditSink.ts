import { registerAuditEvent } from '@/domains/audit/auditTrail';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';

export type ClinicalAuditActor = {
  actorEmail: string;
  actorRole: string;
  organizationId: string;
};

export type ClinicalAuditSink = {
  registerSensitiveOperation: (input: {
    code:
      | 'clinical_record_draft_saved'
      | 'clinical_record_concluded'
      | 'clinical_record_reopened'
      | 'care_plan_created'
      | 'care_plan_closed'
      | 'care_plan_note_added'
      | 'clinical_appointment_created'
      | 'clinical_appointment_updated';
    entity: 'clinical_record' | 'care_plan' | 'clinical_appointment';
    entityId?: string | null;
    result: 'sucesso' | 'falha' | 'negado';
    correlationId?: string | null;
  }) => void;
};

function newCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return `corr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Minimal clinical audit sink for sensitive writes — identifiers only, no PHI/notes.
 */
export function createPersistingClinicalAuditSink(actor: ClinicalAuditActor): ClinicalAuditSink {
  return {
    registerSensitiveOperation(input) {
      try {
        if (!actor.organizationId) return;
        const meta = sanitizeAuditMetadata({
          code: input.code,
          entity: input.entity,
          entityId: input.entityId,
          correlationId: input.correlationId ?? newCorrelationId(),
          result: input.result,
        });
        registerAuditEvent({
          actorEmail: actor.actorEmail,
          actorRole: actor.actorRole,
          organizationId: actor.organizationId,
          action: meta.action,
          entity: meta.entity,
          entityId: meta.entityId,
          correlationId: meta.correlationId,
          result: meta.result,
          reason: meta.reason,
        });
      } catch (error) {
        console.error('[audit] clinical sink failed', error);
      }
    },
  };
}

export function createNoopClinicalAuditSink(): ClinicalAuditSink {
  return {
    registerSensitiveOperation() {
      // intentional no-op for unit tests that do not assert audit
    },
  };
}
