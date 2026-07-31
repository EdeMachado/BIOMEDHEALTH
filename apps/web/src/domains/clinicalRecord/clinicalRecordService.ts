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
  draft: SaveClinicalRecordDraftInput
): Promise<ClinicalRecordResult<ClinicalRecord>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.saveClinicalRecordDraft({ context, draft });
}

export async function concludeLinkedClinicalRecord(
  repository: ClinicalRecordRepository,
  context: ClinicalRecordContext,
  conclusion: ConcludeClinicalRecordInput
): Promise<ClinicalRecordResult<ClinicalRecord>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.concludeClinicalRecord({ context, conclusion });
}

export async function reopenLinkedClinicalRecord(
  repository: ClinicalRecordRepository,
  context: ClinicalRecordContext,
  reopen: ReopenClinicalRecordInput
): Promise<ClinicalRecordResult<ClinicalRecord>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.reopenClinicalRecord({ context, reopen });
}
