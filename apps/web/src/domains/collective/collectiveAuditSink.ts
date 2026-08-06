import { registerAuditEventAsync } from '@/domains/audit/auditTrail';
import { newCorrelationId, type AuditResultCode } from '@/domains/audit/auditContract';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';

export type CollectiveAuditActor = {
  actorEmail: string;
  actorRole: string;
  organizationId: string;
};

export type CollectiveAuditCode =
  | 'campaign_created'
  | 'campaign_updated'
  | 'campaign_closed'
  | 'campaign_deleted'
  | 'action_plan_created'
  | 'action_plan_updated'
  | 'action_plan_status_advanced'
  | 'action_plan_deleted'
  | 'permission_denied'
  | 'context_denied'
  | 'repository_error'
  | 'audit_persist_failed';

export type CollectiveAuditSink = {
  /**
   * Persist a single final event for a collective mutation.
   * Fail-closed: returns ok:false if sanitization or RPC fails.
   */
  registerFinal: (input: {
    code: CollectiveAuditCode;
    entity: 'campaign' | 'action_plan';
    entityId?: string | null;
    result: AuditResultCode;
    correlationId?: string;
    metadata?: Record<string, string | number | boolean>;
  }) => Promise<{ ok: true; correlationId: string } | { ok: false; message: string }>;
};

export function createPersistingCollectiveAuditSink(
  actor: CollectiveAuditActor
): CollectiveAuditSink {
  return {
    async registerFinal(input) {
      try {
        if (!actor.organizationId) {
          return { ok: false, message: 'organizationId ausente para auditoria.' };
        }
        const correlationId = input.correlationId ?? newCorrelationId();
        const dbResult =
          input.result === 'success' ? 'sucesso' : input.result === 'denied' ? 'negado' : 'falha';
        const meta = sanitizeAuditMetadata({
          code: input.code,
          entity: input.entity,
          entityId: input.entityId,
          correlationId,
          result: dbResult,
          source: 'collective',
          metadata: input.metadata,
        });
        const persisted = await registerAuditEventAsync({
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
        if (!persisted.ok) {
          return { ok: false, message: persisted.message };
        }
        return { ok: true, correlationId: meta.correlationId };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao sanitizar auditoria.';
        return { ok: false, message };
      }
    },
  };
}

export function createNoopCollectiveAuditSink(): CollectiveAuditSink {
  return {
    registerFinal(input) {
      return Promise.resolve({ ok: true, correlationId: input.correlationId ?? newCorrelationId() });
    },
  };
}
