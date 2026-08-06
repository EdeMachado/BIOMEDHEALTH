import { registerAuditEvent } from '@/domains/audit/auditTrail';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';
import type { ConsentAuditSink } from '@/domains/consent/consentAudit';

function newCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return `corr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Canonical consent audit sink — IDs + codes only, via unified audit adapter/RPC.
 * Never writes clinical document bodies or sessionStorage in supabase mode.
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
