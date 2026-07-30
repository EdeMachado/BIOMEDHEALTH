import type { ConsentContext, UserConsent } from '@/services/repositories/consent/types';

export type ConsentAuditSink = {
  registerAccepted: (input: { context: ConsentContext; consent: UserConsent }) => void;
  registerRevoked: (input: { context: ConsentContext; consent: UserConsent }) => void;
};

export function createNoopConsentAuditSink(): ConsentAuditSink {
  return {
    registerAccepted() {
      // SUP-E01 pendente: trilha append-only persistente via RPC controlada.
    },
    registerRevoked() {
      // SUP-E01 pendente: trilha append-only persistente via RPC controlada.
    },
  };
}
