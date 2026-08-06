import { registerAuditEvent } from '@/domains/audit/auditTrail';
import { newCorrelationId } from '@/domains/audit/auditContract';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';
import type { ConsentAuditSink } from '@/domains/consent/consentAudit';

/**
 * Canonical consent audit sink — IDs + codes only, via unified audit adapter/RPC.
 */
export function createPersistingConsentAuditSink(input: {
  actorEmail: string;
  actorRole: string;
}): ConsentAuditSink {
  return {
    registerAccepted({ context, consent }) {
      try {
        const meta = sanitizeAuditMetadata({
          code: 'consent_accepted',
          entity: 'consent',
          entityId: consent.id,
          correlationId: newCorrelationId(),
          result: 'sucesso',
          source: 'consent',
        });
        registerAuditEvent({
          actorEmail: input.actorEmail,
          actorRole: input.actorRole,
          organizationId: context.organizationId,
          action: meta.action,
          entity: meta.entity,
          entityId: meta.entityId,
          correlationId: meta.correlationId,
          result: meta.result,
          reason: meta.reason,
        });
      } catch (error) {
        console.error('[audit] consent accepted sink failed', error);
      }
    },
    registerRevoked({ context, consent }) {
      try {
        const meta = sanitizeAuditMetadata({
          code: 'consent_revoked',
          entity: 'consent',
          entityId: consent.id,
          correlationId: newCorrelationId(),
          result: 'sucesso',
          source: 'consent',
        });
        registerAuditEvent({
          actorEmail: input.actorEmail,
          actorRole: input.actorRole,
          organizationId: context.organizationId,
          action: meta.action,
          entity: meta.entity,
          entityId: meta.entityId,
          correlationId: meta.correlationId,
          result: meta.result,
          reason: meta.reason,
        });
      } catch (error) {
        console.error('[audit] consent revoked sink failed', error);
      }
    },
  };
}
