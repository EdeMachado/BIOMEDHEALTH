import type {
  ClinicalRecord,
  ClinicalRecordContext,
  ClinicalRecordResult,
  ClinicalRecordVersion,
  ConcludeClinicalRecordInput,
  ReopenClinicalRecordInput,
  SaveClinicalRecordDraftInput,
} from '@/services/repositories/clinicalRecord/types';

export interface ClinicalRecordRepository {
  getLinkedClinicalRecord(input: {
    context: ClinicalRecordContext;
    patientId: string;
  }): Promise<ClinicalRecordResult<ClinicalRecord | null>>;

  listClinicalRecordVersions(input: {
    context: ClinicalRecordContext;
    recordId: string;
  }): Promise<ClinicalRecordResult<ClinicalRecordVersion[]>>;

  saveClinicalRecordDraft(input: {
    context: ClinicalRecordContext;
    draft: SaveClinicalRecordDraftInput;
  }): Promise<ClinicalRecordResult<ClinicalRecord>>;

  concludeClinicalRecord(input: {
    context: ClinicalRecordContext;
    conclusion: ConcludeClinicalRecordInput;
  }): Promise<ClinicalRecordResult<ClinicalRecord>>;

  reopenClinicalRecord(input: {
    context: ClinicalRecordContext;
    reopen: ReopenClinicalRecordInput;
  }): Promise<ClinicalRecordResult<ClinicalRecord>>;
}
