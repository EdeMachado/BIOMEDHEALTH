import { createMockConsentRepository } from '@/services/repositories/consent/mockConsentRepository';
import {
  createSupabaseConsentRepository,
  type SupabaseConsentClient,
} from '@/services/repositories/consent/supabaseConsentRepository';
import type { ConsentRepository } from '@/services/repositories/consent/contracts';

type ConsentRepositoryMode = 'mock' | 'supabase';
type ConsentRepositoryModeEnvironment = { VITE_ENABLE_SUPABASE_AUTH?: string };

export function resolveConsentRepositoryMode(env: ConsentRepositoryModeEnvironment): ConsentRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function createConsentRepositoryFactory(input: {
  mode: ConsentRepositoryMode;
  supabaseClient?: SupabaseConsentClient | null;
}): ConsentRepository {
  if (input.mode === 'mock') return createMockConsentRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseConsentRepository({ client: input.supabaseClient });
}
