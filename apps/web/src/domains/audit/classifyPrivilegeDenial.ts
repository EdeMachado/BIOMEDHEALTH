import { newCorrelationId, type AuditProvenance } from '@/domains/audit/auditContract';

/**
 * Classifies repository/RPC privilege failures for honest audit provenance.
 * Never emits `database_rls_denied_confirmed` — that would require out-of-band proof.
 */
export function classifyPrivilegeDenial(input: {
  errorCode?: string | null;
  message?: string | null;
  sqlState?: string | null;
}): {
  sanitizedCode: string;
  provenance: AuditProvenance;
  auditResult: 'error' | 'denied';
} {
  const code = (input.errorCode ?? '').toUpperCase();
  const message = (input.message ?? '').toLowerCase();
  const sqlState = input.sqlState ?? '';

  const looksRls =
    sqlState === '42501' ||
    code === 'CROSS_TENANT_DATA' ||
    code === 'AUTHORIZATION_DENIED' ||
    /row-level security|rls|permission denied|insufficient_privilege|42501/.test(message);

  if (looksRls) {
    return {
      sanitizedCode: 'CROSS_TENANT_DATA',
      provenance: 'database_rls_denied_inferred',
      auditResult: 'error',
    };
  }

  if (code === 'NO_SESSION' || code === 'NO_ACTIVE_MEMBERSHIP') {
    return {
      sanitizedCode: code,
      provenance: 'application_precheck_denied',
      auditResult: 'denied',
    };
  }

  return {
    sanitizedCode: code || 'TECHNICAL_ERROR',
    provenance: 'repository_privilege_denied',
    auditResult: 'error',
  };
}

export function bindDenialCorrelation(existing?: string | null): string {
  return existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing) ? existing : newCorrelationId();
}
