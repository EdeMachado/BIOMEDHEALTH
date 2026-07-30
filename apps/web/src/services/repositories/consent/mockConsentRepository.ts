import { fail, ok } from '@/services/repositories/consent/errors';
import type {
  ConsentContext,
  ConsentDocument,
  ConsentHistoryItem,
  ConsentResult,
  UserConsent,
} from '@/services/repositories/consent/types';
import type { ConsentRepository } from '@/services/repositories/consent/contracts';
import { readSessionItem, writeSessionItem } from '@/shared/lib/sessionStorage';
import { generateId } from '@/shared/lib/id';

const STORAGE_KEY = 'biomed_mock_user_consents';

type PersistedConsentRecord = UserConsent;

const BASE_DOCUMENTS: ConsentDocument[] = [
  {
    id: 'doc-lgpd-v1-org1',
    organizationId: 'org-1',
    code: 'lgpd-privacy',
    title: 'Consentimento de privacidade preventiva',
    purpose: 'Operacao da jornada preventiva e comunicacoes essenciais.',
    legalBasis: 'Consentimento do titular',
    documentVersion: '1.0',
    contentHash: 'legacy-id:non-verifiable:11111111-1111-1111-1111-111111111111',
    status: 'ativo',
    effectiveAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
  },
  {
    id: 'doc-lgpd-future-org1',
    organizationId: 'org-1',
    code: 'lgpd-privacy',
    title: 'Consentimento de privacidade preventiva',
    purpose: 'Versao futura de demonstracao.',
    legalBasis: 'Consentimento do titular',
    documentVersion: '2.0',
    contentHash: 'legacy-id:non-verifiable:22222222-2222-2222-2222-222222222222',
    status: 'ativo',
    effectiveAt: '2099-01-01T00:00:00.000Z',
    expiresAt: null,
  },
];

export function createMockConsentRepository(
  input: {
    now?: () => Date;
    documents?: ConsentDocument[];
  } = {}
): ConsentRepository {
  const now = input.now ?? (() => new Date());
  const documents = input.documents ?? BASE_DOCUMENTS;

  return {
    listEligibleDocuments(context) {
      const contextValidation = validateContext(context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);
      const current = now();
      const eligible = documents.filter(
        (document) => document.organizationId === context.organizationId && isConsentDocumentEligible(document, current)
      );
      eligible.sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
      return Promise.resolve(ok(eligible));
    },

    listConsentHistory(context) {
      const contextValidation = validateContext(context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const records = readRecords().filter(
        (record) => record.organizationId === context.organizationId && record.userId === context.userId
      );
      const history: ConsentHistoryItem[] = [];
      for (const record of records) {
        const document = documents.find(
          (candidate) =>
            candidate.id === record.consentDocumentId &&
            candidate.organizationId === context.organizationId
        );
        if (!document) continue;
        history.push({ consent: record, document });
      }
      history.sort((a, b) => b.consent.acceptedAt.localeCompare(a.consent.acceptedAt));
      return Promise.resolve(ok(history));
    },

    acceptConsent(inputData) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const document = documents.find(
        (candidate) =>
          candidate.id === inputData.consentDocumentId &&
          candidate.organizationId === inputData.context.organizationId
      );
      if (!document) return Promise.resolve(fail('INELIGIBLE_DOCUMENT'));
      if (!isConsentDocumentEligible(document, now())) return Promise.resolve(fail('INELIGIBLE_DOCUMENT'));

      const records = readRecords();
      const hasActive = records.some(
        (record) =>
          record.organizationId === inputData.context.organizationId &&
          record.userId === inputData.context.userId &&
          record.consentDocumentId === inputData.consentDocumentId &&
          record.revokedAt === null
      );
      if (hasActive) return Promise.resolve(fail('CONSENT_ALREADY_ACTIVE'));

      const timestamp = now().toISOString();
      const consent: UserConsent = {
        id: generateId(),
        organizationId: inputData.context.organizationId,
        userId: inputData.context.userId as string,
        consentDocumentId: inputData.consentDocumentId,
        source: inputData.source,
        acceptedAt: timestamp,
        revokedAt: null,
        revokedSource: null,
        revokedReason: null,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      records.push(consent);
      writeRecords(records);
      return Promise.resolve(ok(consent));
    },

    revokeConsent(inputData) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const records = readRecords();
      const index = records.findIndex(
        (record) =>
          record.id === inputData.consentId &&
          record.organizationId === inputData.context.organizationId &&
          record.userId === inputData.context.userId
      );
      if (index < 0) return Promise.resolve(fail('CONSENT_NOT_FOUND'));

      const current = records[index];
      if (current.revokedAt !== null) return Promise.resolve(fail('CONSENT_ALREADY_REVOKED'));

      const revokedAt = now().toISOString();
      const updated: UserConsent = {
        ...current,
        revokedAt,
        revokedSource: inputData.revokedSource,
        revokedReason: inputData.revokedReason ?? null,
        version: current.version + 1,
        updatedAt: revokedAt,
      };
      records[index] = updated;
      writeRecords(records);
      return Promise.resolve(ok(updated));
    },
  };
}

export function isConsentDocumentEligible(document: ConsentDocument, now: Date): boolean {
  if (document.status !== 'ativo') return false;
  const effectiveAt = Date.parse(document.effectiveAt);
  if (!Number.isFinite(effectiveAt) || effectiveAt > now.getTime()) return false;
  if (!document.expiresAt) return true;
  const expiresAt = Date.parse(document.expiresAt);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > now.getTime();
}

function validateContext(context: ConsentContext): ConsentResult<true> {
  if (!context.sessionUserId || !context.userId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.userId) return fail('IDENTITY_MISMATCH');
  return ok(true);
}

function readRecords(): PersistedConsentRecord[] {
  const raw = readSessionItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PersistedConsentRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeRecords(records: PersistedConsentRecord[]) {
  writeSessionItem(STORAGE_KEY, JSON.stringify(records.slice(-200)));
}
