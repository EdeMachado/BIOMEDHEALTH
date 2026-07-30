export type ConsentErrorCode =
  | 'NO_SESSION'
  | 'IDENTITY_MISMATCH'
  | 'CROSS_TENANT_DATA'
  | 'INELIGIBLE_DOCUMENT'
  | 'CONSENT_NOT_FOUND'
  | 'CONSENT_ALREADY_ACTIVE'
  | 'CONSENT_ALREADY_REVOKED'
  | 'TECHNICAL_ERROR';

export type ConsentErrorKind = 'authentication' | 'authorization' | 'consistency' | 'validation' | 'technical';

export type ConsentErrorCause = {
  source: 'mock' | 'repository' | 'validation';
  code: string;
  message?: string;
};

export type ConsentError = {
  code: ConsentErrorCode;
  kind: ConsentErrorKind;
  message: string;
  details?: string;
  cause?: ConsentErrorCause;
  transient: boolean;
};

export type ConsentResult<T> = { ok: true; data: T } | { ok: false; error: ConsentError };

export type ConsentContext = {
  sessionUserId: string | null;
  userId: string | null;
  organizationId: string;
};

export type ConsentDocument = {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  purpose: string;
  legalBasis: string;
  documentVersion: string;
  contentHash: string;
  status: string;
  effectiveAt: string;
  expiresAt: string | null;
};

export type UserConsent = {
  id: string;
  organizationId: string;
  userId: string;
  consentDocumentId: string;
  source: string;
  acceptedAt: string;
  revokedAt: string | null;
  revokedSource: string | null;
  revokedReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ConsentHistoryItem = {
  consent: UserConsent;
  document: ConsentDocument;
};
