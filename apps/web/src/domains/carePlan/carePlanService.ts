import { fail } from '@/services/repositories/carePlan/errors';
import type { CarePlanRepository } from '@/services/repositories/carePlan/contracts';
import type {
  CarePlan,
  CarePlanAction,
  CarePlanBundle,
  CarePlanContext,
  CarePlanEvent,
  CarePlanNoteInput,
  CarePlanResult,
  CloseCarePlanInput,
  CreateCarePlanActionInput,
  CreateCarePlanInput,
  UpdateCarePlanActionInput,
  UpdateCarePlanInput,
} from '@/services/repositories/carePlan/types';
import {
  createNoopClinicalAuditSink,
  type ClinicalAuditSink,
} from '@/domains/clinical/clinicalAuditSink';

function validateContext(context: CarePlanContext): CarePlanResult<true> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return { ok: true, data: true };
}

export async function listLinkedCarePlans(
  repository: CarePlanRepository,
  context: CarePlanContext,
  patientId: string
): Promise<CarePlanResult<CarePlan[]>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.listCarePlans({ context, patientId });
}

export async function loadOpenCarePlan(
  repository: CarePlanRepository,
  context: CarePlanContext,
  patientId: string
): Promise<CarePlanResult<CarePlanBundle | null>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.getOpenCarePlan({ context, patientId });
}

export async function loadCarePlanBundle(
  repository: CarePlanRepository,
  context: CarePlanContext,
  planId: string
): Promise<CarePlanResult<CarePlanBundle>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.getCarePlanBundle({ context, planId });
}

export async function createLinkedCarePlan(
  repository: CarePlanRepository,
  context: CarePlanContext,
  plan: CreateCarePlanInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<CarePlanResult<CarePlan>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.createCarePlan({ context, plan });
  auditSink.registerSensitiveOperation({
    code: 'care_plan_created',
    entity: 'care_plan',
    entityId: result.ok ? result.data.id : undefined,
    result: result.ok ? 'sucesso' : 'falha',
  });
  return result;
}

export async function updateLinkedCarePlan(
  repository: CarePlanRepository,
  context: CarePlanContext,
  plan: UpdateCarePlanInput
): Promise<CarePlanResult<CarePlan>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.updateCarePlan({ context, plan });
}

export async function createLinkedCarePlanAction(
  repository: CarePlanRepository,
  context: CarePlanContext,
  action: CreateCarePlanActionInput
): Promise<CarePlanResult<CarePlanAction>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.createCarePlanAction({ context, action });
}

export async function updateLinkedCarePlanAction(
  repository: CarePlanRepository,
  context: CarePlanContext,
  action: UpdateCarePlanActionInput
): Promise<CarePlanResult<CarePlanAction>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.updateCarePlanAction({ context, action });
}

export async function closeLinkedCarePlan(
  repository: CarePlanRepository,
  context: CarePlanContext,
  close: CloseCarePlanInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<CarePlanResult<CarePlan>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.closeCarePlan({ context, close });
  auditSink.registerSensitiveOperation({
    code: 'care_plan_closed',
    entity: 'care_plan',
    entityId: result.ok ? result.data.id : close.planId,
    result: result.ok ? 'sucesso' : 'falha',
  });
  return result;
}

export async function addLinkedCarePlanNote(
  repository: CarePlanRepository,
  context: CarePlanContext,
  note: CarePlanNoteInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<CarePlanResult<CarePlanEvent>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.addCarePlanNote({ context, note });
  auditSink.registerSensitiveOperation({
    code: 'care_plan_note_added',
    entity: 'care_plan',
    entityId: note.planId,
    result: result.ok ? 'sucesso' : 'falha',
  });
  return result;
}

export async function loadCarePlanHistory(
  repository: CarePlanRepository,
  context: CarePlanContext,
  planId: string
): Promise<CarePlanResult<CarePlanEvent[]>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.listCarePlanEvents({ context, planId });
}
