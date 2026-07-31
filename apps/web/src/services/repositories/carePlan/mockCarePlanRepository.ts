import { fail, ok } from '@/services/repositories/carePlan/errors';
import type { CarePlanRepository } from '@/services/repositories/carePlan/contracts';
import {
  CARE_PLAN_SCHEMA_VERSION,
  isClosedCarePlanStatus,
  isOpenCarePlanStatus,
} from '@/services/repositories/carePlan/schema';
import type {
  CarePlan,
  CarePlanAction,
  CarePlanBundle,
  CarePlanContext,
  CarePlanEvent,
  CarePlanResult,
} from '@/services/repositories/carePlan/types';
import { assignedPatientsByProfessional } from '@/services/repositories/demoData';

type MockState = {
  plans: CarePlan[];
  actions: CarePlanAction[];
  events: CarePlanEvent[];
};

const STORAGE_KEY = 'biomed_care_plan_mock_v1';

function readStoredState(): MockState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { plans: [], actions: [], events: [] };
    const parsed = JSON.parse(raw) as Partial<MockState>;
    return {
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { plans: [], actions: [], events: [] };
  }
}

function writeStoredState(state: MockState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota/privacy errors in demo mode
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validateContext(context: CarePlanContext): CarePlanResult<true> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return ok(true);
}

function assertAccess(context: CarePlanContext): CarePlanResult<true> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  if (!Object.prototype.hasOwnProperty.call(assignedPatientsByProfessional, context.professionalUserId)) {
    return fail('CLINICAL_ACCESS_DENIED');
  }
  return ok(true);
}

function portfolio(context: CarePlanContext): Set<string> {
  return new Set(assignedPatientsByProfessional[context.professionalUserId] ?? []);
}

function pushEvent(
  state: MockState,
  event: Omit<CarePlanEvent, 'id' | 'createdAt'>
): CarePlanEvent {
  const row: CarePlanEvent = {
    ...event,
    id: createId('cpe'),
    createdAt: new Date().toISOString(),
  };
  state.events.push(row);
  return row;
}

