import { fail, ok } from '@/services/repositories/clinicalRecord/errors';
import type { ClinicalRecordRepository } from '@/services/repositories/clinicalRecord/contracts';
import {
  CLINICAL_RECORD_SCHEMA_VERSION,
  deriveClinicalRecordSummary,
  emptyClinicalRecordSections,
  mergeClinicalRecordSections,
  missingRequiredConclusionFields,
} from '@/services/repositories/clinicalRecord/schema';
import type {
  ClinicalRecord,
  ClinicalRecordContext,
  ClinicalRecordResult,
  ClinicalRecordVersion,
} from '@/services/repositories/clinicalRecord/types';
import { assignedPatientsByProfessional } from '@/services/repositories/demoData';

type MockState = {
  records: ClinicalRecord[];
  versions: ClinicalRecordVersion[];
};

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validateContext(context: ClinicalRecordContext): ClinicalRecordResult<true> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return ok(true);
}

function isKnownClinicalProfessional(professionalId: string): boolean {
  return Object.prototype.hasOwnProperty.call(assignedPatientsByProfessional, professionalId);
}

function portfolioPatientIds(context: ClinicalRecordContext): Set<string> {
  return new Set((assignedPatientsByProfessional[context.professionalUserId] ?? []).filter(Boolean));
}

function assertClinicalAccess(context: ClinicalRecordContext): ClinicalRecordResult<true> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  if (!isKnownClinicalProfessional(context.professionalUserId)) {
    return fail('CLINICAL_ACCESS_DENIED');
  }
  return ok(true);
}

function snapshot(
  record: ClinicalRecord,
  changeKind: ClinicalRecordVersion['changeKind'],
  versions: ClinicalRecordVersion[]
): void {
  versions.push({
    id: createId('crv'),
    clinicalRecordId: record.id,
    organizationId: record.organizationId,
    patientId: record.patientId,
    professionalId: record.professionalId,
    schemaVersion: record.schemaVersion,
    sections: mergeClinicalRecordSections(record.sections),
    summary: record.summary,
    recordStatus: record.recordStatus,
    revisionNumber: record.revisionNumber,
    changeKind,
    authoredBy: record.authoredBy,
    createdAt: new Date().toISOString(),
  });
}

