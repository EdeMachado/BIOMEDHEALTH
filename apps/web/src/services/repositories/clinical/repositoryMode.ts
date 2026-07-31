/**
 * Per-module clinical repository mode resolution (SUP-C04.1).
 *
 * CLINICAL_RECORD = ficha clínica C02 (`clinical_records`), not `/clinica/registros`
 * (local demo page without persisted domain; no flag in this PR).
 *
 * No runtime fallback from Supabase to mock on network/RLS/auth errors (C04.2).
 */

export type ClinicalRepositoryMode = 'mock' | 'supabase';

export type ClinicalRepositoryModule = 'agenda' | 'portfolio' | 'record' | 'carePlan';

export const CLINICAL_REPOSITORY_MODE_ENV_KEYS = {
  agenda: 'VITE_CLINICAL_AGENDA_REPOSITORY_MODE',
  portfolio: 'VITE_CLINICAL_PORTFOLIO_REPOSITORY_MODE',
  record: 'VITE_CLINICAL_RECORD_REPOSITORY_MODE',
  carePlan: 'VITE_CLINICAL_CARE_PLAN_REPOSITORY_MODE',
} as const satisfies Record<ClinicalRepositoryModule, string>;

export type ClinicalRepositoryModeEnvironment = {
  VITE_ENABLE_SUPABASE_AUTH?: string;
  VITE_CLINICAL_AGENDA_REPOSITORY_MODE?: string;
  VITE_CLINICAL_PORTFOLIO_REPOSITORY_MODE?: string;
  VITE_CLINICAL_RECORD_REPOSITORY_MODE?: string;
  VITE_CLINICAL_CARE_PLAN_REPOSITORY_MODE?: string;
};

function resolveInheritedGlobalMode(env: ClinicalRepositoryModeEnvironment): ClinicalRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

function readModuleMode(
  module: ClinicalRepositoryModule,
  env: ClinicalRepositoryModeEnvironment
): string | undefined {
  const key = CLINICAL_REPOSITORY_MODE_ENV_KEYS[module];
  return env[key];
}

/**
 * Precedence:
 * 1. module-specific flag when set to `mock` | `supabase`;
 * 2. else inherit from `VITE_ENABLE_SUPABASE_AUTH` (true → supabase; false/absent → mock);
 * 3. invalid specific or global values throw (deterministic; no silent adapter pick).
 */
export function resolveClinicalRepositoryMode(
  module: ClinicalRepositoryModule,
  env: ClinicalRepositoryModeEnvironment
): ClinicalRepositoryMode {
  const key = CLINICAL_REPOSITORY_MODE_ENV_KEYS[module];
  const specific = readModuleMode(module, env);

  if (specific === undefined) {
    return resolveInheritedGlobalMode(env);
  }

  if (specific === 'mock' || specific === 'supabase') {
    return specific;
  }

  throw new Error(`Valor invalido para ${key}: "${specific}"`);
}
