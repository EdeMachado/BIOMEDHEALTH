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
import { newCorrelationId } from '@/domains/audit/auditContract';
import { classifyPrivilegeDenial } from '@/domains/audit/classifyPrivilegeDenial';

function validateContext(context: CarePlanContext): CarePlanResult<true> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return { ok: true, data: true };
}

function auditCarePlanResult(
  auditSink: ClinicalAuditSink,
  input: {
    code:
      | 'care_plan_created'
      | 'care_plan_updated'
      | 'care_plan_closed'
      | 'care_plan_suspended'
      | 'care_plan_note_added'
      | 'care_plan_reassessment_added'
      | 'care_plan_action_created'
      | 'care_plan_action_updated'
      | 'care_plan_action_status_changed';
    entity: 'care_plan' | 'care_plan_action';
    entityId?: string;
    result: CarePlanResult<unknown>;
    correlationId: string;
    metadata?: Record<string, string | number | boolean>;
  }
) {
  if (input.result.ok) {
    auditSink.registerSensitiveOperation({
      code: input.code,
      entity: input.entity,
      entityId: input.entityId,
      result: 'sucesso',
      correlationId: input.correlationId,
      provenance: 'application',
      metadata: input.metadata,
    });
    return;
  }

  const classified = classifyPrivilegeDenial({
    errorCode: input.result.error.code,
    message: input.result.error.message,
  });
  auditSink.registerSensitiveOperation({
    code: 'repository_error',
    entity: input.entity,
    entityId: input.entityId,
    result: classified.auditResult === 'denied' ? 'negado' : 'falha',
    correlationId: input.correlationId,
    provenance: classified.provenance,
    metadata: {
      ...input.metadata,
      error_code: classified.sanitizedCode,
    },
  });
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
  const correlationId = newCorrelationId();
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.createCarePlan({ context, plan });
  auditCarePlanResult(auditSink, {
    code: 'care_plan_created',
    entity: 'care_plan',
    entityId: result.ok ? result.data.id : undefined,
    result,
    correlationId,
  });
  return result;
}

export async function updateLinkedCarePlan(
  repository: CarePlanRepository,
  context: CarePlanContext,
  plan: UpdateCarePlanInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<CarePlanResult<CarePlan>> {
  const correlationId = newCorrelationId();
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.updateCarePlan({ context, plan });
  auditCarePlanResult(auditSink, {
    code: 'care_plan_updated',
    entity: 'care_plan',
    entityId: plan.planId,
    result,
    correlationId,
    metadata: { field_category: 'plan_fields' },
  });
  return result;
}

export async function createLinkedCarePlanAction(
  repository: CarePlanRepository,
  context: CarePlanContext,
  action: CreateCarePlanActionInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<CarePlanResult<CarePlanAction>> {
  const correlationId = newCorrelationId();
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.createCarePlanAction({ context, action });
  auditCarePlanResult(auditSink, {
    code: 'care_plan_action_created',
    entity: 'care_plan_action',
    entityId: result.ok ? result.data.id : action.planId,
    result,
    correlationId,
    metadata: { field_category: 'action' },
  });
  return result;
}

export async function updateLinkedCarePlanAction(
  repository: CarePlanRepository,
  context: CarePlanContext,
  action: UpdateCarePlanActionInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<CarePlanResult<CarePlanAction>> {
  const correlationId = newCorrelationId();
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.updateCarePlanAction({ context, action });
  const statusOnly =
    action.actionStatus !== undefined &&
    action.specificObjective === undefined &&
    action.actionText === undefined &&
    action.frequency === undefined &&
    action.dueDate === undefined &&
    action.notes === undefined;
  auditCarePlanResult(auditSink, {
    code: statusOnly ? 'care_plan_action_status_changed' : 'care_plan_action_updated',
    entity: 'care_plan_action',
    entityId: action.actionId,
    result,
    correlationId,
    metadata: {
      field_category: statusOnly ? 'action_status' : 'action',
      ...(action.actionStatus ? { next_status: action.actionStatus } : {}),
    },
  });
  return result;
}

export async function closeLinkedCarePlan(
  repository: CarePlanRepository,
  context: CarePlanContext,
  close: CloseCarePlanInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<CarePlanResult<CarePlan>> {
  const correlationId = newCorrelationId();
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.closeCarePlan({ context, close });
  auditCarePlanResult(auditSink, {
    code: close.mode === 'suspend' ? 'care_plan_suspended' : 'care_plan_closed',
    entity: 'care_plan',
    entityId: result.ok ? result.data.id : close.planId,
    result,
    correlationId,
    metadata: {
      previous_status: 'open',
      next_status: close.mode === 'suspend' ? 'suspended' : 'closed',
    },
  });
  return result;
}

export async function addLinkedCarePlanNote(
  repository: CarePlanRepository,
  context: CarePlanContext,
  note: CarePlanNoteInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<CarePlanResult<CarePlanEvent>> {
  const correlationId = newCorrelationId();
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.addCarePlanNote({ context, note });
  auditCarePlanResult(auditSink, {
    code: note.kind === 'reassessment' ? 'care_plan_reassessment_added' : 'care_plan_note_added',
    entity: 'care_plan',
    entityId: note.planId,
    result,
    correlationId,
    metadata: { field_category: note.kind },
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
