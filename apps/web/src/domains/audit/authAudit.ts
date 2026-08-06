import { registerAuditEvent } from '@/domains/audit/auditTrail';
import {
  emailFingerprint,
  newCorrelationId,
  type AuditProvenance,
} from '@/domains/audit/auditContract';
import { sanitizeAuditMetadata } from '@/domains/audit/sanitizeAuditMetadata';

export type AuthAuditMode = 'mock' | 'supabase';

/**
 * Auth audit helpers — sanitize + correlationId.
 * Pre-auth failures are NOT persisted via RPC (requires auth.uid); documented limit.
 */
export function registerAuthenticatedAuthEvent(input: {
  code: 'login' | 'logout' | 'access_denied';
  actorEmail: string;
  actorRole: string;
  organizationId: string;
  result: 'sucesso' | 'falha' | 'negado';
  correlationId?: string;
  provenance?: AuditProvenance;
  metadata?: Record<string, string | number | boolean>;
}): { ok: true; correlationId: string } | { ok: false; message: string } {
  try {
    const correlationId = input.correlationId ?? newCorrelationId();
    const meta = sanitizeAuditMetadata({
      code: input.code,
      entity: 'auth',
      correlationId,
      result: input.result,
      source: 'auth',
      provenance: input.provenance ?? 'application',
      metadata: input.metadata,
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
    return { ok: true, correlationId: meta.correlationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'auth audit failed';
    console.error('[audit] auth event failed', message);
    return { ok: false, message };
  }
}

/**
 * Pre-auth login failure: never call register_audit_event (no auth.uid).
 * Mock mode may record a sanitized local event without full email.
 * Returns persistable=false for supabase — honest limit.
 */
export function recordPreAuthLoginFailure(input: {
  mode: AuthAuditMode;
  emailAttempted: string;
  organizationIdHint?: string;
  failureKind: 'invalid_credentials' | 'session_invalid';
}): {
  persisted: boolean;
  correlationId: string;
  limit: 'pre_auth_rpc_requires_auth_uid' | null;
} {
  const correlationId = newCorrelationId();
  if (input.mode === 'supabase') {
    // Intentional no-op: RPC register_audit_event requires auth.uid().
    return {
      persisted: false,
      correlationId,
      limit: 'pre_auth_rpc_requires_auth_uid',
    };
  }

  try {
    const meta = sanitizeAuditMetadata({
      code: 'login_failure_pre_auth',
      entity: 'auth',
      correlationId,
      result: 'falha',
      source: 'auth',
      provenance: 'pre_auth_unpersistable',
      metadata: {
        error_code: input.failureKind,
        email_fp: emailFingerprint(input.emailAttempted),
      },
    });
    registerAuditEvent({
      actorEmail: 'pre_auth',
      actorRole: 'nao_autenticado',
      organizationId: input.organizationIdHint ?? '00000000-0000-0000-0000-000000000000',
      action: meta.action,
      entity: meta.entity,
      correlationId: meta.correlationId,
      result: meta.result,
      reason: meta.reason,
    });
    return { persisted: true, correlationId, limit: null };
  } catch {
    return { persisted: false, correlationId, limit: null };
  }
}
