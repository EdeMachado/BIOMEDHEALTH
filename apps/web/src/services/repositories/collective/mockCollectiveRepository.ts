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
  assertContext,
  assertSameOrganization,
  scopeToColumns,
  validateCreateActionPlanWrite,
  validateCreateCampaignWrite,
  validateUpdateActionPlanWrite,
  validateUpdateCampaignWrite,
} from '@/services/repositories/collective/validation';

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function demoSeed(organizationId: string): { campaigns: CampaignRecord[]; plans: ActionPlanRecord[] } {
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

export function createMockCollectiveRepository(): CollectiveRepository {
  const byOrg = new Map<string, { campaigns: CampaignRecord[]; plans: ActionPlanRecord[] }>();

  function store(organizationId: string) {
    let entry = byOrg.get(organizationId);
    if (!entry) {
      entry = demoSeed(organizationId);
      byOrg.set(organizationId, entry);
    }
    return entry;
  }

  return {
    listCampaigns(input: ListCampaignsInput): Promise<CollectiveResult<CampaignRecord[]>> {
      const ctx = assertContext(input.context);
      if (!ctx.ok) return Promise.resolve(ctx);
      let rows = store(input.context.organizationId).campaigns.slice();
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
      return Promise.resolve(ok(found));
    },

    createCampaign(context, input: CreateCampaignInput) {
      const validation = validateCreateCampaignWrite(context, input);
      if (!validation.ok) return Promise.resolve(validation);
      const ts = nowIso();
      const record: CampaignRecord = {
        id: newId(),
        organizationId: input.organizationId,
        scope: input.scope,
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
      store(context.organizationId).campaigns.unshift(record);
      return Promise.resolve(ok(record));
    },

    updateCampaign(context, input: UpdateCampaignInput) {
      const entry = store(context.organizationId);
      const idx = entry.campaigns.findIndex((c) => c.id === input.campaignId);
      if (idx < 0) {
        const early = validateUpdateCampaignWrite(context, input);
        if (!early.ok) return Promise.resolve(early);
        return Promise.resolve(fail('NOT_FOUND'));
      }
      const current = entry.campaigns[idx];
      const validation = validateUpdateCampaignWrite(context, input, current.scope);
      if (!validation.ok) return Promise.resolve(validation);
      const orgCheck = assertSameOrganization(context.organizationId, current.organizationId);
      if (!orgCheck.ok) return Promise.resolve(orgCheck);
      if (input.scope) scopeToColumns(input.scope);
      const next: CampaignRecord = {
        ...current,
        title: input.title ?? current.title,
        description: input.description ?? current.description,
        channel: input.channel ?? current.channel,
        startsAt: input.startsAt ?? current.startsAt,
        endsAt: input.endsAt ?? current.endsAt,
        campaignStatus: input.campaignStatus ?? current.campaignStatus,
        scope: input.scope ?? current.scope,
        version: current.version + 1,
        updatedAt: nowIso(),
      };
      entry.campaigns[idx] = next;
      return Promise.resolve(ok(next));
    },

    deleteCampaign(context, campaignId) {
      const ctx = assertContext(context);
      if (!ctx.ok) return Promise.resolve(ctx);
      const entry = store(context.organizationId);
      const idx = entry.campaigns.findIndex((c) => c.id === campaignId);
      if (idx < 0) return Promise.resolve(fail('NOT_FOUND'));
      entry.campaigns.splice(idx, 1);
      return Promise.resolve(ok({ id: campaignId }));
    },

    listActionPlans(input: ListActionPlansInput) {
      const ctx = assertContext(input.context);
      if (!ctx.ok) return Promise.resolve(ctx);
      let rows = store(input.context.organizationId).plans.slice();
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
      return Promise.resolve(ok(found));
    },

    createActionPlan(context, input: CreateActionPlanInput) {
      const validation = validateCreateActionPlanWrite(context, input);
      if (!validation.ok) return Promise.resolve(validation);
      const ts = nowIso();
      const record: ActionPlanRecord = {
        id: newId(),
        organizationId: input.organizationId,
        scope: input.scope,
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
      store(context.organizationId).plans.unshift(record);
      return Promise.resolve(ok(record));
    },

    updateActionPlan(context, input: UpdateActionPlanInput) {
      const entry = store(context.organizationId);
      const idx = entry.plans.findIndex((p) => p.id === input.actionPlanId);
      if (idx < 0) {
        const early = validateUpdateActionPlanWrite(context, input);
        if (!early.ok) return Promise.resolve(early);
        return Promise.resolve(fail('NOT_FOUND'));
      }
      const current = entry.plans[idx];
      const validation = validateUpdateActionPlanWrite(context, input, current.scope);
      if (!validation.ok) return Promise.resolve(validation);
      const orgCheck = assertSameOrganization(context.organizationId, current.organizationId);
      if (!orgCheck.ok) return Promise.resolve(orgCheck);
      const next: ActionPlanRecord = {
        ...current,
        scope: input.scope ?? current.scope,
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
      return Promise.resolve(ok(next));
    },

    deleteActionPlan(context, actionPlanId) {
      const ctx = assertContext(context);
      if (!ctx.ok) return Promise.resolve(ctx);
      const entry = store(context.organizationId);
      const idx = entry.plans.findIndex((p) => p.id === actionPlanId);
      if (idx < 0) return Promise.resolve(fail('NOT_FOUND'));
      entry.plans.splice(idx, 1);
      return Promise.resolve(ok({ id: actionPlanId }));
    },
  };
}
