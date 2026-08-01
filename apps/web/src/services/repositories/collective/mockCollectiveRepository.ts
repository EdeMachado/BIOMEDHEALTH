import type { CreateCampaignInput, UpdateCampaignInput } from '@/domains/collective';
import type { CollectiveRepository } from '@/services/repositories/collective/contracts';
import { fail, ok } from '@/services/repositories/collective/errors';
import type {
  ActionPlanRecord,
  CampaignRecord,
  CollectiveResult,
  CreateActionPlanInput,
  ListActionPlansInput,
  ListCampaignsInput,
  UpdateActionPlanInput,
} from '@/services/repositories/collective/types';
import {
  assertAudienceCriteriaEmpty,
  assertContext,
  assertSameOrganization,
  assertUnitIdsValid,
  scopeToColumns,
  validateCreateActionPlanWrite,
  validateCreateCampaignWrite,
  validateUpdateActionPlanWrite,
  validateUpdateCampaignWrite,
} from '@/services/repositories/collective/validation';

type OrgStore = { campaigns: CampaignRecord[]; plans: ActionPlanRecord[] };

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function demoSeed(organizationId: string): OrgStore {
  const ts = nowIso();
  return {
    campaigns: [
      {
        id: 'mock-camp-1',
        organizationId,
        scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
        title: 'Semana do Sono',
        description: 'Aumentar adesao as rotinas de sono',
        channel: 'email',
        startsAt: '2026-08-01',
        endsAt: '2026-08-15',
        campaignStatus: 'Ativa',
        status: 'ativo',
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: 'mock-camp-2',
        organizationId,
        scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
        title: 'Movimente-se com Saude',
        description: 'Incentivar atividade fisica leve',
        channel: 'app',
        startsAt: '2026-08-16',
        endsAt: '2026-08-31',
        campaignStatus: 'Agendada',
        status: 'ativo',
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      },
    ],
    plans: [
      {
        id: 'mock-plan-1',
        organizationId,
        scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
        originIndicator: 'Adesao ao programa',
        issueDescription: 'Baixa participacao coletiva',
        actionText: 'Reforcar comunicacao segmentada',
        ownerName: 'Marina Gestora',
        dueDate: '2026-08-15',
        priority: 'Alta',
        actionStatus: 'Em andamento',
        status: 'ativo',
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      },
    ],
  };
}

