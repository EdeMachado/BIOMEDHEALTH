import type { ConsentContext, UserConsent } from '@/services/repositories/consent/types';

export type ConsentAuditSink = {
  registerAccepted: (input: { context: ConsentContext; consent: UserConsent }) => void;
  registerRevoked: (input: { context: ConsentContext; consent: UserConsent }) => void;
};

export function createNoopConsentAuditSink(): ConsentAuditSink {
  return {
    registerAccepted() {
      // intentional no-op for tests / unavailable session
    },
    registerRevoked() {
      // intentional no-op for tests / unavailable session
    },
  };
}
