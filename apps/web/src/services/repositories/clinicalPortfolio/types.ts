export type ClinicalPortfolioErrorKind =
  | 'authentication'
  | 'authorization'
  | 'technical'
  | 'consistency';

export type ClinicalPortfolioErrorCode =
  | 'NO_SESSION'
  | 'IDENTITY_MISMATCH'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'CLINICAL_ACCESS_DENIED'
  | 'CROSS_TENANT_DATA'
  | 'TECHNICAL_ERROR';

export type ClinicalPortfolioError = {
  code: ClinicalPortfolioErrorCode;
  kind: ClinicalPortfolioErrorKind;
  transient: boolean;
  message: string;
  details?: string;
  cause?: { source: 'repository'; code?: string; message?: string };
};

export type ClinicalPortfolioResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClinicalPortfolioError };

export type ClinicalPortfolioContext = {
  sessionUserId: string;
  professionalUserId: string;
  organizationId: string;
  unitId: string;
};

export type ClinicalPortfolioPatient = {
  patientId: string;
  displayName: string;
  organizationId: string;
  unitId: string;
  assignmentStatus: 'ativo' | 'inativo';
  assignmentReason: string | null;
};
