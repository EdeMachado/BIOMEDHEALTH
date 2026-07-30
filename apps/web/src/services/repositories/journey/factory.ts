import { createMockJourneyRepository } from '@/services/repositories/journey/mockJourneyRepository';
import {
  createSupabaseJourneyRepository,
  type SupabaseJourneyClient,
} from '@/services/repositories/journey/supabaseJourneyRepository';
import type { JourneyRepository } from '@/services/repositories/journey/contracts';

type JourneyRepositoryMode = 'mock' | 'supabase';
type JourneyRepositoryModeEnvironment = { VITE_ENABLE_SUPABASE_AUTH?: string };

export function resolveJourneyRepositoryMode(
  env: JourneyRepositoryModeEnvironment
): JourneyRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function createJourneyRepositoryFactory(input: {
  mode: JourneyRepositoryMode;
  supabaseClient?: SupabaseJourneyClient | null;
}): JourneyRepository {
  if (input.mode === 'mock') return createMockJourneyRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseJourneyRepository({ client: input.supabaseClient });
}