function cloneScope(scope: CampaignRecord['scope']): CampaignRecord['scope'] {
  if (scope.scopeType === 'unit') {
    return { scopeType: 'unit', unitId: scope.unitId };
  }
  if (scope.unitApplicability === 'selected_units') {
    return {
      scopeType: 'organization',
      unitId: null,
      unitApplicability: 'selected_units',
      unitIds: [...scope.unitIds] as [string, ...string[]],
    };
  }
  return { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' };
}

function cloneCampaign(record: CampaignRecord): CampaignRecord {
  const copy: CampaignRecord = {
    ...record,
    scope: cloneScope(record.scope),
  };
  if (record.audience) {
    copy.audience = {
      audienceLabel: record.audience.audienceLabel,
      ...(record.audience.criteria ? { criteria: { ...record.audience.criteria } } : {}),
    };
  }
  return copy;
}

function clonePlan(record: ActionPlanRecord): ActionPlanRecord {
  return {
    ...record,
    scope: cloneScope(record.scope),
  };
}

export function createMockCollectiveRepository(): CollectiveRepository {
  const byOrg = new Map<string, OrgStore>();

  function store(organizationId: string): OrgStore {
    let entry = byOrg.get(organizationId);
    if (!entry) {
      entry = demoSeed(organizationId);
      byOrg.set(organizationId, entry);
    }
    return entry;
  }

  function restore(organizationId: string, snapshot: OrgStore) {
    byOrg.set(organizationId, snapshot);
  }

  function beginMutation(organizationId: string): { entry: OrgStore; snapshot: OrgStore } {
    const entry = store(organizationId);
    return { entry, snapshot: cloneValue(entry) };
  }

  return {
    listCampaigns(input: ListCampaignsInput): Promise<CollectiveResult<CampaignRecord[]>> {
      const ctx = assertContext(input.context);
      if (!ctx.ok) return Promise.resolve(ctx);
      let rows = store(input.context.organizationId).campaigns.map(cloneCampaign);
      if (input.campaignStatus) {
        rows = rows.filter((r) => r.campaignStatus === input.campaignStatus);
      }
      if (input.search) {
        const q = input.search.toLowerCase();
        rows = rows.filter((r) => r.title.toLowerCase().includes(q));
      }
      return Promise.resolve(ok(rows));
    },

    getCampaign(context, campaignId) {
      const ctx = assertContext(context);
      if (!ctx.ok) return Promise.resolve(ctx);
      const found = store(context.organizationId).campaigns.find((c) => c.id === campaignId);
      if (!found) return Promise.resolve(fail('NOT_FOUND'));
      return Promise.resolve(ok(cloneCampaign(found)));
    },

    createCampaign(context, input: CreateCampaignInput) {
      const validation = validateCreateCampaignWrite(context, input);
      if (!validation.ok) return Promise.resolve(validation);

      const { entry, snapshot } = beginMutation(context.organizationId);
      const ts = nowIso();

      // Mid-way checks (copy-on-write rollback on failure).
      if (input.scope.scopeType === 'organization' && input.scope.unitApplicability === 'selected_units') {
        const units = assertUnitIdsValid(input.scope.unitIds);
        if (!units.ok) {
          restore(context.organizationId, snapshot);
          return Promise.resolve(units);
        }
      }
      const audienceCheck = assertAudienceCriteriaEmpty(input.audience);
      if (!audienceCheck.ok) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(audienceCheck);
      }

      const record: CampaignRecord = {
        id: newId(),
        organizationId: input.organizationId,
        scope: cloneScope(input.scope),
        title: input.title,
        description: input.description,
        channel: input.channel,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        campaignStatus: 'Rascunho',
        status: 'ativo',
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      };
      if (input.audience) {
        record.audience = {
          audienceLabel: input.audience.audienceLabel,
          ...(input.audience.criteria ? { criteria: { ...input.audience.criteria } } : {}),
        };
      }

      entry.campaigns.unshift(record);
      return Promise.resolve(ok(cloneCampaign(record)));
    },

    updateCampaign(context, input: UpdateCampaignInput) {
      const earlyCtx = assertContext(context);
      if (!earlyCtx.ok) return Promise.resolve(earlyCtx);

      const { entry, snapshot } = beginMutation(context.organizationId);
      const idx = entry.campaigns.findIndex((c) => c.id === input.campaignId);
      if (idx < 0) {
        const early = validateUpdateCampaignWrite(context, input);
        restore(context.organizationId, snapshot);
        if (!early.ok) return Promise.resolve(early);
        return Promise.resolve(fail('NOT_FOUND'));
      }

      const current = entry.campaigns[idx];
      const expectedVersion = current.version;
      const validation = validateUpdateCampaignWrite(context, input, current.scope);
      if (!validation.ok) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(validation);
      }
      const orgCheck = assertSameOrganization(context.organizationId, current.organizationId);
      if (!orgCheck.ok) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(orgCheck);
      }

      if (entry.campaigns[idx].version !== expectedVersion) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(fail('CONFLICT'));
      }

      const nextScope = input.scope ? cloneScope(input.scope) : cloneScope(current.scope);
      if (input.scope) {
        scopeToColumns(input.scope);
        if (
          input.scope.scopeType === 'organization' &&
          input.scope.unitApplicability === 'selected_units'
        ) {
          const units = assertUnitIdsValid(input.scope.unitIds);
          if (!units.ok) {
            restore(context.organizationId, snapshot);
            return Promise.resolve(units);
          }
        }
      }

      const next: CampaignRecord = {
        ...cloneCampaign(current),
        title: input.title ?? current.title,
        description: input.description ?? current.description,
        channel: input.channel ?? current.channel,
        startsAt: input.startsAt ?? current.startsAt,
        endsAt: input.endsAt ?? current.endsAt,
        campaignStatus: input.campaignStatus ?? current.campaignStatus,
        scope: nextScope,
        version: current.version + 1,
        updatedAt: nowIso(),
      };

      if (Object.prototype.hasOwnProperty.call(input, 'audience')) {
        if (input.audience === null) {
          delete next.audience;
        } else if (input.audience !== undefined) {
          const audienceCheck = assertAudienceCriteriaEmpty(input.audience);
          if (!audienceCheck.ok) {
            restore(context.organizationId, snapshot);
            return Promise.resolve(audienceCheck);
          }
          if (!input.audience.audienceLabel?.trim()) {
            restore(context.organizationId, snapshot);
            return Promise.resolve(fail('INVALID_INPUT', { message: 'audienceLabel obrigatorio.' }));
          }
          next.audience = {
            audienceLabel: input.audience.audienceLabel,
            ...(input.audience.criteria ? { criteria: { ...input.audience.criteria } } : {}),
          };
        }
      }

      entry.campaigns[idx] = next;
      return Promise.resolve(ok(cloneCampaign(next)));
    },

    deleteCampaign(context, campaignId) {
      const ctx = assertContext(context);
      if (!ctx.ok) return Promise.resolve(ctx);
      const { entry, snapshot } = beginMutation(context.organizationId);
      const idx = entry.campaigns.findIndex((c) => c.id === campaignId);
      if (idx < 0) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(fail('NOT_FOUND'));
      }
      const [removed] = entry.campaigns.splice(idx, 1);
      if (!removed || removed.id !== campaignId) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(fail('AUTHORIZATION_DENIED', { transient: false }));
      }
      return Promise.resolve(ok({ id: campaignId }));
    },

    listActionPlans(input: ListActionPlansInput) {
      const ctx = assertContext(input.context);
      if (!ctx.ok) return Promise.resolve(ctx);
      let rows = store(input.context.organizationId).plans.map(clonePlan);
      if (input.actionStatus) {
        rows = rows.filter((r) => r.actionStatus === input.actionStatus);
      }
      return Promise.resolve(ok(rows));
    },

    getActionPlan(context, actionPlanId) {
      const ctx = assertContext(context);
      if (!ctx.ok) return Promise.resolve(ctx);
      const found = store(context.organizationId).plans.find((p) => p.id === actionPlanId);
      if (!found) return Promise.resolve(fail('NOT_FOUND'));
      return Promise.resolve(ok(clonePlan(found)));
    },

    createActionPlan(context, input: CreateActionPlanInput) {
      const validation = validateCreateActionPlanWrite(context, input);
      if (!validation.ok) return Promise.resolve(validation);

      const { entry, snapshot } = beginMutation(context.organizationId);
      if (input.scope.scopeType === 'organization' && input.scope.unitApplicability === 'selected_units') {
        const units = assertUnitIdsValid(input.scope.unitIds);
        if (!units.ok) {
          restore(context.organizationId, snapshot);
          return Promise.resolve(units);
        }
      }

      const ts = nowIso();
      const record: ActionPlanRecord = {
        id: newId(),
        organizationId: input.organizationId,
        scope: cloneScope(input.scope),
        originIndicator: input.originIndicator,
        issueDescription: input.issueDescription,
        actionText: input.actionText,
        ownerName: input.ownerName,
        dueDate: input.dueDate,
        priority: input.priority,
        actionStatus: input.actionStatus ?? 'Planejado',
        status: 'ativo',
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      };
      entry.plans.unshift(record);
      return Promise.resolve(ok(clonePlan(record)));
    },

    updateActionPlan(context, input: UpdateActionPlanInput) {
      const earlyCtx = assertContext(context);
      if (!earlyCtx.ok) return Promise.resolve(earlyCtx);

      const { entry, snapshot } = beginMutation(context.organizationId);
      const idx = entry.plans.findIndex((p) => p.id === input.actionPlanId);
      if (idx < 0) {
        const early = validateUpdateActionPlanWrite(context, input);
        restore(context.organizationId, snapshot);
        if (!early.ok) return Promise.resolve(early);
        return Promise.resolve(fail('NOT_FOUND'));
      }

      const current = entry.plans[idx];
      const expectedVersion = current.version;
      const validation = validateUpdateActionPlanWrite(context, input, current.scope);
      if (!validation.ok) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(validation);
      }
      const orgCheck = assertSameOrganization(context.organizationId, current.organizationId);
      if (!orgCheck.ok) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(orgCheck);
      }

      if (entry.plans[idx].version !== expectedVersion) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(fail('CONFLICT'));
      }

      if (input.scope) {
        scopeToColumns(input.scope);
        if (
          input.scope.scopeType === 'organization' &&
          input.scope.unitApplicability === 'selected_units'
        ) {
          const units = assertUnitIdsValid(input.scope.unitIds);
          if (!units.ok) {
            restore(context.organizationId, snapshot);
            return Promise.resolve(units);
          }
        }
      }

      const next: ActionPlanRecord = {
        ...clonePlan(current),
        scope: input.scope ? cloneScope(input.scope) : cloneScope(current.scope),
        originIndicator: input.originIndicator ?? current.originIndicator,
        issueDescription: input.issueDescription ?? current.issueDescription,
        actionText: input.actionText ?? current.actionText,
        ownerName: input.ownerName ?? current.ownerName,
        dueDate: input.dueDate ?? current.dueDate,
        priority: input.priority ?? current.priority,
        actionStatus: input.actionStatus ?? current.actionStatus,
        version: current.version + 1,
        updatedAt: nowIso(),
      };
      entry.plans[idx] = next;
      return Promise.resolve(ok(clonePlan(next)));
    },

    deleteActionPlan(context, actionPlanId) {
      const ctx = assertContext(context);
      if (!ctx.ok) return Promise.resolve(ctx);
      const { entry, snapshot } = beginMutation(context.organizationId);
      const idx = entry.plans.findIndex((p) => p.id === actionPlanId);
      if (idx < 0) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(fail('NOT_FOUND'));
      }
      const [removed] = entry.plans.splice(idx, 1);
      if (!removed || removed.id !== actionPlanId) {
        restore(context.organizationId, snapshot);
        return Promise.resolve(fail('AUTHORIZATION_DENIED', { transient: false }));
      }
      return Promise.resolve(ok({ id: actionPlanId }));
    },
  };
}
