import type { CollectiveScope, CreateCampaignInput, UpdateCampaignInput } from '@/domains/collective';
import type { CollectiveRepository } from '@/services/repositories/collective/contracts';
import { fail, ok } from '@/services/repositories/collective/errors';
import type {
  ActionPlanRecord,
  CampaignRecord,
  CollectiveContext,
  CollectiveError,
  CollectiveResult,
  CreateActionPlanInput,
  ListActionPlansInput,
  ListCampaignsInput,
  UpdateActionPlanInput,
} from '@/services/repositories/collective/types';
import {
  assertContext,
  assertSameOrganization,
  columnsToScope,
  scopeToColumns,
  validateCreateActionPlanWrite,
  validateCreateCampaignWrite,
  validateUpdateActionPlanWrite,
  validateUpdateCampaignWrite,
} from '@/services/repositories/collective/validation';

/** Unit ids already persisted for selected_units; used when mapping mutation rows without a second get. */
function unitIdsFromExistingScope(
  existingScope: CollectiveScope,
  nextScope: CollectiveScope | undefined
): string[] {
  const scope = nextScope ?? existingScope;
  if (scope.scopeType === 'organization' && scope.unitApplicability === 'selected_units') {
    return [...scope.unitIds];
  }
  return [];
}

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

type SupabaseAuthResponse = {
  data: { user: { id?: string } | null };
  error: SupabaseLikeError | null;
};

type SupabaseQueryResponse<T> = { data: T | null; error: SupabaseLikeError | null };

interface SupabaseFilterBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  eq(column: string, value: unknown): SupabaseFilterBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseFilterBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
  in(column: string, values: unknown[]): SupabaseFilterBuilder;
}

interface SupabaseInsertBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  select(columns: string): SupabaseFilterBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

interface SupabaseUpdateBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  eq(column: string, value: unknown): SupabaseUpdateBuilder;
  select(columns: string): SupabaseFilterBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

interface SupabaseDeleteBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  eq(column: string, value: unknown): SupabaseDeleteBuilder;
  select(columns: string): SupabaseFilterBuilder;
}

export interface SupabaseCollectiveClient {
  auth: { getUser(): Promise<SupabaseAuthResponse> };
  from(table: string): {
    select(columns: string): SupabaseFilterBuilder;
    insert(values: Record<string, unknown> | Record<string, unknown>[]): SupabaseInsertBuilder;
    update(values: Record<string, unknown>): SupabaseUpdateBuilder;
    delete(): SupabaseDeleteBuilder;
  };
}

type CampaignRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  channel: string;
  starts_at: string;
  ends_at: string;
  campaign_status: string;
  status: string;
  version: number;
  scope_type: string;
  unit_id: string | null;
  unit_applicability: string | null;
  created_at: string;
  updated_at: string;
};

type ActionPlanRow = {
  id: string;
  organization_id: string;
  origin_indicator: string;
  issue_description: string;
  action_text: string;
  owner_name: string;
  due_date: string;
  priority: string;
  action_status: string;
  status: string;
  version: number;
  scope_type: string;
  unit_id: string | null;
  unit_applicability: string | null;
  created_at: string;
  updated_at: string;
};

type ApplicabilityRow = { campaign_id?: string; action_plan_id?: string; unit_id: string };

const CAMPAIGN_SELECT =
  'id, organization_id, title, description, channel, starts_at, ends_at, campaign_status, status, version, scope_type, unit_id, unit_applicability, created_at, updated_at';

const ACTION_PLAN_SELECT =
  'id, organization_id, origin_indicator, issue_description, action_text, owner_name, due_date, priority, action_status, status, version, scope_type, unit_id, unit_applicability, created_at, updated_at';

function sanitizeErrorMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.slice(0, 240);
}

function sanitizeErrorCode(code?: string, status?: number): string | undefined {
  if (code) return code.slice(0, 64);
  if (status != null) return String(status);
  return undefined;
}

