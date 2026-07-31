import { createMockClinicalRecordRepository } from '@/services/repositories/clinicalRecord/mockClinicalRecordRepository';
import {
  createSupabaseClinicalRecordRepository,
  type SupabaseClinicalRecordClient,
} from '@/services/repositories/clinicalRecord/supabaseClinicalRecordRepository';
import type { ClinicalRecordRepository } from '@/services/repositories/clinicalRecord/contracts';

type ClinicalRecordRepositoryMode = 'mock' | 'supabase';
type ClinicalRecordModeEnvironment = { VITE_ENABLE_SUPABASE_AUTH?: string };

export function resolveClinicalRecordRepositoryMode(
  env: ClinicalRecordModeEnvironment
): ClinicalRecordRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function createClinicalRecordRepositoryFactory(input: {
  mode: ClinicalRecordRepositoryMode;
  supabaseClient?: SupabaseClinicalRecordClient | null;
}): ClinicalRecordRepository {
  if (input.mode === 'mock') return createMockClinicalRecordRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseClinicalRecordRepository({ client: input.supabaseClient });
}
