import { registerAuditEvent } from '@/domains/audit/auditTrail';
import { newCorrelationId } from '@/domains/audit/auditContract';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';

export type LgpdRequestKind = 'export' | 'correction' | 'erasure' | 'preferences';

export type LgpdCapabilityResult = {
  ok: false;
  status: 'unavailable';
  requestKind: LgpdRequestKind;
  message: string;
  correlationId: string;
};

/**
 * LGPD application boundary — no fake success.
 * Export/correction/erasure are not implemented as durable workflows yet.
 */
export function requestLgpdCapability(input: {
  requestKind: LgpdRequestKind;
  actorEmail?: string;
  actorRole?: string;
  organizationId?: string;
}): LgpdCapabilityResult {
  const correlationId = newCorrelationId();
  const message =
    input.requestKind === 'erasure'
      ? 'Exclusão/apagamento não está disponível neste ambiente: retenção legal e política jurídica ainda não autorizam operação irreversível.'
      : input.requestKind === 'preferences'
        ? 'Preferências de comunicação não estão persistidas neste ambiente. Nenhuma alteração foi aplicada.'
        : `Solicitação de ${input.requestKind === 'export' ? 'exportação' : 'correção'} indisponível neste ambiente. Nenhuma operação foi executada.`;

  if (input.actorEmail && input.actorRole && input.organizationId) {
    try {
      const meta = sanitizeAuditMetadata({
        code: 'lgpd_capability_unavailable',
        entity: 'lgpd',
        correlationId,
        result: 'negado',
        source: 'lgpd',
        provenance: 'application_precheck_denied',
        metadata: { request_kind: input.requestKind },
      });
      registerAuditEvent({
        actorEmail: input.actorEmail,
        actorRole: input.actorRole,
        organizationId: input.organizationId,
        action: meta.action,
        entity: meta.entity,
        correlationId: meta.correlationId,
        result: meta.result,
        reason: meta.reason,
      });
    } catch (error) {
      console.error('[audit] lgpd capability event failed', error);
    }
  }

  return {
    ok: false,
    status: 'unavailable',
    requestKind: input.requestKind,
    message,
    correlationId,
  };
}
