import type {
  CollectiveAudienceInput,
  CreateCampaignInput,
  UpdateCampaignInput,
} from '@/domains/collective';
import type { CollectiveRepository } from '@/services/repositories/collective/contracts';
import { fail, ok, parseCollectiveMessageCode } from '@/services/repositories/collective/errors';
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
  scopeToRpcPayload,
  validateCreateActionPlanWrite,
  validateCreateCampaignWrite,
  validateUpdateActionPlanWrite,
  validateUpdateCampaignWrite,
} from '@/services/repositories/collective/validation';

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
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: SupabaseLikeError | null }>;
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
type AudienceRow = { campaign_id: string; audience_label: string };

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringOrNull(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') out.push(item);
  }
  return out;
}

function audienceToRpcPayload(
  audience: CollectiveAudienceInput
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    audience_label: audience.audienceLabel,
  };
  if (audience.criteria !== undefined) {
    payload['criteria'] = audience.criteria;
  }
  return payload;
}

function mapAudienceFromRpc(value: unknown): CollectiveAudienceInput | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isRecord(value)) return undefined;
  const label = asString(value['audience_label']);
  if (!label) return undefined;
  return { audienceLabel: label };
}

function mapBackendError(error: SupabaseLikeError): { ok: false; error: CollectiveError } {
  const code = (error.code ?? '').toUpperCase();
  const rawMessage = error.message ?? '';
  const cause = {
    source: 'repository' as const,
    code: sanitizeErrorCode(error.code, error.status),
    message: sanitizeErrorMessage(rawMessage),
  };

  if (code === '42501') return fail('CROSS_TENANT_DATA', { cause, transient: false });

  const collectiveCode = parseCollectiveMessageCode(rawMessage);
  if (collectiveCode) {
    if (collectiveCode === 'TECHNICAL_ERROR') {
      return fail('TECHNICAL_ERROR', { cause });
    }
    return fail(collectiveCode, { cause, transient: false });
  }

  if (code === 'P0001') {
    const fromP0001 = parseCollectiveMessageCode(rawMessage);
    if (fromP0001) {
      if (fromP0001 === 'TECHNICAL_ERROR') return fail('TECHNICAL_ERROR', { cause });
      return fail(fromP0001, { cause, transient: false });
    }
  }

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

function normalizeThrownError(error: unknown): SupabaseLikeError {
  if (isRecord(error)) {
    return {
      message: typeof error['message'] === 'string' ? error['message'] : 'Erro nao identificado.',
      code: typeof error['code'] === 'string' ? error['code'] : undefined,
      status: typeof error['status'] === 'number' ? error['status'] : undefined,
      details: typeof error['details'] === 'string' ? error['details'] : undefined,
      hint: typeof error['hint'] === 'string' ? error['hint'] : undefined,
    };
  }
  return { message: 'Erro desconhecido durante RPC coletiva.', code: 'UNKNOWN_ERROR' };
}

async function safeRpc(
  client: SupabaseCollectiveClient,
  fn: string,
  args?: Record<string, unknown>
): Promise<SupabaseQueryResponse<unknown>> {
  try {
    const response = await client.rpc(fn, args);
    return { data: response.data, error: response.error };
  } catch (error: unknown) {
    return { data: null, error: normalizeThrownError(error) };
  }
}

function mapCampaignRpcJson(data: unknown): CollectiveResult<CampaignRecord> {
  if (!isRecord(data)) return fail('TECHNICAL_ERROR');
  const id = asString(data['id']);
  const organizationId = asString(data['organization_id']);
  const title = asString(data['title']);
  const description = asString(data['description']);
  const channel = asString(data['channel']);
  const startsAt = asString(data['starts_at']);
  const endsAt = asString(data['ends_at']);
  const campaignStatus = asString(data['campaign_status']);
  const status = asString(data['status']);
  const version = asNumber(data['version']);
  const scopeType = asString(data['scope_type']);
  const createdAt = asString(data['created_at']);
  const updatedAt = asString(data['updated_at']);
  if (
    !id ||
    !organizationId ||
    !title ||
    !description ||
    !channel ||
    !startsAt ||
    !endsAt ||
    !campaignStatus ||
    !status ||
    version == null ||
    !scopeType ||
    !createdAt ||
    !updatedAt
  ) {
    return fail('TECHNICAL_ERROR');
  }

  const scope = columnsToScope({
    scope_type: scopeType,
    unit_id: asStringOrNull(data['unit_id']),
    unit_applicability: asStringOrNull(data['unit_applicability']),
    unitIds: asStringArray(data['unit_ids']),
  });
  if (!scope.ok) return scope;

  const audience = mapAudienceFromRpc(data['audience']);
  const record: CampaignRecord = {
    id,
    organizationId,
    scope: scope.data,
    title,
    description,
    channel,
    startsAt,
    endsAt,
    campaignStatus,
    status,
    version,
    createdAt,
    updatedAt,
  };
  if (audience) record.audience = audience;
  return ok(record);
}

function mapActionPlanRpcJson(data: unknown): CollectiveResult<ActionPlanRecord> {
  if (!isRecord(data)) return fail('TECHNICAL_ERROR');
  const id = asString(data['id']);
  const organizationId = asString(data['organization_id']);
  const originIndicator = asString(data['origin_indicator']);
  const issueDescription = asString(data['issue_description']);
  const actionText = asString(data['action_text']);
  const ownerName = asString(data['owner_name']);
  const dueDate = asString(data['due_date']);
  const priority = asString(data['priority']);
  const actionStatus = asString(data['action_status']);
  const status = asString(data['status']);
  const version = asNumber(data['version']);
  const scopeType = asString(data['scope_type']);
  const createdAt = asString(data['created_at']);
  const updatedAt = asString(data['updated_at']);
  if (
    !id ||
    !organizationId ||
    !originIndicator ||
    !issueDescription ||
    !actionText ||
    !ownerName ||
    !dueDate ||
    !priority ||
    !actionStatus ||
    !status ||
    version == null ||
    !scopeType ||
    !createdAt ||
    !updatedAt
  ) {
    return fail('TECHNICAL_ERROR');
  }

  const scope = columnsToScope({
    scope_type: scopeType,
    unit_id: asStringOrNull(data['unit_id']),
    unit_applicability: asStringOrNull(data['unit_applicability']),
    unitIds: asStringArray(data['unit_ids']),
  });
  if (!scope.ok) return scope;

  return ok({
    id,
    organizationId,
    scope: scope.data,
    originIndicator,
    issueDescription,
    actionText,
    ownerName,
    dueDate,
    priority,
    actionStatus,
    status,
    version,
    createdAt,
    updatedAt,
  });
}

function mapDeleteRpcJson(
  data: unknown,
  expectedId: string
): CollectiveResult<{ id: string }> {
  if (!isRecord(data)) return fail('AUTHORIZATION_DENIED', { transient: false });
  const id = asString(data['id']);
  if (!id || id !== expectedId) {
    return fail('AUTHORIZATION_DENIED', { transient: false });
  }
  return ok({ id });
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

    const payload: Record<string, unknown> = {
      organization_id: input.organizationId,
      title: input.title,
      description: input.description,
      channel: input.channel,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      ...scopeToRpcPayload(input.scope),
    };
    if (input.audience !== undefined) {
      payload['audience'] = audienceToRpcPayload(input.audience);
    }

    const response = await safeRpc(this.client, 'collective_create_campaign_atomic', {
      p_payload: payload,
    });
    if (response.error) return mapBackendError(response.error);
    const mapped = mapCampaignRpcJson(response.data);
    if (!mapped.ok) return mapped;
    const orgCheck = assertSameOrganization(context.organizationId, mapped.data.organizationId);
    if (!orgCheck.ok) return orgCheck;
    return mapped;
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

    const current = existing.data;
    const payload: Record<string, unknown> = {
      organization_id: input.organizationId,
      campaign_id: input.campaignId,
      expected_version: current.version,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      channel: input.channel ?? current.channel,
      starts_at: input.startsAt ?? current.startsAt,
      ends_at: input.endsAt ?? current.endsAt,
      campaign_status: input.campaignStatus ?? current.campaignStatus,
    };

    if (input.scope !== undefined) {
      Object.assign(payload, scopeToRpcPayload(input.scope));
    }

    if (Object.prototype.hasOwnProperty.call(input, 'audience')) {
      if (input.audience === null) {
        payload['audience'] = null;
      } else if (input.audience !== undefined) {
        payload['audience'] = audienceToRpcPayload(input.audience);
      }
    }

    const response = await safeRpc(this.client, 'collective_update_campaign_atomic', {
      p_payload: payload,
    });
    if (response.error) return mapBackendError(response.error);
    const mapped = mapCampaignRpcJson(response.data);
    if (!mapped.ok) return mapped;
    const orgCheck = assertSameOrganization(context.organizationId, mapped.data.organizationId);
    if (!orgCheck.ok) return orgCheck;
    return mapped;
  }

  async deleteCampaign(context: CollectiveContext, campaignId: string) {
    const session = await this.validateSession(context);
    if (!session.ok) return session;

    const response = await safeRpc(this.client, 'collective_delete_campaign_atomic', {
      p_organization_id: context.organizationId,
      p_campaign_id: campaignId,
    });
    if (response.error) return mapBackendError(response.error);
    return mapDeleteRpcJson(response.data, campaignId);
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

    const payload: Record<string, unknown> = {
      organization_id: input.organizationId,
      origin_indicator: input.originIndicator,
      issue_description: input.issueDescription,
      action_text: input.actionText,
      owner_name: input.ownerName,
      due_date: input.dueDate,
      priority: input.priority,
      action_status: input.actionStatus ?? 'Planejado',
      ...scopeToRpcPayload(input.scope),
    };

    const response = await safeRpc(this.client, 'collective_create_action_plan_atomic', {
      p_payload: payload,
    });
    if (response.error) return mapBackendError(response.error);
    const mapped = mapActionPlanRpcJson(response.data);
    if (!mapped.ok) return mapped;
    const orgCheck = assertSameOrganization(context.organizationId, mapped.data.organizationId);
    if (!orgCheck.ok) return orgCheck;
    return mapped;
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

    const current = existing.data;
    const payload: Record<string, unknown> = {
      organization_id: input.organizationId,
      action_plan_id: input.actionPlanId,
      expected_version: current.version,
      origin_indicator: input.originIndicator ?? current.originIndicator,
      issue_description: input.issueDescription ?? current.issueDescription,
      action_text: input.actionText ?? current.actionText,
      owner_name: input.ownerName ?? current.ownerName,
      due_date: input.dueDate ?? current.dueDate,
      priority: input.priority ?? current.priority,
      action_status: input.actionStatus ?? current.actionStatus,
    };

    if (input.scope !== undefined) {
      Object.assign(payload, scopeToRpcPayload(input.scope));
    }

    const response = await safeRpc(this.client, 'collective_update_action_plan_atomic', {
      p_payload: payload,
    });
    if (response.error) return mapBackendError(response.error);
    const mapped = mapActionPlanRpcJson(response.data);
    if (!mapped.ok) return mapped;
    const orgCheck = assertSameOrganization(context.organizationId, mapped.data.organizationId);
    if (!orgCheck.ok) return orgCheck;
    return mapped;
  }

  async deleteActionPlan(context: CollectiveContext, actionPlanId: string) {
    const session = await this.validateSession(context);
    if (!session.ok) return session;

    const response = await safeRpc(this.client, 'collective_delete_action_plan_atomic', {
      p_organization_id: context.organizationId,
      p_action_plan_id: actionPlanId,
    });
    if (response.error) return mapBackendError(response.error);
    return mapDeleteRpcJson(response.data, actionPlanId);
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
    const ids = rows.map((r) => r.id);
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

    let audienceMap = new Map<string, string>();
    if (ids.length > 0) {
      const audienceResponse = (await this.client
        .from('campaign_audiences')
        .select('campaign_id, audience_label')
        .in('campaign_id', ids)) as SupabaseQueryResponse<AudienceRow[]>;
      if (audienceResponse.error) return mapBackendError(audienceResponse.error);
      audienceMap = new Map();
      for (const row of audienceResponse.data ?? []) {
        audienceMap.set(row.campaign_id, row.audience_label);
      }
    }

    const mapped: CampaignRecord[] = [];
    for (const row of rows) {
      if (row.organization_id !== organizationId) return fail('CROSS_TENANT_DATA');
      const one = this.mapOneCampaign(row, unitMap.get(row.id) ?? [], audienceMap.get(row.id));
      if (!one.ok) return one;
      mapped.push(one.data);
    }
    return ok(mapped);
  }

  private mapOneCampaign(
    row: CampaignRow,
    unitIds: string[],
    audienceLabel?: string
  ): CollectiveResult<CampaignRecord> {
    const scope = columnsToScope({
      scope_type: row.scope_type,
      unit_id: row.unit_id,
      unit_applicability: row.unit_applicability,
      unitIds,
    });
    if (!scope.ok) return scope;
    const record: CampaignRecord = {
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
    };
    if (audienceLabel) {
      record.audience = { audienceLabel };
    }
    return ok(record);
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
