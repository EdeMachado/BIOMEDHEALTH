import { fail } from '@/services/repositories/clinicalPortfolio/errors';
import type { ClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/contracts';
import type {
  ClinicalPortfolioContext,
  ClinicalPortfolioPatient,
  ClinicalPortfolioResult,
} from '@/services/repositories/clinicalPortfolio/types';

/** Carrega carteira clinica read-only. Vazio autorizado = ok([]). */
export async function loadLinkedClinicalPortfolio(
  repository: ClinicalPortfolioRepository,
  context: ClinicalPortfolioContext
): Promise<ClinicalPortfolioResult<ClinicalPortfolioPatient[]>> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return repository.listLinkedClinicalPatients({ context });
}
