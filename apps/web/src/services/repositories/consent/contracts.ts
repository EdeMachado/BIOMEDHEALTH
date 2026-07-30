import type { ConsentContext, ConsentHistoryItem, ConsentResult, UserConsent } from '@/services/repositories/consent/types';

export type AcceptConsentInput = {
  context: ConsentContext;
  consentDocumentId: string;
  source: string;
};

export type RevokeConsentInput = {
  context: ConsentContext;
  consentId: string;
  revokedSource: string;
  revokedReason?: string;
};

export interface ConsentRepository {
  listEligibleDocuments(context: ConsentContext): Promise<ConsentResult<ConsentHistoryItem['document'][]>>;
  listConsentHistory(context: ConsentContext): Promise<ConsentResult<ConsentHistoryItem[]>>;
  acceptConsent(input: AcceptConsentInput): Promise<ConsentResult<UserConsent>>;
  revokeConsent(input: RevokeConsentInput): Promise<ConsentResult<UserConsent>>;
}
