import type {
  ClinicalPortfolioContext,
  ClinicalPortfolioPatient,
  ClinicalPortfolioResult,
} from '@/services/repositories/clinicalPortfolio/types';

export type ListLinkedClinicalPatientsInput = {
  context: ClinicalPortfolioContext;
};

export interface ClinicalPortfolioRepository {
  /** Read-only. Empty authorized list is ok([]), never CLINICAL_ACCESS_DENIED. */
  listLinkedClinicalPatients(
    input: ListLinkedClinicalPatientsInput
  ): Promise<ClinicalPortfolioResult<ClinicalPortfolioPatient[]>>;
}
