/**
 * SUP-C04.2 — sanitized clinical repository observability.
 * Never log PHI, clinical payloads, tokens, or secrets.
 */

import type { ClinicalRepositoryMode, ClinicalRepositoryModule } from '@/services/repositories/clinical/repositoryMode';
import type { ClinicalFallbackBlockReason, ClinicalOperationKind } from '@/services/repositories/clinical/fallbackPolicy';

export type ClinicalObservabilitySeverity = 'info' | 'warn' | 'error';

export type ClinicalObservabilityEvent = {
  type:
    | 'repository_op_start'
    | 'repository_op_end'
    | 'repository_op_error'
    | 'fallback_blocked';
  severity: ClinicalObservabilitySeverity;
  module: ClinicalRepositoryModule;
  operation: string;
  operationKind: ClinicalOperationKind;
  mode: ClinicalRepositoryMode;
  correlationId: string;
  durationMs?: number;
  errorCode?: string;
  errorKind?: string;
  transient?: boolean;
  outcome?: 'ok' | 'error';
  blockReason?: ClinicalFallbackBlockReason;
  timestamp: string;
};

export type ClinicalObservabilitySink = (event: ClinicalObservabilityEvent) => void;

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|anon.?key|email|cpf|phone|section|payload|body|summary|note|objective)/i;

export function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `clin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeObservabilityDetails(
  details: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value == null) {
      sanitized[key] = value;
    } else {
      sanitized[key] = typeof value;
    }
  }
  return sanitized;
}

export function createConsoleClinicalObservabilitySink(): ClinicalObservabilitySink {
  return (event) => {
    const line = `[clinical-repo] ${event.type} module=${event.module} op=${event.operation} mode=${event.mode} corr=${event.correlationId}`;
    if (event.severity === 'error') {
      console.error(line, {
        errorCode: event.errorCode,
        errorKind: event.errorKind,
        transient: event.transient,
        durationMs: event.durationMs,
        blockReason: event.blockReason,
      });
      return;
    }
    if (event.severity === 'warn') {
      console.warn(line, {
        errorCode: event.errorCode,
        blockReason: event.blockReason,
        durationMs: event.durationMs,
      });
      return;
    }
    console.info(line, { durationMs: event.durationMs, outcome: event.outcome });
  };
}

export type ClinicalResultLike = {
  ok: boolean;
  error?: {
    code?: string;
    kind?: string;
    transient?: boolean;
  };
};

export function isClinicalResultLike(value: unknown): value is ClinicalResultLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    typeof (value as ClinicalResultLike).ok === 'boolean'
  );
}
