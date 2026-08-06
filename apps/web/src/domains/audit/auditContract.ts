import type { AuditEvent } from '@/domains/audit/types';

/** Closed result union — maps to DB `sucesso`/`falha`/`negado`. */
export type AuditResultCode = 'success' | 'error' | 'denied';

export type AuditSource =
  | 'auth'
  | 'consent'
  | 'clinical'
  | 'collective'
  | 'lgpd'
  | 'repository'
  | 'application';

/**
 * Closed provenance for denial/error classification.
 * Never use `database_rls_denied_confirmed` without unambiguous evidence.
 */
export type AuditProvenance =
  | 'application_precheck_denied'
  | 'repository_privilege_denied'
  | 'database_rls_denied_inferred'
  | 'database_rls_denied_confirmed'
  | 'application'
  | 'repository'
  | 'pre_auth_unpersistable';

export const AUDIT_PROVENANCE_VALUES = [
  'application_precheck_denied',
  'repository_privilege_denied',
  'database_rls_denied_inferred',
  'database_rls_denied_confirmed',
  'application',
  'repository',
  'pre_auth_unpersistable',
] as const satisfies readonly AuditProvenance[];

export type AuditEventInput = {
  action: string;
  entityType: string;
  entityId?: string;
  organizationId: string;
  actorEmail: string;
  actorRole: string;
  result: AuditResultCode;
  reasonCode?: string;
  correlationId: string;
  source: AuditSource;
  provenance?: AuditProvenance;
  /** Optional client hint; server timestamp wins in Supabase. */
  occurredAt?: string;
  metadata?: Record<string, string | number | boolean>;
};

export function toDbResult(result: AuditResultCode): AuditEvent['result'] {
  if (result === 'success') return 'sucesso';
  if (result === 'denied') return 'negado';
  return 'falha';
}

export function fromDbResult(result: AuditEvent['result']): AuditResultCode {
  if (result === 'sucesso') return 'success';
  if (result === 'negado') return 'denied';
  return 'error';
}

export function newCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return `corr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Opaque email fingerprint for mock-only trails — never full email in reason. */
export function emailFingerprint(email: string): string {
  const normalized = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `fp${hash.toString(16).padStart(8, '0')}`;
}
