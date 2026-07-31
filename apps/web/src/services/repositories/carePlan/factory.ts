import { createMockCarePlanRepository } from '@/services/repositories/carePlan/mockCarePlanRepository';
import {
  createSupabaseCarePlanRepository,
  type SupabaseCarePlanClient,
} from '@/services/repositories/carePlan/supabaseCarePlanRepository';
import type { CarePlanRepository } from '@/services/repositories/carePlan/contracts';
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
}): CarePlanRepository {
  if (input.mode === 'mock') return createMockCarePlanRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseCarePlanRepository({ client: input.supabaseClient });
}
