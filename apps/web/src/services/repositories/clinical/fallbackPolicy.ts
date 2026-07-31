/**
 * SUP-C04.2 — clinical fallback policy (deny-by-default).
 *
 * Mock data fallback is intentionally gated and OFF by default (C04.2a).
 * Auth/RLS/validation/integrity and all writes never fall back.
 *
 * C04.2b precondition (do not enable mock data switch before this):
 * normalize PostgreSQL/PostgREST `42501` mapping across clinical repositories.
 * Today agenda/portfolio map 42501 → CROSS_TENANT_DATA, while care plan/record
 * may map it to PLAN_CLOSED / RECORD_CONCLUDED. Enabling data fallback without
 * that normalization risks treating permission denials as technical outages.
 */

export type ClinicalRuntimeEnvironment = 'production' | 'non-production';

export type ClinicalOperationKind = 'read' | 'write';

export type ClinicalFallbackPolicy = {
  /** When false (default), never attempt data fallback. */
  enableTransientFallback: boolean;
  /** Runtime gate: production never falls back (mirrors access). */
  runtime: ClinicalRuntimeEnvironment;
  /**
   * When false (default), eligible transient reads still do not switch to mock.
   * Reserved for a future C04.2b decision on mock destination safety.
   */
  enableMockDataFallback: boolean;
};

export const DEFAULT_CLINICAL_FALLBACK_POLICY: ClinicalFallbackPolicy = {
  enableTransientFallback: false,
  runtime: 'non-production',
  enableMockDataFallback: false,
};

/** Error codes that must never trigger clinical data fallback. */
export const CLINICAL_FALLBACK_BLOCKED_CODES: ReadonlySet<string> = new Set([
  'NO_SESSION',
  'IDENTITY_MISMATCH',
  'NO_ACTIVE_MEMBERSHIP',
  'CLINICAL_ACCESS_DENIED',
  'PATIENT_NOT_IN_PORTFOLIO',
  'CROSS_TENANT_DATA',
  'INVALID_INPUT',
  'VALIDATION_REQUIRED_FIELDS',
  'PLAN_CLOSED',
  'OPEN_PLAN_EXISTS',
  'VERSION_CONFLICT',
  'RECORD_CONCLUDED',
  'NOT_FOUND',
  'CONFLICT',
]);

export type ClinicalFallbackDecisionInput = {
  errorCode: string;
  transient?: boolean;
  operationKind: ClinicalOperationKind;
  policy: ClinicalFallbackPolicy;
};

export type ClinicalFallbackBlockReason =
  | 'policy_disabled'
  | 'production_runtime'
  | 'write_operation'
  | 'blocked_error_code'
  | 'not_transient_technical'
  | 'mock_data_fallback_disabled'
  /** Eligible under policy, but C04.2a does not switch backends. */
  | 'data_switch_not_implemented';

export function resolveClinicalRuntimeEnvironment(env: {
  VITE_APP_ENV?: string;
}): ClinicalRuntimeEnvironment {
  if (env.VITE_APP_ENV === 'production') return 'production';
  return 'non-production';
}

export function evaluateClinicalFallback(
  input: ClinicalFallbackDecisionInput
): { allow: true } | { allow: false; reason: ClinicalFallbackBlockReason } {
  const { policy } = input;

  if (!policy.enableTransientFallback) {
    return { allow: false, reason: 'policy_disabled' };
  }
  if (policy.runtime === 'production') {
    return { allow: false, reason: 'production_runtime' };
  }
  if (input.operationKind === 'write') {
    return { allow: false, reason: 'write_operation' };
  }
  if (CLINICAL_FALLBACK_BLOCKED_CODES.has(input.errorCode)) {
    return { allow: false, reason: 'blocked_error_code' };
  }
  if (input.errorCode !== 'TECHNICAL_ERROR' || input.transient !== true) {
    return { allow: false, reason: 'not_transient_technical' };
  }
  if (!policy.enableMockDataFallback) {
    return { allow: false, reason: 'mock_data_fallback_disabled' };
  }
  return { allow: true };
}

export function shouldAttemptClinicalFallback(input: ClinicalFallbackDecisionInput): boolean {
  return evaluateClinicalFallback(input).allow;
}