function mapBackendError(error: SupabaseLikeError): { ok: false; error: CollectiveError } {
  const code = (error.code ?? '').toUpperCase();
  const cause = {
    source: 'repository' as const,
    code: sanitizeErrorCode(error.code, error.status),
    message: sanitizeErrorMessage(error.message),
  };
  if (code === '42501') return fail('CROSS_TENANT_DATA', { cause, transient: false });
  if (code === '23505') return fail('CONFLICT', { cause, transient: false });
  if (code === '23514' || code === '23503') {
    return fail('INVALID_INPUT', { cause, transient: false });
  }
  const msg = (cause.message ?? '').toLowerCase();
  if (msg.includes('row-level security') || msg.includes('permission denied')) {
    return fail('CROSS_TENANT_DATA', { cause, transient: false });
  }
  return fail('TECHNICAL_ERROR', { cause });
}

export function createSupabaseCollectiveRepository(input: {
  client: SupabaseCollectiveClient;
}): CollectiveRepository {
  return new SupabaseCollectiveRepository(input.client);
}

class SupabaseCollectiveRepository implements CollectiveRepository {
  constructor(private readonly client: SupabaseCollectiveClient) {}

  async listCampaigns(input: ListCampaignsInput): Promise<CollectiveResult<CampaignRecord[]>> {
    const session = await this.validateSession(input.context);
    if (!session.ok) return session;

    const query = this.client
      .from('campaigns')
      .select(CAMPAIGN_SELECT)
      .eq('organization_id', input.context.organizationId)
      .order('created_at', { ascending: false });

    const response = (await query) as SupabaseQueryResponse<CampaignRow[]>;
    if (response.error) return mapBackendError(response.error);
    let rows = response.data ?? [];
    if (input.campaignStatus) {
      rows = rows.filter((r) => r.campaign_status === input.campaignStatus);
    }
    if (input.search?.trim()) {
      const q = input.search.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    }
    return this.mapCampaignRows(input.context.organizationId, rows);
  }

  async getCampaign(
    context: CollectiveContext,
    campaignId: string
  ): Promise<CollectiveResult<CampaignRecord>> {
    const session = await this.validateSession(context);
    if (!session.ok) return session;

    const response = (await this.client
      .from('campaigns')
      .select(CAMPAIGN_SELECT)
      .eq('organization_id', context.organizationId)
      .eq('id', campaignId)
      .maybeSingle()) as SupabaseQueryResponse<CampaignRow>;

    if (response.error) return mapBackendError(response.error);
    if (!response.data) return fail('NOT_FOUND');
    const mapped = await this.mapCampaignRows(context.organizationId, [response.data]);
    if (!mapped.ok) return mapped;
    const first = mapped.data[0];
    if (!first) return fail('NOT_FOUND');
    return ok(first);
  }

  async createCampaign(
    context: CollectiveContext,
    input: CreateCampaignInput
  ): Promise<CollectiveResult<CampaignRecord>> {
    const session = await this.validateSession(context);
    if (!session.ok) return session;
    const validation = validateCreateCampaignWrite(context, input);
    if (!validation.ok) return validation;

    const cols = scopeToColumns(input.scope);
    const response = (await this.client
      .from('campaigns')
      .insert({
        organization_id: input.organizationId,
        title: input.title,
        description: input.description,
        channel: input.channel,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        campaign_status: 'Rascunho',
        status: 'ativo',
        version: 1,
        scope_type: cols.scope_type,
        unit_id: cols.unit_id,
        unit_applicability: cols.unit_applicability,
      })
      .select(CAMPAIGN_SELECT)
      .maybeSingle()) as SupabaseQueryResponse<CampaignRow>;

    if (response.error) return mapBackendError(response.error);
    if (!response.data) return fail('TECHNICAL_ERROR');
    const orgCheck = assertSameOrganization(context.organizationId, response.data.organization_id);
    if (!orgCheck.ok) return orgCheck;
    // Create single-table never persists selected_units (ATOMICITY_REQUIRED); no applicability fetch.
    return this.mapOneCampaign(response.data, []);
  }

