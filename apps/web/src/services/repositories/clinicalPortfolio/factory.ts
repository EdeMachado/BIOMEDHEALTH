import { createMockClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/mockClinicalPortfolioRepository';
import {
  createSupabaseClinicalPortfolioRepository,
  type SupabaseClinicalPortfolioClient,
} from '@/services/repositories/clinicalPortfolio/supabaseClinicalPortfolioRepository';
import type { ClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/contracts';
import {
  resolveClinicalRepositoryMode,
  type ClinicalRepositoryMode,
  type ClinicalRepositoryModeEnvironment,
} from '@/services/repositories/clinical/repositoryMode';

export type ClinicalPortfolioRepositoryMode = ClinicalRepositoryMode;
export type ClinicalPortfolioModeEnvironment = ClinicalRepositoryModeEnvironment;

export function resolveClinicalPortfolioRepositoryMode(
  env: ClinicalPortfolioModeEnvironment
): ClinicalPortfolioRepositoryMode {
  return resolveClinicalRepositoryMode('portfolio', env);
}

export function createClinicalPortfolioRepositoryFactory(input: {
  mode: ClinicalPortfolioRepositoryMode;
  supabaseClient?: SupabaseClinicalPortfolioClient | null;
}): ClinicalPortfolioRepository {
  if (input.mode === 'mock') return createMockClinicalPortfolioRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseClinicalPortfolioRepository({ client: input.supabaseClient });
}
