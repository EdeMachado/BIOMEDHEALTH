import { fail, ok } from '@/services/repositories/carePlan/errors';
import type { CarePlanRepository } from '@/services/repositories/carePlan/contracts';
import {
  CARE_PLAN_SCHEMA_VERSION,
  isClosedCarePlanStatus,
  type CarePlanActionStatus,
  type CarePlanEventCategory,
  type CarePlanEventKind,
  type CarePlanStatus,
} from '@/services/repositories/carePlan/schema';
import type {
  CarePlan,
  CarePlanAction,
  CarePlanBundle,
  CarePlanEvent,
  CarePlanResult,
} from '@/services/repositories/carePlan/types';
import {
  classifyPostgresInsufficientPrivilege,
  isPostgresInsufficientPrivilege,
} from '@/services/repositories/clinical/postgresInsufficientPrivilege';

type SupabaseLikeError = { message?: string; code?: string };
type SupabaseAuthResponse = { data: { user: { id?: string } | null }; error: SupabaseLikeError | null };
type SupabaseQueryResponse<T> = { data: T | null; error: SupabaseLikeError | null };

interface SupabaseSelectBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  eq(column: string, value: unknown): SupabaseSelectBuilder;
  in(column: string, values: unknown[]): SupabaseSelectBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseSelectBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

interface SupabaseMutationBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  select(columns: string): SupabaseSelectBuilder;
  eq(column: string, value: unknown): SupabaseMutationBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

export interface SupabaseCarePlanClient {
  auth: { getUser(): Promise<SupabaseAuthResponse> };
  rpc(fn: string, args?: Record<string, unknown>): Promise<SupabaseQueryResponse<unknown>>;
  from(table: string): {
    select(columns: string): SupabaseSelectBuilder;
    insert(values: Record<string, unknown>): SupabaseMutationBuilder;
    update(values: Record<string, unknown>): SupabaseMutationBuilder;
  };
}

const PLAN_SELECT =
  'id, organization_id, user_id, professional_id, title, status, version, plan_status, general_objective, starts_on, target_date, reassessment_due_on, last_reassessed_at, clinical_notes, schema_version, clinical_record_id, created_by, updated_by, closed_at, closed_by, suspension_reason, created_at, updated_at';

const ACTION_SELECT =
  'id, care_plan_id, organization_id, user_id, professional_id, action_text, due_date, status, version, specific_objective, frequency, action_status, display_order, notes, created_by, updated_by, completed_at, created_at, updated_at';

const EVENT_SELECT =
  'id, care_plan_id, care_plan_action_id, organization_id, user_id, professional_id, event_kind, event_category, payload, note, version_before, version_after, authored_by, created_at';

function normalizeThrownError(error: unknown): SupabaseLikeError {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record['message'] === 'string' ? record['message'] : 'unknown',
      code: typeof record['code'] === 'string' ? record['code'] : undefined,
    };
  }
  return { message: 'unknown' };
}

function mapBackendError(error: SupabaseLikeError): CarePlanResult<never> {
  const code = (error.code ?? '').toUpperCase();
  const message = (error.message ?? '').toLowerCase();
  const cause = { source: 'repository' as const, code: error.code, message: error.message };
  if (isPostgresInsufficientPrivilege(error.code)) {
    const classification = classifyPostgresInsufficientPrivilege();
    return fail(classification.code, {
      kind: classification.kind,
      transient: classification.transient,
      cause,
    });
  }
  if (code === '23505' || message.includes('one_open')) return fail('OPEN_PLAN_EXISTS', { cause });
  if (message.includes('imutavel') || message.includes('encerrado')) {
    return fail('PLAN_CLOSED', { cause });
  }
  if (
    code === '40001' ||
    (code === '23514' && message.includes('version')) ||
    message.includes('conflito de versao')
  ) {
    return fail('VERSION_CONFLICT', { cause });
  }
  if (code === 'P0002' || message.includes('nao encontrado')) return fail('NOT_FOUND', { cause });
  if (code === '23514') return fail('INVALID_INPUT', { cause });
  return fail('TECHNICAL_ERROR', { cause });
}

function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return fallback;
  return fallback;
}

function asNullableText(value: unknown): string | null {
  if (value == null) return null;
  const text = asText(value, '');
  return text === '' && value !== '' ? null : text;
}

function asPlanStatus(value: string): CarePlanStatus | null {
  if (['planejado', 'em_andamento', 'concluido', 'suspenso'].includes(value)) return value as CarePlanStatus;
  return null;
}

