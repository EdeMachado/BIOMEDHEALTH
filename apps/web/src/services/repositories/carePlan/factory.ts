import { createMockCarePlanRepository } from '@/services/repositories/carePlan/mockCarePlanRepository';
import {
  createSupabaseCarePlanRepository,
  type SupabaseCarePlanClient,
} from '@/services/repositories/carePlan/supabaseCarePlanRepository';
import type { CarePlanRepository } from '@/services/repositories/carePlan/contracts';

type CarePlanRepositoryMode = 'mock' | 'supabase';
type CarePlanModeEnvironment = { VITE_ENABLE_SUPABASE_AUTH?: string };

export function resolveCarePlanRepositoryMode(env: CarePlanModeEnvironment): CarePlanRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function createCarePlanRepositoryFactory(input: {
  mode: CarePlanRepositoryMode;
  supabaseClient?: SupabaseCarePlanClient | null;
}): CarePlanRepository {
  if (input.mode === 'mock') return createMockCarePlanRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseCarePlanRepository({ client: input.supabaseClient });
}
