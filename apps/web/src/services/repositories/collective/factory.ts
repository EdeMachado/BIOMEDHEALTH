/**
 * SUP-D01-C — resolução de modo do repository coletivo.
 * Precedência: flag específica → herança de VITE_ENABLE_SUPABASE_AUTH.
 * Sem fallback runtime; valor inválido falha deterministicamente.
 */

import type { CollectiveRepositoryMode } from '@/services/repositories/collective/types';
import { createMockCollectiveRepository } from '@/services/repositories/collective/mockCollectiveRepository';
import {
  createSupabaseCollectiveRepository,
  type SupabaseCollectiveClient,
} from '@/services/repositories/collective/supabaseCollectiveRepository';
import type { CollectiveRepository } from '@/services/repositories/collective/contracts';

export const COLLECTIVE_REPOSITORY_MODE_ENV_KEY = 'VITE_COLLECTIVE_REPOSITORY_MODE';

export type CollectiveModeEnvironment = {
  VITE_ENABLE_SUPABASE_AUTH?: string;
  VITE_COLLECTIVE_REPOSITORY_MODE?: string;
};

function resolveInheritedGlobalMode(env: CollectiveModeEnvironment): CollectiveRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function resolveCollectiveRepositoryMode(
  env: CollectiveModeEnvironment
): CollectiveRepositoryMode {
  const specific = env.VITE_COLLECTIVE_REPOSITORY_MODE;
  if (specific === undefined) return resolveInheritedGlobalMode(env);
  if (specific === 'mock' || specific === 'supabase') return specific;
  throw new Error(`Valor invalido para ${COLLECTIVE_REPOSITORY_MODE_ENV_KEY}: "${specific}"`);
}

export function createCollectiveRepositoryFactory(input: {
  mode: CollectiveRepositoryMode;
  supabaseClient?: SupabaseCollectiveClient | null;
}): CollectiveRepository {
  if (input.mode === 'mock') return createMockCollectiveRepository();
  if (!input.supabaseClient) {
    throw new Error('Modo Supabase exige client por injecao.');
  }
  return createSupabaseCollectiveRepository({ client: input.supabaseClient });
}