function asActionStatus(value: string): CarePlanActionStatus | null {
  if (['pendente', 'em_andamento', 'concluida', 'suspensa', 'cancelada'].includes(value)) {
    return value as CarePlanActionStatus;
  }
  return null;
}

function mapPlan(row: Record<string, unknown>): CarePlan | null {
  const planStatus = asPlanStatus(asText(row['plan_status']));
  const status = row['status'] === 'ativo' || row['status'] === 'inativo' ? row['status'] : null;
  if (!planStatus || !status) return null;
  return {
    id: asText(row['id']),
    organizationId: asText(row['organization_id']),
    patientId: asText(row['user_id']),
    professionalId: asText(row['professional_id']),
    title: asText(row['title']),
    generalObjective: asText(row['general_objective']),
    planStatus,
    startsOn: asText(row['starts_on']),
    targetDate: asNullableText(row['target_date']),
    reassessmentDueOn: asNullableText(row['reassessment_due_on']),
    lastReassessedAt: asNullableText(row['last_reassessed_at']),
    clinicalNotes: asText(row['clinical_notes']),
    version: Number(row['version'] ?? 1),
    schemaVersion: asText(row['schema_version'], CARE_PLAN_SCHEMA_VERSION),
    clinicalRecordId: asNullableText(row['clinical_record_id']),
    createdBy: asText(row['created_by']),
    updatedBy: asText(row['updated_by']),
    closedAt: asNullableText(row['closed_at']),
    closedBy: asNullableText(row['closed_by']),
    suspensionReason: asNullableText(row['suspension_reason']),
    createdAt: asText(row['created_at']),
    updatedAt: asText(row['updated_at']),
    status,
  };
}

function mapAction(row: Record<string, unknown>): CarePlanAction | null {
  const actionStatus = asActionStatus(asText(row['action_status']));
  const status = row['status'] === 'ativo' || row['status'] === 'inativo' ? row['status'] : null;
  if (!actionStatus || !status) return null;
  return {
    id: asText(row['id']),
    carePlanId: asText(row['care_plan_id']),
    organizationId: asText(row['organization_id']),
    patientId: asText(row['user_id']),
    professionalId: asText(row['professional_id']),
    specificObjective: asText(row['specific_objective']),
    actionText: asText(row['action_text']),
    frequency: asText(row['frequency']),
    dueDate: asNullableText(row['due_date']),
    actionStatus,
    displayOrder: Number(row['display_order'] ?? 1),
    notes: asText(row['notes']),
    version: Number(row['version'] ?? 1),
    completedAt: asNullableText(row['completed_at']),
    createdBy: asText(row['created_by']),
    updatedBy: asText(row['updated_by']),
    createdAt: asText(row['created_at']),
    updatedAt: asText(row['updated_at']),
    status,
  };
}

function mapEvent(row: Record<string, unknown>): CarePlanEvent | null {
  const eventKind = asText(row['event_kind']) as CarePlanEventKind;
  const eventCategory = asText(row['event_category']) as CarePlanEventCategory;
  return {
    id: asText(row['id']),
    carePlanId: asText(row['care_plan_id']),
    carePlanActionId: asNullableText(row['care_plan_action_id']),
    organizationId: asText(row['organization_id']),
    patientId: asText(row['user_id']),
    professionalId: asText(row['professional_id']),
    eventKind,
    eventCategory,
    payload:
      row['payload'] && typeof row['payload'] === 'object'
        ? (row['payload'] as Record<string, unknown>)
        : {},
    note: asNullableText(row['note']),
    versionBefore: row['version_before'] == null ? null : Number(row['version_before']),
    versionAfter: row['version_after'] == null ? null : Number(row['version_after']),
    authoredBy: asText(row['authored_by']),
    createdAt: asText(row['created_at']),
  };
}

