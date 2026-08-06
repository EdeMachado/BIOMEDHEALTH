import { registerAuditEvent } from '@/domains/audit/auditTrail';
import { newCorrelationId, type AuditProvenance } from '@/domains/audit/auditContract';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';

export type ClinicalAuditActor = {
  actorEmail: string;
  actorRole: string;
  organizationId: string;
};

export type ClinicalAuditCode =
  | 'clinical_record_draft_saved'
  | 'clinical_record_concluded'
  | 'clinical_record_reopened'
  | 'care_plan_created'
  | 'care_plan_updated'
  | 'care_plan_closed'
  | 'care_plan_suspended'
  | 'care_plan_note_added'
  | 'care_plan_reassessment_added'
  | 'care_plan_action_created'
  | 'care_plan_action_updated'
  | 'care_plan_action_status_changed'
  | 'clinical_appointment_created'
  | 'clinical_appointment_updated'
  | 'repository_error';

export type ClinicalAuditSink = {
  registerSensitiveOperation: (input: {
    code: ClinicalAuditCode;
    entity: 'clinical_record' | 'care_plan' | 'clinical_appointment' | 'care_plan_action';
    entityId?: string | null;
    result: 'sucesso' | 'falha' | 'negado';
    correlationId?: string | null;
    provenance?: AuditProvenance;
    metadata?: Record<string, string | number | boolean>;
  }) => void;
};

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
          source: 'clinical',
          provenance: input.provenance ?? 'application',
          metadata: input.metadata,
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
