import type { AcceptConsentInput, ConsentRepository, RevokeConsentInput } from '@/services/repositories/consent/contracts';
import type {
  ConsentContext,
  ConsentDocument,
  ConsentHistoryItem,
  ConsentResult,
  UserConsent,
} from '@/services/repositories/consent/types';
import type { ConsentAuditSink } from '@/domains/consent/consentAudit';

export type ConsentOverview = {
  eligibleDocuments: ConsentDocument[];
  history: ConsentHistoryItem[];
  activeConsent: ConsentHistoryItem | null;
};

export async function loadConsentOverview(
  repository: ConsentRepository,
  context: ConsentContext
): Promise<ConsentResult<ConsentOverview>> {
  const [eligibleResult, historyResult] = await Promise.all([
    repository.listEligibleDocuments(context),
    repository.listConsentHistory(context),
  ]);
  if (!eligibleResult.ok) return eligibleResult;
  if (!historyResult.ok) return historyResult;
  const activeConsent = historyResult.data.find((item) => item.consent.revokedAt === null) ?? null;
  return {
    ok: true,
    data: {
      eligibleDocuments: eligibleResult.data,
      history: historyResult.data,
      activeConsent,
    },
  };
}

export async function registerConsentAcceptance(
  repository: ConsentRepository,
  input: AcceptConsentInput,
  auditSink: ConsentAuditSink
): Promise<ConsentResult<UserConsent>> {
  const accepted = await repository.acceptConsent(input);
  if (!accepted.ok) return accepted;
  auditSink.registerAccepted({ context: input.context, consent: accepted.data });
  return accepted;
}

export async function registerConsentRevocation(
  repository: ConsentRepository,
  input: RevokeConsentInput,
  auditSink: ConsentAuditSink
): Promise<ConsentResult<UserConsent>> {
  const revoked = await repository.revokeConsent(input);
  if (!revoked.ok) return revoked;
  auditSink.registerRevoked({ context: input.context, consent: revoked.data });
  return revoked;
}
