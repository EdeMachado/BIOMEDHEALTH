import { createMockClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/mockClinicalAgendaRepository';
import {
  createSupabaseClinicalAgendaRepository,
  type SupabaseClinicalAgendaClient,
} from '@/services/repositories/clinicalAgenda/supabaseClinicalAgendaRepository';
import type { ClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/contracts';
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
}): ClinicalAgendaRepository {
  if (input.mode === 'mock') return createMockClinicalAgendaRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseClinicalAgendaRepository({ client: input.supabaseClient });
}