  async updateCampaign(
    context: CollectiveContext,
    input: UpdateCampaignInput
  ): Promise<CollectiveResult<CampaignRecord>> {
    const session = await this.validateSession(context);
    if (!session.ok) return session;

    const existing = await this.getCampaign(context, input.campaignId);
    if (!existing.ok) return existing;
    const validation = validateUpdateCampaignWrite(context, input, existing.data.scope);
    if (!validation.ok) return validation;

    const patch: {
      updated_at: string;
      version: number;
      title?: string;
      description?: string;
      channel?: string;
      starts_at?: string;
      ends_at?: string;
      campaign_status?: string;
      scope_type?: string;
      unit_id?: string | null;
      unit_applicability?: string | null;
    } = {
      updated_at: new Date().toISOString(),
      version: existing.data.version + 1,
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.channel !== undefined) patch.channel = input.channel;
    if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
    if (input.endsAt !== undefined) patch.ends_at = input.endsAt;
    if (input.campaignStatus !== undefined) patch.campaign_status = input.campaignStatus;
    if (input.scope) {
      const cols = scopeToColumns(input.scope);
      patch.scope_type = cols.scope_type;
      patch.unit_id = cols.unit_id;
      patch.unit_applicability = cols.unit_applicability;
    }

    const response = (await this.client
      .from('campaigns')
      .update(patch)
      .eq('organization_id', context.organizationId)
      .eq('id', input.campaignId)
      .select(CAMPAIGN_SELECT)
      .maybeSingle()) as SupabaseQueryResponse<CampaignRow>;

    if (response.error) return mapBackendError(response.error);
    if (!response.data) return fail('NOT_FOUND');
    const orgCheck = assertSameOrganization(context.organizationId, response.data.organization_id);
    if (!orgCheck.ok) return orgCheck;
    // Preserve existing applicability relations when metadata-only update (no second get / no relational write).
    return this.mapOneCampaign(response.data, unitIdsFromExistingScope(existing.data.scope, input.scope));
  }

  async deleteCampaign(context: CollectiveContext, campaignId: string) {
    const session = await this.validateSession(context);
    if (!session.ok) return session;
    const existing = await this.getCampaign(context, campaignId);
    if (!existing.ok) return existing;

    const response = (await this.client
      .from('campaigns')
      .delete()
      .eq('organization_id', context.organizationId)
      .eq('id', campaignId)
      .select('id')
      .maybeSingle()) as SupabaseQueryResponse<{ id: string }>;

    if (response.error) return mapBackendError(response.error);
    if (!response.data || response.data.id !== campaignId) {
      // Zero rows: RLS may hide write denial; do not treat error==null as success.
      return fail('AUTHORIZATION_DENIED', { transient: false });
    }
    return ok({ id: response.data.id });
  }

  async listActionPlans(input: ListActionPlansInput) {
    const session = await this.validateSession(input.context);
    if (!session.ok) return session;

    const response = (await this.client
      .from('action_plans')
      .select(ACTION_PLAN_SELECT)
      .eq('organization_id', input.context.organizationId)
      .order('created_at', { ascending: false })) as SupabaseQueryResponse<ActionPlanRow[]>;

    if (response.error) return mapBackendError(response.error);
    let rows = response.data ?? [];
    if (input.actionStatus) {
      rows = rows.filter((r) => r.action_status === input.actionStatus);
    }
    return this.mapActionPlanRows(input.context.organizationId, rows);
  }

  async getActionPlan(
    context: CollectiveContext,
    actionPlanId: string
  ): Promise<CollectiveResult<ActionPlanRecord>> {
    const session = await this.validateSession(context);
    if (!session.ok) return session;

    const response = (await this.client
      .from('action_plans')
      .select(ACTION_PLAN_SELECT)
      .eq('organization_id', context.organizationId)
      .eq('id', actionPlanId)
      .maybeSingle()) as SupabaseQueryResponse<ActionPlanRow>;

    if (response.error) return mapBackendError(response.error);
    if (!response.data) return fail('NOT_FOUND');
    const mapped = await this.mapActionPlanRows(context.organizationId, [response.data]);
    if (!mapped.ok) return mapped;
    const first = mapped.data[0];
    if (!first) return fail('NOT_FOUND');
    return ok(first);
  }