export function createMockClinicalRecordRepository(
  input: { seed?: Partial<MockState> } = {}
): ClinicalRecordRepository {
  const state: MockState = {
    records: input.seed?.records ? [...input.seed.records] : [],
    versions: input.seed?.versions ? [...input.seed.versions] : [],
  };

  return {
    getLinkedClinicalRecord({ context, patientId }) {
      const access = assertClinicalAccess(context);
      if (!access.ok) return Promise.resolve(access);
      if (!patientId) return Promise.resolve(fail('INVALID_INPUT'));
      if (!portfolioPatientIds(context).has(patientId)) {
        return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      }

      const record =
        state.records.find(
          (item) =>
            item.status === 'ativo' &&
            item.organizationId === context.organizationId &&
            item.professionalId === context.professionalUserId &&
            item.patientId === patientId
        ) ?? null;
      return Promise.resolve(
        ok(record ? { ...record, sections: mergeClinicalRecordSections(record.sections) } : null)
      );
    },

    listClinicalRecordVersions({ context, recordId }) {
      const access = assertClinicalAccess(context);
      if (!access.ok) return Promise.resolve(access);
      const record = state.records.find((item) => item.id === recordId);
      if (!record) return Promise.resolve(fail('NOT_FOUND'));
      if (
        record.organizationId !== context.organizationId ||
        record.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolioPatientIds(context).has(record.patientId)) {
        return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      }

      const versions = state.versions
        .filter((item) => item.clinicalRecordId === recordId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return Promise.resolve(
        ok(versions.map((item) => ({ ...item, sections: mergeClinicalRecordSections(item.sections) })))
      );
    },

    saveClinicalRecordDraft({ context, draft }) {
      const access = assertClinicalAccess(context);
      if (!access.ok) return Promise.resolve(access);
      if (!draft.patientId) return Promise.resolve(fail('INVALID_INPUT'));
      if (!portfolioPatientIds(context).has(draft.patientId)) {
        return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      }

      const sections = mergeClinicalRecordSections(draft.sections);
      const summary = deriveClinicalRecordSummary(sections);
      const schemaVersion = draft.schemaVersion ?? CLINICAL_RECORD_SCHEMA_VERSION;
      const now = new Date().toISOString();

      if (draft.recordId) {
        const index = state.records.findIndex((item) => item.id === draft.recordId);
        if (index < 0) return Promise.resolve(fail('NOT_FOUND'));
        const current = state.records[index];
        if (
          current.organizationId !== context.organizationId ||
          current.professionalId !== context.professionalUserId
        ) {
          return Promise.resolve(fail('CROSS_TENANT_DATA'));
        }
        if (current.patientId !== draft.patientId) return Promise.resolve(fail('INVALID_INPUT'));
        if (current.recordStatus === 'concluido') return Promise.resolve(fail('RECORD_CONCLUDED'));

        const updated: ClinicalRecord = {
          ...current,
          sections,
          summary,
          schemaVersion,
          authoredBy: context.professionalUserId,
          updatedAt: now,
        };
        state.records[index] = updated;
        snapshot(updated, 'draft_save', state.versions);
        return Promise.resolve(ok(updated));
      }

      const duplicate = state.records.find(
        (item) =>
          item.status === 'ativo' &&
          item.organizationId === context.organizationId &&
          item.professionalId === context.professionalUserId &&
          item.patientId === draft.patientId
      );
      if (duplicate) return Promise.resolve(fail('CONFLICT'));

      const created: ClinicalRecord = {
        id: createId('cr'),
        organizationId: context.organizationId,
        patientId: draft.patientId,
        professionalId: context.professionalUserId,
        summary,
        recordStatus: 'rascunho',
        schemaVersion,
        sections,
        revisionNumber: 1,
        authoredBy: context.professionalUserId,
        concludedAt: null,
        concludedBy: null,
        updatedAt: now,
        status: 'ativo',
      };
      state.records.push(created);
      snapshot(created, 'create', state.versions);
      return Promise.resolve(ok(created));
    },

    concludeClinicalRecord({ context, conclusion }) {
      const access = assertClinicalAccess(context);
      if (!access.ok) return Promise.resolve(access);

      const index = state.records.findIndex((item) => item.id === conclusion.recordId);
      if (index < 0) return Promise.resolve(fail('NOT_FOUND'));
      const current = state.records[index];
      if (
        current.organizationId !== context.organizationId ||
        current.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolioPatientIds(context).has(current.patientId)) {
        return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      }
      if (current.recordStatus === 'concluido') return Promise.resolve(fail('RECORD_CONCLUDED'));

      const sections = mergeClinicalRecordSections(conclusion.sections);
      const missing = missingRequiredConclusionFields(sections);
      if (missing.length > 0) {
        return Promise.resolve(fail('VALIDATION_REQUIRED_FIELDS', { details: missing.join(',') }));
      }

      const now = new Date().toISOString();
      const updated: ClinicalRecord = {
        ...current,
        sections,
        summary: deriveClinicalRecordSummary(sections),
        recordStatus: 'concluido',
        authoredBy: context.professionalUserId,
        concludedAt: now,
        concludedBy: context.professionalUserId,
        updatedAt: now,
      };
      state.records[index] = updated;
      snapshot(updated, 'conclude', state.versions);
      return Promise.resolve(ok(updated));
    },

    reopenClinicalRecord({ context, reopen }) {
      const access = assertClinicalAccess(context);
      if (!access.ok) return Promise.resolve(access);

      const index = state.records.findIndex((item) => item.id === reopen.recordId);
      if (index < 0) return Promise.resolve(fail('NOT_FOUND'));
      const current = state.records[index];
      if (
        current.organizationId !== context.organizationId ||
        current.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolioPatientIds(context).has(current.patientId)) {
        return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      }
      if (current.recordStatus !== 'concluido') return Promise.resolve(fail('INVALID_INPUT'));

      const now = new Date().toISOString();
      const updated: ClinicalRecord = {
        ...current,
        recordStatus: 'rascunho',
        revisionNumber: current.revisionNumber + 1,
        authoredBy: context.professionalUserId,
        concludedAt: null,
        concludedBy: null,
        updatedAt: now,
      };
      state.records[index] = updated;
      snapshot(updated, 'reopen', state.versions);
      return Promise.resolve(ok(updated));
    },
  };
}

export function createEmptyMockClinicalRecordSections() {
  return emptyClinicalRecordSections();
}