export function createSupabaseCarePlanRepository(input: {
  client: SupabaseCarePlanClient;
}): CarePlanRepository {
  const client = input.client;

  async function assertSession(context: {
    sessionUserId: string;
    professionalUserId: string;
    organizationId: string;
  }): Promise<CarePlanResult<true>> {
    if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
    if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
    if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');

    let authResponse: SupabaseAuthResponse;
    try {
      authResponse = await client.auth.getUser();
    } catch (error: unknown) {
      authResponse = { data: { user: null }, error: normalizeThrownError(error) };
    }
    if (authResponse.error) return mapBackendError(authResponse.error);
    if (!authResponse.data.user?.id) return fail('NO_SESSION');
    if (authResponse.data.user.id !== context.professionalUserId) return fail('IDENTITY_MISMATCH');

    let canManage: SupabaseQueryResponse<unknown>;
    try {
      canManage = await client.rpc('can_manage_clinical_care_plan', {
        p_organization_id: context.organizationId,
      });
    } catch (error: unknown) {
      return mapBackendError(normalizeThrownError(error));
    }
    if (canManage.error) return mapBackendError(canManage.error);
    if (canManage.data !== true) return fail('CLINICAL_ACCESS_DENIED');
    return ok(true);
  }

  async function assertPatientLinked(
    context: { organizationId: string },
    patientId: string
  ): Promise<CarePlanResult<true>> {
    let linked: SupabaseQueryResponse<unknown>;
    try {
      linked = await client.rpc('can_access_linked_patient_journey', {
        p_organization_id: context.organizationId,
        p_patient_user_id: patientId,
      });
    } catch (error: unknown) {
      return mapBackendError(normalizeThrownError(error));
    }
    if (linked.error) return mapBackendError(linked.error);
    if (linked.data !== true) return fail('PATIENT_NOT_IN_PORTFOLIO');
    return ok(true);
  }

  async function loadActions(planId: string, context: { organizationId: string; professionalUserId: string }) {
    const response = await client
      .from('care_plan_actions')
      .select(ACTION_SELECT)
      .eq('care_plan_id', planId)
      .eq('organization_id', context.organizationId)
      .eq('professional_id', context.professionalUserId)
      .order('display_order', { ascending: true });
    if (response.error) return mapBackendError(response.error);
    const rows = Array.isArray(response.data) ? response.data : [];
    return ok(
      rows
        .map((row) => mapAction(row as Record<string, unknown>))
        .filter((item): item is CarePlanAction => item !== null)
    );
  }

  async function loadEvents(planId: string, context: { organizationId: string; professionalUserId: string }) {
    const response = await client
      .from('care_plan_events')
      .select(EVENT_SELECT)
      .eq('care_plan_id', planId)
      .eq('organization_id', context.organizationId)
      .eq('professional_id', context.professionalUserId)
      .order('created_at', { ascending: false });
    if (response.error) return mapBackendError(response.error);
    const rows = Array.isArray(response.data) ? response.data : [];
    return ok(
      rows
        .map((row) => mapEvent(row as Record<string, unknown>))
        .filter((item): item is CarePlanEvent => item !== null)
    );
  }

  async function bundle(plan: CarePlan, context: { organizationId: string; professionalUserId: string }) {
    const actions = await loadActions(plan.id, context);
    if (!actions.ok) return actions;
    const events = await loadEvents(plan.id, context);
    if (!events.ok) return events;
    return ok<CarePlanBundle>({ plan, actions: actions.data, events: events.data });
  }

  const repository: CarePlanRepository = {
    async listCarePlans({ context, patientId }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      const linked = await assertPatientLinked(context, patientId);
      if (!linked.ok) return linked;
      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plans')
          .select(PLAN_SELECT)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .eq('user_id', patientId)
          .eq('status', 'ativo')
          .order('updated_at', { ascending: false });
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      const rows = Array.isArray(response.data) ? response.data : [];
      return ok(
        rows
          .map((row) => mapPlan(row as Record<string, unknown>))
          .filter((item): item is CarePlan => item !== null)
      );
    },

    async getOpenCarePlan({ context, patientId }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      const linked = await assertPatientLinked(context, patientId);
      if (!linked.ok) return linked;
      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plans')
          .select(PLAN_SELECT)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .eq('user_id', patientId)
          .eq('status', 'ativo')
          .in('plan_status', ['planejado', 'em_andamento'])
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return ok(null);
      const plan = mapPlan(response.data as Record<string, unknown>);
      if (!plan) return fail('TECHNICAL_ERROR');
      return bundle(plan, context);
    },

    async getCarePlanBundle({ context, planId }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plans')
          .select(PLAN_SELECT)
          .eq('id', planId)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return fail('NOT_FOUND');
      const plan = mapPlan(response.data as Record<string, unknown>);
      if (!plan) return fail('TECHNICAL_ERROR');
      const linked = await assertPatientLinked(context, plan.patientId);
      if (!linked.ok) return linked;
      return bundle(plan, context);
    },

    async createCarePlan({ context, plan }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      const linked = await assertPatientLinked(context, plan.patientId);
      if (!linked.ok) return linked;
      if (!plan.title.trim() || !plan.generalObjective.trim()) return fail('VALIDATION_REQUIRED_FIELDS');

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plans')
          .insert({
            organization_id: context.organizationId,
            user_id: plan.patientId,
            professional_id: context.professionalUserId,
            title: plan.title.trim(),
            status: 'ativo',
            version: 1,
            plan_status: plan.planStatus ?? 'planejado',
            general_objective: plan.generalObjective.trim(),
            starts_on: plan.startsOn,
            target_date: plan.targetDate ?? null,
            reassessment_due_on: plan.reassessmentDueOn ?? null,
            clinical_notes: plan.clinicalNotes?.trim() ?? '',
            created_by: context.professionalUserId,
            updated_by: context.professionalUserId,
            schema_version: CARE_PLAN_SCHEMA_VERSION,
            clinical_record_id: plan.clinicalRecordId ?? null,
          })
          .select(PLAN_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data || Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapPlan(response.data as Record<string, unknown>);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async updateCarePlan({ context, plan }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      const currentBundle = await repository.getCarePlanBundle({ context, planId: plan.planId });
      if (!currentBundle.ok) return currentBundle;
      const current = currentBundle.data.plan;
      if (isClosedCarePlanStatus(current.planStatus)) return fail('PLAN_CLOSED');
      if (current.version !== plan.expectedVersion) return fail('VERSION_CONFLICT');

      const patch: Record<string, unknown> = {
        version: current.version + 1,
        updated_by: context.professionalUserId,
        updated_at: new Date().toISOString(),
      };
      if (plan.title !== undefined) patch['title'] = plan.title.trim();
      if (plan.generalObjective !== undefined) patch['general_objective'] = plan.generalObjective.trim();
      if (plan.startsOn !== undefined) patch['starts_on'] = plan.startsOn;
      if (plan.targetDate !== undefined) patch['target_date'] = plan.targetDate;
      if (plan.reassessmentDueOn !== undefined) patch['reassessment_due_on'] = plan.reassessmentDueOn;
      if (plan.clinicalNotes !== undefined) patch['clinical_notes'] = plan.clinicalNotes;
      if (plan.planStatus !== undefined) patch['plan_status'] = plan.planStatus;

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plans')
          .update(patch)
          .eq('id', plan.planId)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .eq('version', plan.expectedVersion)
          .select(PLAN_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return fail('VERSION_CONFLICT');
      const mapped = mapPlan(response.data as Record<string, unknown>);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async createCarePlanAction({ context, action }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      const currentBundle = await repository.getCarePlanBundle({ context, planId: action.planId });
      if (!currentBundle.ok) return currentBundle;
      const plan = currentBundle.data.plan;
      if (isClosedCarePlanStatus(plan.planStatus)) return fail('PLAN_CLOSED');
      if (!action.specificObjective.trim() || !action.actionText.trim()) {
        return fail('VALIDATION_REQUIRED_FIELDS');
      }

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plan_actions')
          .insert({
            organization_id: plan.organizationId,
            care_plan_id: plan.id,
            user_id: plan.patientId,
            professional_id: plan.professionalId,
            action_text: action.actionText.trim(),
            due_date: action.dueDate ?? null,
            status: 'ativo',
            version: 1,
            specific_objective: action.specificObjective.trim(),
            frequency: action.frequency.trim(),
            action_status: 'pendente',
            display_order: action.displayOrder ?? currentBundle.data.actions.length + 1,
            notes: action.notes?.trim() ?? '',
            created_by: context.professionalUserId,
            updated_by: context.professionalUserId,
          })
          .select(ACTION_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data || Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapAction(response.data as Record<string, unknown>);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async updateCarePlanAction({ context, action }) {
      const access = await assertSession(context);
      if (!access.ok) return access;

      let currentResponse: SupabaseQueryResponse<unknown>;
      try {
        currentResponse = await client
          .from('care_plan_actions')
          .select(ACTION_SELECT)
          .eq('id', action.actionId)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (currentResponse.error) return mapBackendError(currentResponse.error);
      if (!currentResponse.data) return fail('NOT_FOUND');
      const current = mapAction(currentResponse.data as Record<string, unknown>);
      if (!current) return fail('TECHNICAL_ERROR');
      if (current.version !== action.expectedVersion) return fail('VERSION_CONFLICT');

      const planBundle = await repository.getCarePlanBundle({ context, planId: current.carePlanId });
      if (!planBundle.ok) return planBundle;
      if (isClosedCarePlanStatus(planBundle.data.plan.planStatus)) return fail('PLAN_CLOSED');

      const nextStatus = action.actionStatus ?? current.actionStatus;
      const patch: Record<string, unknown> = {
        version: current.version + 1,
        updated_by: context.professionalUserId,
        updated_at: new Date().toISOString(),
        action_status: nextStatus,
        completed_at: nextStatus === 'concluida' ? current.completedAt ?? new Date().toISOString() : null,
      };
      if (action.specificObjective !== undefined) patch['specific_objective'] = action.specificObjective.trim();
      if (action.actionText !== undefined) patch['action_text'] = action.actionText.trim();
      if (action.frequency !== undefined) patch['frequency'] = action.frequency.trim();
      if (action.dueDate !== undefined) patch['due_date'] = action.dueDate;
      if (action.displayOrder !== undefined) patch['display_order'] = action.displayOrder;
      if (action.notes !== undefined) patch['notes'] = action.notes;

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plan_actions')
          .update(patch)
          .eq('id', action.actionId)
          .eq('version', action.expectedVersion)
          .select(ACTION_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return fail('VERSION_CONFLICT');
      const mapped = mapAction(response.data as Record<string, unknown>);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async closeCarePlan({ context, close }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      const currentBundle = await repository.getCarePlanBundle({ context, planId: close.planId });
      if (!currentBundle.ok) return currentBundle;
      const current = currentBundle.data.plan;
      if (isClosedCarePlanStatus(current.planStatus)) return fail('PLAN_CLOSED');
      if (current.version !== close.expectedVersion) return fail('VERSION_CONFLICT');
      if (close.mode === 'suspend' && !close.suspensionReason?.trim()) {
        return fail('VALIDATION_REQUIRED_FIELDS', { details: 'suspensionReason' });
      }

      const now = new Date().toISOString();
      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plans')
          .update({
            plan_status: close.mode === 'conclude' ? 'concluido' : 'suspenso',
            closed_at: now,
            closed_by: context.professionalUserId,
            suspension_reason: close.mode === 'suspend' ? close.suspensionReason!.trim() : null,
            version: current.version + 1,
            updated_by: context.professionalUserId,
            updated_at: now,
          })
          .eq('id', close.planId)
          .eq('version', close.expectedVersion)
          .select(PLAN_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return fail('VERSION_CONFLICT');
      const mapped = mapPlan(response.data as Record<string, unknown>);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async addCarePlanNote({ context, note }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      const currentBundle = await repository.getCarePlanBundle({ context, planId: note.planId });
      if (!currentBundle.ok) return currentBundle;
      const plan = currentBundle.data.plan;
      if (isClosedCarePlanStatus(plan.planStatus)) return fail('PLAN_CLOSED');
      if (!note.note.trim()) return fail('VALIDATION_REQUIRED_FIELDS');
      if (note.expectedPlanVersion !== undefined && note.expectedPlanVersion !== plan.version) {
        return fail('VERSION_CONFLICT');
      }

      if (note.kind === 'reassessment') {
        let response: SupabaseQueryResponse<unknown>;
        try {
          response = await client.rpc('reassess_clinical_care_plan', {
            p_plan_id: plan.id,
            p_expected_version: note.expectedPlanVersion ?? plan.version,
            p_note: note.note.trim(),
            p_reassessment_due_on:
              note.reassessmentDueOn !== undefined ? note.reassessmentDueOn : null,
          });
        } catch (error: unknown) {
          return mapBackendError(normalizeThrownError(error));
        }
        if (response.error) return mapBackendError(response.error);
        const payload =
          response.data && typeof response.data === 'object'
            ? (response.data as Record<string, unknown>)
            : null;
        const eventRow =
          payload?.['event'] && typeof payload['event'] === 'object'
            ? (payload['event'] as Record<string, unknown>)
            : null;
        if (!eventRow) return fail('TECHNICAL_ERROR');
        const mapped = mapEvent(eventRow);
        if (!mapped) return fail('TECHNICAL_ERROR');
        return ok(mapped);
      }

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('care_plan_events')
          .insert({
            care_plan_id: plan.id,
            organization_id: plan.organizationId,
            user_id: plan.patientId,
            professional_id: plan.professionalId,
            event_kind: 'evolution',
            event_category: 'clinical_evolution',
            payload: { text: note.note.trim() },
            note: note.note.trim(),
            authored_by: context.professionalUserId,
          })
          .select(EVENT_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data || Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapEvent(response.data as Record<string, unknown>);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async listCarePlanEvents({ context, planId }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      return loadEvents(planId, context);
    },
  };
  return repository;
}
