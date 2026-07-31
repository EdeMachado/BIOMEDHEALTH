import { createMockClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/mockClinicalAgendaRepository';
import {
  createSupabaseClinicalAgendaRepository,
  type SupabaseClinicalAgendaClient,
} from '@/services/repositories/clinicalAgenda/supabaseClinicalAgendaRepository';
import type { ClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/contracts';

type ClinicalAgendaRepositoryMode = 'mock' | 'supabase';
type ClinicalAgendaModeEnvironment = { VITE_ENABLE_SUPABASE_AUTH?: string };

export function resolveClinicalAgendaRepositoryMode(
  env: ClinicalAgendaModeEnvironment
): ClinicalAgendaRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function createClinicalAgendaRepositoryFactory(input: {
  mode: ClinicalAgendaRepositoryMode;
  supabaseClient?: SupabaseClinicalAgendaClient | null;
}): ClinicalAgendaRepository {
  if (input.mode === 'mock') return createMockClinicalAgendaRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseClinicalAgendaRepository({ client: input.supabaseClient });
}