function bundleFor(state: MockState, plan: CarePlan): CarePlanBundle {
  const actions = state.actions
    .filter((item) => item.carePlanId === plan.id)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
  const events = state.events
    .filter((item) => item.carePlanId === plan.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return { plan, actions, events };
}

export function createMockCarePlanRepository(input: { seed?: Partial<MockState> } = {}): CarePlanRepository {
  const stored = readStoredState();
  const state: MockState = {
    plans: input.seed?.plans ? [...input.seed.plans] : [...stored.plans],
    actions: input.seed?.actions ? [...input.seed.actions] : [...stored.actions],
    events: input.seed?.events ? [...input.seed.events] : [...stored.events],
  };
  const persist = () => writeStoredState(state);

  return {
    listCarePlans({ context, patientId }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      if (!portfolio(context).has(patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      const plans = state.plans
        .filter(
          (item) =>
            item.organizationId === context.organizationId &&
            item.professionalId === context.professionalUserId &&
            item.patientId === patientId &&
            item.status === 'ativo'
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return Promise.resolve(ok(plans));
    },

    getOpenCarePlan({ context, patientId }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      if (!portfolio(context).has(patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      const plan =
        state.plans.find(
          (item) =>
            item.organizationId === context.organizationId &&
            item.professionalId === context.professionalUserId &&
            item.patientId === patientId &&
            item.status === 'ativo' &&
            isOpenCarePlanStatus(item.planStatus)
        ) ?? null;
      return Promise.resolve(ok(plan ? bundleFor(state, plan) : null));
    },

    getCarePlanBundle({ context, planId }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      const plan = state.plans.find((item) => item.id === planId);
      if (!plan) return Promise.resolve(fail('NOT_FOUND'));
      if (
        plan.organizationId !== context.organizationId ||
        plan.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolio(context).has(plan.patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      return Promise.resolve(ok(bundleFor(state, plan)));
    },

    createCarePlan({ context, plan }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      if (!portfolio(context).has(plan.patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      if (!plan.title.trim() || !plan.generalObjective.trim()) {
        return Promise.resolve(fail('VALIDATION_REQUIRED_FIELDS'));
      }
      const open = state.plans.some(
        (item) =>
          item.organizationId === context.organizationId &&
          item.professionalId === context.professionalUserId &&
          item.patientId === plan.patientId &&
          item.status === 'ativo' &&
          isOpenCarePlanStatus(item.planStatus)
      );
      if (open) return Promise.resolve(fail('OPEN_PLAN_EXISTS'));

      const now = new Date().toISOString();
      const created: CarePlan = {
        id: createId('cp'),
        organizationId: context.organizationId,
        patientId: plan.patientId,
        professionalId: context.professionalUserId,
        title: plan.title.trim(),
        generalObjective: plan.generalObjective.trim(),
        planStatus: plan.planStatus ?? 'planejado',
        startsOn: plan.startsOn,
        targetDate: plan.targetDate ?? null,
        reassessmentDueOn: plan.reassessmentDueOn ?? null,
        lastReassessedAt: null,
        clinicalNotes: plan.clinicalNotes?.trim() ?? '',
        version: 1,
        schemaVersion: CARE_PLAN_SCHEMA_VERSION,
        clinicalRecordId: plan.clinicalRecordId ?? null,
        createdBy: context.professionalUserId,
        updatedBy: context.professionalUserId,
        closedAt: null,
        closedBy: null,
        suspensionReason: null,
        createdAt: now,
        updatedAt: now,
        status: 'ativo',
      };
      state.plans.push(created);
      pushEvent(state, {
        carePlanId: created.id,
        carePlanActionId: null,
        organizationId: created.organizationId,
        patientId: created.patientId,
        professionalId: created.professionalId,
        eventKind: 'create',
        eventCategory: 'structural',
        payload: { title: created.title, generalObjective: created.generalObjective },
        note: null,
        versionBefore: null,
        versionAfter: 1,
        authoredBy: context.professionalUserId,
      });
      persist();
      return Promise.resolve(ok(created));
    },

    updateCarePlan({ context, plan }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      const index = state.plans.findIndex((item) => item.id === plan.planId);
      if (index < 0) return Promise.resolve(fail('NOT_FOUND'));
      const current = state.plans[index];
      if (
        current.organizationId !== context.organizationId ||
        current.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolio(context).has(current.patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      if (isClosedCarePlanStatus(current.planStatus)) return Promise.resolve(fail('PLAN_CLOSED'));
      if (current.version !== plan.expectedVersion) return Promise.resolve(fail('VERSION_CONFLICT'));

      const nextStatus = plan.planStatus ?? current.planStatus;
      const title = plan.title?.trim() ?? current.title;
      const objective = plan.generalObjective?.trim() ?? current.generalObjective;
      if (nextStatus === 'em_andamento' && (!title || !objective)) {
        return Promise.resolve(fail('VALIDATION_REQUIRED_FIELDS'));
      }

      const updated: CarePlan = {
        ...current,
        title,
        generalObjective: objective,
        planStatus: nextStatus,
        startsOn: plan.startsOn ?? current.startsOn,
        targetDate: plan.targetDate !== undefined ? plan.targetDate : current.targetDate,
        reassessmentDueOn:
          plan.reassessmentDueOn !== undefined ? plan.reassessmentDueOn : current.reassessmentDueOn,
        clinicalNotes: plan.clinicalNotes !== undefined ? plan.clinicalNotes : current.clinicalNotes,
        version: current.version + 1,
        updatedBy: context.professionalUserId,
        updatedAt: new Date().toISOString(),
      };
      state.plans[index] = updated;
      pushEvent(state, {
        carePlanId: updated.id,
        carePlanActionId: null,
        organizationId: updated.organizationId,
        patientId: updated.patientId,
        professionalId: updated.professionalId,
        eventKind: 'plan_update',
        eventCategory: 'structural',
        payload: { title: updated.title, planStatus: updated.planStatus },
        note: null,
        versionBefore: current.version,
        versionAfter: updated.version,
        authoredBy: context.professionalUserId,
      });
      persist();
      return Promise.resolve(ok(updated));
    },

    createCarePlanAction({ context, action }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      const plan = state.plans.find((item) => item.id === action.planId);
      if (!plan) return Promise.resolve(fail('NOT_FOUND'));
      if (
        plan.organizationId !== context.organizationId ||
        plan.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolio(context).has(plan.patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      if (isClosedCarePlanStatus(plan.planStatus)) return Promise.resolve(fail('PLAN_CLOSED'));
      if (!action.specificObjective.trim() || !action.actionText.trim()) {
        return Promise.resolve(fail('VALIDATION_REQUIRED_FIELDS'));
      }

      const now = new Date().toISOString();
      const created: CarePlanAction = {
        id: createId('cpa'),
        carePlanId: plan.id,
        organizationId: plan.organizationId,
        patientId: plan.patientId,
        professionalId: plan.professionalId,
        specificObjective: action.specificObjective.trim(),
        actionText: action.actionText.trim(),
        frequency: action.frequency.trim(),
        dueDate: action.dueDate ?? null,
        actionStatus: 'pendente',
        displayOrder: action.displayOrder ?? state.actions.filter((item) => item.carePlanId === plan.id).length + 1,
        notes: action.notes?.trim() ?? '',
        version: 1,
        completedAt: null,
        createdBy: context.professionalUserId,
        updatedBy: context.professionalUserId,
        createdAt: now,
        updatedAt: now,
        status: 'ativo',
      };
      state.actions.push(created);
      pushEvent(state, {
        carePlanId: plan.id,
        carePlanActionId: created.id,
        organizationId: plan.organizationId,
        patientId: plan.patientId,
        professionalId: plan.professionalId,
        eventKind: 'action_create',
        eventCategory: 'structural',
        payload: { actionText: created.actionText },
        note: null,
        versionBefore: null,
        versionAfter: 1,
        authoredBy: context.professionalUserId,
      });
      persist();
      return Promise.resolve(ok(created));
    },

    updateCarePlanAction({ context, action }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      const index = state.actions.findIndex((item) => item.id === action.actionId);
      if (index < 0) return Promise.resolve(fail('NOT_FOUND'));
      const current = state.actions[index];
      const plan = state.plans.find((item) => item.id === current.carePlanId);
      if (!plan) return Promise.resolve(fail('NOT_FOUND'));
      if (
        plan.organizationId !== context.organizationId ||
        plan.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolio(context).has(plan.patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      if (isClosedCarePlanStatus(plan.planStatus)) return Promise.resolve(fail('PLAN_CLOSED'));
      if (current.version !== action.expectedVersion) return Promise.resolve(fail('VERSION_CONFLICT'));

      const nextStatus = action.actionStatus ?? current.actionStatus;
      const updated: CarePlanAction = {
        ...current,
        specificObjective: action.specificObjective?.trim() ?? current.specificObjective,
        actionText: action.actionText?.trim() ?? current.actionText,
        frequency: action.frequency?.trim() ?? current.frequency,
        dueDate: action.dueDate !== undefined ? action.dueDate : current.dueDate,
        displayOrder: action.displayOrder ?? current.displayOrder,
        notes: action.notes !== undefined ? action.notes : current.notes,
        actionStatus: nextStatus,
        completedAt: nextStatus === 'concluida' ? current.completedAt ?? new Date().toISOString() : null,
        version: current.version + 1,
        updatedBy: context.professionalUserId,
        updatedAt: new Date().toISOString(),
      };
      state.actions[index] = updated;
      pushEvent(state, {
        carePlanId: plan.id,
        carePlanActionId: updated.id,
        organizationId: plan.organizationId,
        patientId: plan.patientId,
        professionalId: plan.professionalId,
        eventKind: action.actionStatus && action.actionStatus !== current.actionStatus ? 'action_status' : 'action_update',
        eventCategory:
          action.actionStatus && action.actionStatus !== current.actionStatus ? 'status_change' : 'structural',
        payload: { actionStatus: updated.actionStatus },
        note: null,
        versionBefore: current.version,
        versionAfter: updated.version,
        authoredBy: context.professionalUserId,
      });
      persist();
      return Promise.resolve(ok(updated));
    },

    closeCarePlan({ context, close }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      const index = state.plans.findIndex((item) => item.id === close.planId);
      if (index < 0) return Promise.resolve(fail('NOT_FOUND'));
      const current = state.plans[index];
      if (
        current.organizationId !== context.organizationId ||
        current.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolio(context).has(current.patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      if (isClosedCarePlanStatus(current.planStatus)) return Promise.resolve(fail('PLAN_CLOSED'));
      if (current.version !== close.expectedVersion) return Promise.resolve(fail('VERSION_CONFLICT'));
      if (close.mode === 'suspend' && !close.suspensionReason?.trim()) {
        return Promise.resolve(fail('VALIDATION_REQUIRED_FIELDS', { details: 'suspensionReason' }));
      }

      const now = new Date().toISOString();
      const updated: CarePlan = {
        ...current,
        planStatus: close.mode === 'conclude' ? 'concluido' : 'suspenso',
        closedAt: now,
        closedBy: context.professionalUserId,
        suspensionReason: close.mode === 'suspend' ? close.suspensionReason!.trim() : null,
        version: current.version + 1,
        updatedBy: context.professionalUserId,
        updatedAt: now,
      };
      state.plans[index] = updated;
      pushEvent(state, {
        carePlanId: updated.id,
        carePlanActionId: null,
        organizationId: updated.organizationId,
        patientId: updated.patientId,
        professionalId: updated.professionalId,
        eventKind: close.mode === 'conclude' ? 'conclude' : 'suspend',
        eventCategory: 'status_change',
        payload: { planStatus: updated.planStatus },
        note: updated.suspensionReason,
        versionBefore: current.version,
        versionAfter: updated.version,
        authoredBy: context.professionalUserId,
      });
      persist();
      return Promise.resolve(ok(updated));
    },

    addCarePlanNote({ context, note }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      const index = state.plans.findIndex((item) => item.id === note.planId);
      if (index < 0) return Promise.resolve(fail('NOT_FOUND'));
      const current = state.plans[index];
      if (
        current.organizationId !== context.organizationId ||
        current.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolio(context).has(current.patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      if (isClosedCarePlanStatus(current.planStatus)) return Promise.resolve(fail('PLAN_CLOSED'));
      if (!note.note.trim()) return Promise.resolve(fail('VALIDATION_REQUIRED_FIELDS'));
      if (note.expectedPlanVersion !== undefined && note.expectedPlanVersion !== current.version) {
        return Promise.resolve(fail('VERSION_CONFLICT'));
      }

      if (note.kind === 'reassessment') {
        const updated: CarePlan = {
          ...current,
          lastReassessedAt: new Date().toISOString(),
          reassessmentDueOn:
            note.reassessmentDueOn !== undefined ? note.reassessmentDueOn : current.reassessmentDueOn,
          version: current.version + 1,
          updatedBy: context.professionalUserId,
          updatedAt: new Date().toISOString(),
        };
        state.plans[index] = updated;
      }

      const event = pushEvent(state, {
        carePlanId: current.id,
        carePlanActionId: null,
        organizationId: current.organizationId,
        patientId: current.patientId,
        professionalId: current.professionalId,
        eventKind: note.kind === 'evolution' ? 'evolution' : 'reassessment',
        eventCategory: note.kind === 'evolution' ? 'clinical_evolution' : 'reassessment',
        payload: { text: note.note.trim() },
        note: note.note.trim(),
        versionBefore: current.version,
        versionAfter: note.kind === 'reassessment' ? current.version + 1 : current.version,
        authoredBy: context.professionalUserId,
      });
      persist();
      return Promise.resolve(ok(event));
    },

    listCarePlanEvents({ context, planId }) {
      const access = assertAccess(context);
      if (!access.ok) return Promise.resolve(access);
      const plan = state.plans.find((item) => item.id === planId);
      if (!plan) return Promise.resolve(fail('NOT_FOUND'));
      if (
        plan.organizationId !== context.organizationId ||
        plan.professionalId !== context.professionalUserId
      ) {
        return Promise.resolve(fail('CROSS_TENANT_DATA'));
      }
      if (!portfolio(context).has(plan.patientId)) return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      const events = state.events
        .filter((item) => item.carePlanId === planId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return Promise.resolve(ok(events));
    },
  };
}
