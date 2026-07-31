import { createMockClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/mockClinicalPortfolioRepository';
import {
  createSupabaseClinicalPortfolioRepository,
  type SupabaseClinicalPortfolioClient,
} from '@/services/repositories/clinicalPortfolio/supabaseClinicalPortfolioRepository';
import type { ClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/contracts';
import {
  resolveDefaultClinicalFallbackPolicy,
  resolveDefaultClinicalObservabilitySink,
} from '@/services/repositories/clinical/defaults';
import type { ClinicalFallbackPolicy } from '@/services/repositories/clinical/fallbackPolicy';
import { instrumentClinicalRepository } from '@/services/repositories/clinical/instrumentRepository';
import { CLINICAL_PORTFOLIO_OPERATION_KINDS } from '@/services/repositories/clinical/operationKinds';
import type { ClinicalObservabilitySink } from '@/services/repositories/clinical/observability';
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
  fallbackPolicy?: ClinicalFallbackPolicy;
  observabilitySink?: ClinicalObservabilitySink;
}): ClinicalPortfolioRepository {
  const fallbackPolicy = input.fallbackPolicy ?? resolveDefaultClinicalFallbackPolicy();
  const sink = input.observabilitySink ?? resolveDefaultClinicalObservabilitySink();
  const base =
    input.mode === 'mock'
      ? createMockClinicalPortfolioRepository()
      : (() => {
          if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
          return createSupabaseClinicalPortfolioRepository({ client: input.supabaseClient });
        })();

  return instrumentClinicalRepository(base, {
    module: 'portfolio',
    mode: input.mode,
    operationKinds: CLINICAL_PORTFOLIO_OPERATION_KINDS,
    fallbackPolicy,
    sink,
  });
}
