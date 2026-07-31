import { createMockCarePlanRepository } from '@/services/repositories/carePlan/mockCarePlanRepository';
import {
  createSupabaseCarePlanRepository,
  type SupabaseCarePlanClient,
} from '@/services/repositories/carePlan/supabaseCarePlanRepository';
import type { CarePlanRepository } from '@/services/repositories/carePlan/contracts';
import {
  resolveDefaultClinicalFallbackPolicy,
  resolveDefaultClinicalObservabilitySink,
} from '@/services/repositories/clinical/defaults';
import type { ClinicalFallbackPolicy } from '@/services/repositories/clinical/fallbackPolicy';
import { instrumentClinicalRepository } from '@/services/repositories/clinical/instrumentRepository';
import { CLINICAL_CARE_PLAN_OPERATION_KINDS } from '@/services/repositories/clinical/operationKinds';
import type { ClinicalObservabilitySink } from '@/services/repositories/clinical/observability';
import {
  resolveClinicalRepositoryMode,
  type ClinicalRepositoryMode,
  type ClinicalRepositoryModeEnvironment,
} from '@/services/repositories/clinical/repositoryMode';

export type CarePlanRepositoryMode = ClinicalRepositoryMode;
export type CarePlanModeEnvironment = ClinicalRepositoryModeEnvironment;

export function resolveCarePlanRepositoryMode(env: CarePlanModeEnvironment): CarePlanRepositoryMode {
  return resolveClinicalRepositoryMode('carePlan', env);
}

export function createCarePlanRepositoryFactory(input: {
  mode: CarePlanRepositoryMode;
  supabaseClient?: SupabaseCarePlanClient | null;
  fallbackPolicy?: ClinicalFallbackPolicy;
  observabilitySink?: ClinicalObservabilitySink;
}): CarePlanRepository {
  const fallbackPolicy = input.fallbackPolicy ?? resolveDefaultClinicalFallbackPolicy();
  const sink = input.observabilitySink ?? resolveDefaultClinicalObservabilitySink();
  const base =
    input.mode === 'mock'
      ? createMockCarePlanRepository()
      : (() => {
          if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
          return createSupabaseCarePlanRepository({ client: input.supabaseClient });
        })();

  return instrumentClinicalRepository(base, {
    module: 'carePlan',
    mode: input.mode,
    operationKinds: CLINICAL_CARE_PLAN_OPERATION_KINDS,
    fallbackPolicy,
    sink,
  });
}
