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
