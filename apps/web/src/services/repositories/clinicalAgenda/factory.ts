import { createMockClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/mockClinicalAgendaRepository';
import {
  createSupabaseClinicalAgendaRepository,
  type SupabaseClinicalAgendaClient,
} from '@/services/repositories/clinicalAgenda/supabaseClinicalAgendaRepository';
import type { ClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/contracts';
import {
  resolveDefaultClinicalFallbackPolicy,
  resolveDefaultClinicalObservabilitySink,
} from '@/services/repositories/clinical/defaults';
import type { ClinicalFallbackPolicy } from '@/services/repositories/clinical/fallbackPolicy';
import { instrumentClinicalRepository } from '@/services/repositories/clinical/instrumentRepository';
import { CLINICAL_AGENDA_OPERATION_KINDS } from '@/services/repositories/clinical/operationKinds';
import type { ClinicalObservabilitySink } from '@/services/repositories/clinical/observability';
import {
  resolveClinicalRepositoryMode,
  type ClinicalRepositoryMode,
  type ClinicalRepositoryModeEnvironment,
} from '@/services/repositories/clinical/repositoryMode';

export type ClinicalAgendaRepositoryMode = ClinicalRepositoryMode;
export type ClinicalAgendaModeEnvironment = ClinicalRepositoryModeEnvironment;

export function resolveClinicalAgendaRepositoryMode(
  env: ClinicalAgendaModeEnvironment
): ClinicalAgendaRepositoryMode {
  return resolveClinicalRepositoryMode('agenda', env);
}

export function createClinicalAgendaRepositoryFactory(input: {
  mode: ClinicalAgendaRepositoryMode;
  supabaseClient?: SupabaseClinicalAgendaClient | null;
  fallbackPolicy?: ClinicalFallbackPolicy;
  observabilitySink?: ClinicalObservabilitySink;
}): ClinicalAgendaRepository {
  const fallbackPolicy = input.fallbackPolicy ?? resolveDefaultClinicalFallbackPolicy();
  const sink = input.observabilitySink ?? resolveDefaultClinicalObservabilitySink();
  const base =
    input.mode === 'mock'
      ? createMockClinicalAgendaRepository()
      : (() => {
          if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
          return createSupabaseClinicalAgendaRepository({ client: input.supabaseClient });
        })();

  return instrumentClinicalRepository(base, {
    module: 'agenda',
    mode: input.mode,
    operationKinds: CLINICAL_AGENDA_OPERATION_KINDS,
    fallbackPolicy,
    sink,
  });
}
