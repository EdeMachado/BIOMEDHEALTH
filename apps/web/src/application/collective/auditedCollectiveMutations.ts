import type { CreateCampaignInput, UpdateCampaignInput } from '@/domains/collective';
import {
  createNoopCollectiveAuditSink,
  type CollectiveAuditActor,
  type CollectiveAuditCode,
  type CollectiveAuditSink,
} from '@/domains/collective/collectiveAuditSink';
import type { CollectiveRepository } from '@/services/repositories/collective/contracts';
import { fail } from '@/services/repositories/collective/errors';
import type {
  ActionPlanRecord,
  CampaignRecord,
  CollectiveContext,
  CollectiveResult,
  CreateActionPlanInput,
  UpdateActionPlanInput,
} from '@/services/repositories/collective/types';
import { newCorrelationId } from '@/domains/audit/auditContract';
import { classifyPrivilegeDenial } from '@/domains/audit/classifyPrivilegeDenial';

export type AuditedCollectiveDeps = {
  repository: CollectiveRepository;
  context: CollectiveContext | null;
  canWrite: boolean;
  actor: CollectiveAuditActor | null;
  auditSink?: CollectiveAuditSink;
};

function sinkOf(deps: AuditedCollectiveDeps): CollectiveAuditSink {
  return deps.auditSink ?? createNoopCollectiveAuditSink();
}

async function deny(
  deps: AuditedCollectiveDeps,
  code: 'permission_denied' | 'context_denied',
  entity: 'campaign' | 'action_plan',
  correlationId: string
): Promise<CollectiveResult<never>> {
  const sink = sinkOf(deps);
  if (deps.actor?.organizationId) {
    await sink.registerFinal({
      code,
      entity,
      result: 'denied',
      correlationId,
      metadata: { provenance: 'application_precheck_denied' },
    });
  }
  return fail(code === 'permission_denied' ? 'AUTHORIZATION_DENIED' : 'NO_SESSION');
}

async function afterMutation<T extends { id: string }>(
  deps: AuditedCollectiveDeps,
  input: {
    code: CollectiveAuditCode;
    entity: 'campaign' | 'action_plan';
    correlationId: string;
    result: CollectiveResult<T>;
    metadata?: Record<string, string | number | boolean>;
  }
): Promise<CollectiveResult<T>> {
  const sink = sinkOf(deps);
  const classified = !input.result.ok
    ? classifyPrivilegeDenial({
        errorCode: input.result.error.code,
        message: input.result.error.message,
      })
    : null;
  const auditResult = input.result.ok
    ? 'success'
    : classified?.auditResult === 'denied'
      ? 'denied'
      : 'error';
  const entityId = input.result.ok ? input.result.data.id : undefined;
  const errorCode = classified?.sanitizedCode;
  const persisted = await sink.registerFinal({
    code: input.result.ok
      ? input.code
      : classified?.provenance === 'application_precheck_denied'
        ? 'permission_denied'
        : 'repository_error',
    entity: input.entity,
    entityId,
    result: auditResult,
    correlationId: input.correlationId,
    metadata: {
      ...input.metadata,
      ...(errorCode ? { error_code: errorCode } : {}),
      ...(classified ? { provenance: classified.provenance } : { provenance: 'application' }),
    },
  });

  if (input.result.ok && !persisted.ok) {
    return fail('AUDIT_REQUIRED_FAILED', { message: persisted.message });
  }
  return input.result;
}

export async function auditedCreateCampaign(
  deps: AuditedCollectiveDeps,
  input: CreateCampaignInput
): Promise<CollectiveResult<CampaignRecord>> {
  const correlationId = newCorrelationId();
  if (!deps.context || !deps.actor) return deny(deps, 'context_denied', 'campaign', correlationId);
  if (!deps.canWrite) return deny(deps, 'permission_denied', 'campaign', correlationId);
  const result = await deps.repository.createCampaign(deps.context, input);
  return afterMutation(deps, {
    code: 'campaign_created',
    entity: 'campaign',
    correlationId,
    result,
  });
}

export async function auditedUpdateCampaign(
  deps: AuditedCollectiveDeps,
  input: UpdateCampaignInput,
  options?: { closed?: boolean }
): Promise<CollectiveResult<CampaignRecord>> {
  const correlationId = newCorrelationId();
  if (!deps.context || !deps.actor) return deny(deps, 'context_denied', 'campaign', correlationId);
  if (!deps.canWrite) return deny(deps, 'permission_denied', 'campaign', correlationId);
  const result = await deps.repository.updateCampaign(deps.context, input);
  return afterMutation(deps, {
    code: options?.closed ? 'campaign_closed' : 'campaign_updated',
    entity: 'campaign',
    correlationId,
    result,
    metadata: options?.closed ? { campaign_status: 'Encerrada' } : undefined,
  });
}

export async function auditedDeleteCampaign(
  deps: AuditedCollectiveDeps,
  campaignId: string
): Promise<CollectiveResult<{ id: string }>> {
  const correlationId = newCorrelationId();
  if (!deps.context || !deps.actor) return deny(deps, 'context_denied', 'campaign', correlationId);
  if (!deps.canWrite) return deny(deps, 'permission_denied', 'campaign', correlationId);
  const result = await deps.repository.deleteCampaign(deps.context, campaignId);
  return afterMutation(deps, {
    code: 'campaign_deleted',
    entity: 'campaign',
    correlationId,
    result,
  });
}

export async function auditedCreateActionPlan(
  deps: AuditedCollectiveDeps,
  input: CreateActionPlanInput
): Promise<CollectiveResult<ActionPlanRecord>> {
  const correlationId = newCorrelationId();
  if (!deps.context || !deps.actor) return deny(deps, 'context_denied', 'action_plan', correlationId);
  if (!deps.canWrite) return deny(deps, 'permission_denied', 'action_plan', correlationId);
  const result = await deps.repository.createActionPlan(deps.context, input);
  return afterMutation(deps, {
    code: 'action_plan_created',
    entity: 'action_plan',
    correlationId,
    result,
  });
}

export async function auditedUpdateActionPlan(
  deps: AuditedCollectiveDeps,
  input: UpdateActionPlanInput,
  options?: { advanced?: boolean; previousStatus?: string; nextStatus?: string }
): Promise<CollectiveResult<ActionPlanRecord>> {
  const correlationId = newCorrelationId();
  if (!deps.context || !deps.actor) return deny(deps, 'context_denied', 'action_plan', correlationId);
  if (!deps.canWrite) return deny(deps, 'permission_denied', 'action_plan', correlationId);
  const result = await deps.repository.updateActionPlan(deps.context, input);
  return afterMutation(deps, {
    code: options?.advanced ? 'action_plan_status_advanced' : 'action_plan_updated',
    entity: 'action_plan',
    correlationId,
    result,
    metadata: {
      ...(options?.previousStatus ? { previous_status: options.previousStatus } : {}),
      ...(options?.nextStatus ? { next_status: options.nextStatus } : {}),
    },
  });
}

export async function auditedDeleteActionPlan(
  deps: AuditedCollectiveDeps,
  actionPlanId: string
): Promise<CollectiveResult<{ id: string }>> {
  const correlationId = newCorrelationId();
  if (!deps.context || !deps.actor) return deny(deps, 'context_denied', 'action_plan', correlationId);
  if (!deps.canWrite) return deny(deps, 'permission_denied', 'action_plan', correlationId);
  const result = await deps.repository.deleteActionPlan(deps.context, actionPlanId);
  return afterMutation(deps, {
    code: 'action_plan_deleted',
    entity: 'action_plan',
    correlationId,
    result,
  });
}