  async createActionPlan(
    context: CollectiveContext,
    input: CreateActionPlanInput
  ): Promise<CollectiveResult<ActionPlanRecord>> {
    const session = await this.validateSession(context);
    if (!session.ok) return session;
    const validation = validateCreateActionPlanWrite(context, input);
    if (!validation.ok) return validation;

    const cols = scopeToColumns(input.scope);
    const response = (await this.client
      .from('action_plans')
      .insert({
        organization_id: input.organizationId,
        origin_indicator: input.originIndicator,
        issue_description: input.issueDescription,
        action_text: input.actionText,
        owner_name: input.ownerName,
        due_date: input.dueDate,
        priority: input.priority,
        action_status: input.actionStatus ?? 'Planejado',
        status: 'ativo',
        version: 1,
        scope_type: cols.scope_type,
        unit_id: cols.unit_id,
        unit_applicability: cols.unit_applicability,
      })
      .select(ACTION_PLAN_SELECT)
      .maybeSingle()) as SupabaseQueryResponse<ActionPlanRow>;

    if (response.error) return mapBackendError(response.error);
    if (!response.data) return fail('TECHNICAL_ERROR');
    const orgCheck = assertSameOrganization(context.organizationId, response.data.organization_id);
    if (!orgCheck.ok) return orgCheck;
    return this.mapOneActionPlan(response.data, []);
  }

  async updateActionPlan(
    context: CollectiveContext,
    input: UpdateActionPlanInput
  ): Promise<CollectiveResult<ActionPlanRecord>> {
    const session = await this.validateSession(context);
    if (!session.ok) return session;

    const existing = await this.getActionPlan(context, input.actionPlanId);
    if (!existing.ok) return existing;
    const validation = validateUpdateActionPlanWrite(context, input, existing.data.scope);
    if (!validation.ok) return validation;

    const patch: {
      updated_at: string;
      version: number;
      origin_indicator?: string;
      issue_description?: string;
      action_text?: string;
      owner_name?: string;
      due_date?: string;
      priority?: string;
      action_status?: string;
      scope_type?: string;
      unit_id?: string | null;
      unit_applicability?: string | null;
    } = {
      updated_at: new Date().toISOString(),
      version: existing.data.version + 1,
    };
    if (input.originIndicator !== undefined) patch.origin_indicator = input.originIndicator;
    if (input.issueDescription !== undefined) patch.issue_description = input.issueDescription;
    if (input.actionText !== undefined) patch.action_text = input.actionText;
    if (input.ownerName !== undefined) patch.owner_name = input.ownerName;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.actionStatus !== undefined) patch.action_status = input.actionStatus;
    if (input.scope) {
      const cols = scopeToColumns(input.scope);
      patch.scope_type = cols.scope_type;
      patch.unit_id = cols.unit_id;
      patch.unit_applicability = cols.unit_applicability;
    }

    const response = (await this.client
      .from('action_plans')
      .update(patch)
      .eq('organization_id', context.organizationId)
      .eq('id', input.actionPlanId)
      .select(ACTION_PLAN_SELECT)
      .maybeSingle()) as SupabaseQueryResponse<ActionPlanRow>;

