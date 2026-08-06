import { fail } from '@/services/repositories/clinicalRecord/errors';
import type { ClinicalRecordRepository } from '@/services/repositories/clinicalRecord/contracts';
import type {
  ClinicalRecord,
  ClinicalRecordContext,
  ClinicalRecordResult,
  ClinicalRecordVersion,
  ConcludeClinicalRecordInput,
  ReopenClinicalRecordInput,
  SaveClinicalRecordDraftInput,
} from '@/services/repositories/clinicalRecord/types';
import {
  createNoopClinicalAuditSink,
  type ClinicalAuditSink,
} from '@/domains/clinical/clinicalAuditSink';

function validateContext(context: ClinicalRecordContext): ClinicalRecordResult<true> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return { ok: true, data: true };
}

export async function loadLinkedClinicalRecord(
  repository: ClinicalRecordRepository,
  context: ClinicalRecordContext,
  patientId: string
): Promise<ClinicalRecordResult<ClinicalRecord | null>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.getLinkedClinicalRecord({ context, patientId });
}

export async function loadClinicalRecordHistory(
  repository: ClinicalRecordRepository,
  context: ClinicalRecordContext,
  recordId: string
): Promise<ClinicalRecordResult<ClinicalRecordVersion[]>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.listClinicalRecordVersions({ context, recordId });
}

export async function saveLinkedClinicalRecordDraft(
  repository: ClinicalRecordRepository,
  context: ClinicalRecordContext,
  draft: SaveClinicalRecordDraftInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<ClinicalRecordResult<ClinicalRecord>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.saveClinicalRecordDraft({ context, draft });
  auditSink.registerSensitiveOperation({
    code: 'clinical_record_draft_saved',
    entity: 'clinical_record',
    entityId: result.ok ? result.data.id : draft.recordId,
    result: result.ok ? 'sucesso' : 'falha',
  });
  return result;
}

export async function concludeLinkedClinicalRecord(
  repository: ClinicalRecordRepository,
  context: ClinicalRecordContext,
  conclusion: ConcludeClinicalRecordInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<ClinicalRecordResult<ClinicalRecord>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.concludeClinicalRecord({ context, conclusion });
  auditSink.registerSensitiveOperation({
    code: 'clinical_record_concluded',
    entity: 'clinical_record',
    entityId: result.ok ? result.data.id : conclusion.recordId,
    result: result.ok ? 'sucesso' : 'falha',
  });
  return result;
}

export async function reopenLinkedClinicalRecord(
  repository: ClinicalRecordRepository,
  context: ClinicalRecordContext,
  reopen: ReopenClinicalRecordInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<ClinicalRecordResult<ClinicalRecord>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.reopenClinicalRecord({ context, reopen });
  auditSink.registerSensitiveOperation({
    code: 'clinical_record_reopened',
    entity: 'clinical_record',
    entityId: result.ok ? result.data.id : reopen.recordId,
    result: result.ok ? 'sucesso' : 'falha',
  });
  return result;
}
