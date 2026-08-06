import type {
  ClinicalRecordSections,
  ClinicalRecordStatus,
} from '@/services/repositories/clinicalRecord/schema';

export type ClinicalRecordErrorKind =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'technical'
  | 'consistency';

export type ClinicalRecordErrorCode =
  | 'NO_SESSION'
  | 'IDENTITY_MISMATCH'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'CLINICAL_ACCESS_DENIED'
  | 'PATIENT_NOT_IN_PORTFOLIO'
  | 'CROSS_TENANT_DATA'
  | 'INVALID_INPUT'
  | 'VALIDATION_REQUIRED_FIELDS'
  | 'RECORD_CONCLUDED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TECHNICAL_ERROR';

export type ClinicalRecordError = {
  code: ClinicalRecordErrorCode;
  kind: ClinicalRecordErrorKind;
  transient: boolean;
  message: string;
  details?: string;
  cause?: { source: 'repository'; code?: string; message?: string };
};

export type ClinicalRecordResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClinicalRecordError };

export type ClinicalRecordContext = {
  sessionUserId: string;
  professionalUserId: string;
  organizationId: string;
  unitId: string;
};

export type ClinicalRecordChangeKind = 'create' | 'draft_save' | 'conclude' | 'reopen';

export type ClinicalRecord = {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  summary: string;
  recordStatus: ClinicalRecordStatus;
  schemaVersion: string;
  sections: ClinicalRecordSections;
  revisionNumber: number;
  authoredBy: string;
  concludedAt: string | null;
  concludedBy: string | null;
  updatedAt: string;
  status: 'ativo' | 'inativo';
};

export type ClinicalRecordVersion = {
  id: string;
  clinicalRecordId: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  schemaVersion: string;
  sections: ClinicalRecordSections;
  summary: string;
  recordStatus: ClinicalRecordStatus;
  revisionNumber: number;
  changeKind: ClinicalRecordChangeKind;
  authoredBy: string;
  createdAt: string;
};

export type SaveClinicalRecordDraftInput = {
  patientId: string;
  recordId?: string;
  sections: ClinicalRecordSections;
  schemaVersion?: string;
};

export type ConcludeClinicalRecordInput = {
  recordId: string;
  sections: ClinicalRecordSections;
};

export type ReopenClinicalRecordInput = {
  recordId: string;
};