    if (response.error) return mapBackendError(response.error);
    if (!response.data) return fail('NOT_FOUND');
    const orgCheck = assertSameOrganization(context.organizationId, response.data.organization_id);
    if (!orgCheck.ok) return orgCheck;
    return this.mapOneActionPlan(
      response.data,
      unitIdsFromExistingScope(existing.data.scope, input.scope)
    );
  }

  async deleteActionPlan(context: CollectiveContext, actionPlanId: string) {
    const session = await this.validateSession(context);
    if (!session.ok) return session;
    const existing = await this.getActionPlan(context, actionPlanId);
    if (!existing.ok) return existing;

    const response = (await this.client
      .from('action_plans')
      .delete()
      .eq('organization_id', context.organizationId)
      .eq('id', actionPlanId)
      .select('id')
      .maybeSingle()) as SupabaseQueryResponse<{ id: string }>;

    if (response.error) return mapBackendError(response.error);
    if (!response.data || response.data.id !== actionPlanId) {
      return fail('AUTHORIZATION_DENIED', { transient: false });
    }
    return ok({ id: response.data.id });
  }

  private async validateSession(context: CollectiveContext): Promise<CollectiveResult<true>> {
    const ctx = assertContext(context);
    if (!ctx.ok) return ctx;
    const authResponse = await this.client.auth.getUser();
    if (authResponse.error) return mapBackendError(authResponse.error);
    if (!authResponse.data.user?.id) return fail('NO_SESSION');
    if (authResponse.data.user.id !== context.userId) return fail('IDENTITY_MISMATCH');
    return ok(true);
  }

  private async mapCampaignRows(
    organizationId: string,
    rows: CampaignRow[]
  ): Promise<CollectiveResult<CampaignRecord[]>> {
    const selectedIds = rows
      .filter((r) => r.unit_applicability === 'selected_units')
      .map((r) => r.id);

    let unitMap = new Map<string, string[]>();
    if (selectedIds.length > 0) {
      const appResponse = (await this.client
        .from('campaign_unit_applicabilities')
        .select('campaign_id, unit_id')
        .in('campaign_id', selectedIds)) as SupabaseQueryResponse<ApplicabilityRow[]>;
      if (appResponse.error) return mapBackendError(appResponse.error);
      unitMap = new Map();
      for (const row of appResponse.data ?? []) {
        if (!row.campaign_id) continue;
        const list = unitMap.get(row.campaign_id) ?? [];
        list.push(row.unit_id);
        unitMap.set(row.campaign_id, list);
      }
    }

    const mapped: CampaignRecord[] = [];
    for (const row of rows) {
      if (row.organization_id !== organizationId) return fail('CROSS_TENANT_DATA');
      const one = this.mapOneCampaign(row, unitMap.get(row.id) ?? []);
      if (!one.ok) return one;
      mapped.push(one.data);
    }
    return ok(mapped);
  }

  private mapOneCampaign(row: CampaignRow, unitIds: string[]): CollectiveResult<CampaignRecord> {
    const scope = columnsToScope({
      scope_type: row.scope_type,
      unit_id: row.unit_id,
      unit_applicability: row.unit_applicability,
      unitIds,
    });
    if (!scope.ok) return scope;
    return ok({
      id: row.id,
      organizationId: row.organization_id,
      scope: scope.data,
      title: row.title,
      description: row.description,
      channel: row.channel,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      campaignStatus: row.campaign_status,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  private async mapActionPlanRows(
    organizationId: string,
    rows: ActionPlanRow[]
  ): Promise<CollectiveResult<ActionPlanRecord[]>> {
    const selectedIds = rows
      .filter((r) => r.unit_applicability === 'selected_units')
      .map((r) => r.id);

    let unitMap = new Map<string, string[]>();
    if (selectedIds.length > 0) {
      const appResponse = (await this.client
        .from('action_plan_unit_applicabilities')
        .select('action_plan_id, unit_id')
        .in('action_plan_id', selectedIds)) as SupabaseQueryResponse<ApplicabilityRow[]>;
      if (appResponse.error) return mapBackendError(appResponse.error);
      unitMap = new Map();
      for (const row of appResponse.data ?? []) {
        if (!row.action_plan_id) continue;
        const list = unitMap.get(row.action_plan_id) ?? [];
        list.push(row.unit_id);
        unitMap.set(row.action_plan_id, list);
      }
    }

    const mapped: ActionPlanRecord[] = [];
    for (const row of rows) {
      if (row.organization_id !== organizationId) return fail('CROSS_TENANT_DATA');
      const one = this.mapOneActionPlan(row, unitMap.get(row.id) ?? []);
      if (!one.ok) return one;
      mapped.push(one.data);
    }
    return ok(mapped);
  }

  private mapOneActionPlan(row: ActionPlanRow, unitIds: string[]): CollectiveResult<ActionPlanRecord> {
    const scope = columnsToScope({
      scope_type: row.scope_type,
      unit_id: row.unit_id,
      unit_applicability: row.unit_applicability,
      unitIds,
    });
    if (!scope.ok) return scope;
    return ok({
      id: row.id,
      organizationId: row.organization_id,
      scope: scope.data,
      originIndicator: row.origin_indicator,
      issueDescription: row.issue_description,
      actionText: row.action_text,
      ownerName: row.owner_name,
      dueDate: row.due_date,
      priority: row.priority,
      actionStatus: row.action_status,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
