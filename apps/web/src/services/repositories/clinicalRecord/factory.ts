import { createMockClinicalRecordRepository } from '@/services/repositories/clinicalRecord/mockClinicalRecordRepository';
import {
  createSupabaseClinicalRecordRepository,
  type SupabaseClinicalRecordClient,
} from '@/services/repositories/clinicalRecord/supabaseClinicalRecordRepository';
import type { ClinicalRecordRepository } from '@/services/repositories/clinicalRecord/contracts';
import {
  resolveDefaultClinicalFallbackPolicy,
  resolveDefaultClinicalObservabilitySink,
} from '@/services/repositories/clinical/defaults';
import type { ClinicalFallbackPolicy } from '@/services/repositories/clinical/fallbackPolicy';
import { instrumentClinicalRepository } from '@/services/repositories/clinical/instrumentRepository';
import { CLINICAL_RECORD_OPERATION_KINDS } from '@/services/repositories/clinical/operationKinds';
import type { ClinicalObservabilitySink } from '@/services/repositories/clinical/observability';
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
  fallbackPolicy?: ClinicalFallbackPolicy;
  observabilitySink?: ClinicalObservabilitySink;
}): ClinicalRecordRepository {
  const fallbackPolicy = input.fallbackPolicy ?? resolveDefaultClinicalFallbackPolicy();
  const sink = input.observabilitySink ?? resolveDefaultClinicalObservabilitySink();
  const base =
    input.mode === 'mock'
      ? createMockClinicalRecordRepository()
      : (() => {
          if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
          return createSupabaseClinicalRecordRepository({ client: input.supabaseClient });
        })();

  return instrumentClinicalRepository(base, {
    module: 'record',
    mode: input.mode,
    operationKinds: CLINICAL_RECORD_OPERATION_KINDS,
    fallbackPolicy,
    sink,
  });
}
