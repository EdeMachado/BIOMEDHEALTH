import { createMockClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/mockClinicalPortfolioRepository';
import {
  createSupabaseClinicalPortfolioRepository,
  type SupabaseClinicalPortfolioClient,
} from '@/services/repositories/clinicalPortfolio/supabaseClinicalPortfolioRepository';
import type { ClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/contracts';

type ClinicalPortfolioRepositoryMode = 'mock' | 'supabase';
type ClinicalPortfolioModeEnvironment = { VITE_ENABLE_SUPABASE_AUTH?: string };

export function resolveClinicalPortfolioRepositoryMode(
  env: ClinicalPortfolioModeEnvironment
): ClinicalPortfolioRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function createClinicalPortfolioRepositoryFactory(input: {
  mode: ClinicalPortfolioRepositoryMode;
  supabaseClient?: SupabaseClinicalPortfolioClient | null;
}): ClinicalPortfolioRepository {
  if (input.mode === 'mock') return createMockClinicalPortfolioRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseClinicalPortfolioRepository({ client: input.supabaseClient });
}
