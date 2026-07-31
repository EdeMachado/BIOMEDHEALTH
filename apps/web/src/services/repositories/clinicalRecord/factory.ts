import { createMockClinicalRecordRepository } from '@/services/repositories/clinicalRecord/mockClinicalRecordRepository';
import {
  createSupabaseClinicalRecordRepository,
  type SupabaseClinicalRecordClient,
} from '@/services/repositories/clinicalRecord/supabaseClinicalRecordRepository';
import type { ClinicalRecordRepository } from '@/services/repositories/clinicalRecord/contracts';
import {
  resolveClinicalRepositoryMode,
  type ClinicalRepositoryMode,
  type ClinicalRepositoryModeEnvironment,
} from '@/services/repositories/clinical/repositoryMode';

export type ClinicalRecordRepositoryMode = ClinicalRepositoryMode;
export type ClinicalRecordModeEnvironment = ClinicalRepositoryModeEnvironment;

export function resolveClinicalRecordRepositoryMode(
  env: ClinicalRecordModeEnvironment
): ClinicalRecordRepositoryMode {
  return resolveClinicalRepositoryMode('record', env);
}

export function createClinicalRecordRepositoryFactory(input: {
  mode: ClinicalRecordRepositoryMode;
  supabaseClient?: SupabaseClinicalRecordClient | null;
}): ClinicalRecordRepository {
  if (input.mode === 'mock') return createMockClinicalRecordRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseClinicalRecordRepository({ client: input.supabaseClient });
}
