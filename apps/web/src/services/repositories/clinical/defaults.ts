import type { ClinicalFallbackPolicy } from '@/services/repositories/clinical/fallbackPolicy';
import {
  DEFAULT_CLINICAL_FALLBACK_POLICY,
  resolveClinicalRuntimeEnvironment,
} from '@/services/repositories/clinical/fallbackPolicy';
import type { ClinicalObservabilitySink } from '@/services/repositories/clinical/observability';
import { createConsoleClinicalObservabilitySink } from '@/services/repositories/clinical/observability';

/** Default policy: fail-closed; runtime from VITE_APP_ENV when available. */
export function resolveDefaultClinicalFallbackPolicy(
  env: { VITE_APP_ENV?: string } = typeof import.meta !== 'undefined' ? import.meta.env : {}
): ClinicalFallbackPolicy {
  return {
    ...DEFAULT_CLINICAL_FALLBACK_POLICY,
    runtime: resolveClinicalRuntimeEnvironment(env),
  };
}

export function resolveDefaultClinicalObservabilitySink(
  env: { MODE?: string } = typeof import.meta !== 'undefined' ? import.meta.env : {}
): ClinicalObservabilitySink {
  if (env.MODE === 'test') {
    return () => undefined;
  }
  return createConsoleClinicalObservabilitySink();
}
