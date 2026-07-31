import type {
  CarePlanActionStatus,
  CarePlanEventCategory,
  CarePlanEventKind,
  CarePlanStatus,
} from '@/services/repositories/carePlan/schema';

export type CarePlanErrorKind =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'technical'
  | 'consistency';

export type CarePlanErrorCode =
  | 'NO_SESSION'
  | 'IDENTITY_MISMATCH'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'CLINICAL_ACCESS_DENIED'
  | 'PATIENT_NOT_IN_PORTFOLIO'
  | 'CROSS_TENANT_DATA'
  | 'INVALID_INPUT'
  | 'VALIDATION_REQUIRED_FIELDS'
  | 'PLAN_CLOSED'
  | 'OPEN_PLAN_EXISTS'
  | 'VERSION_CONFLICT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TECHNICAL_ERROR';

export type CarePlanError = {
  code: CarePlanErrorCode;
  kind: CarePlanErrorKind;
  transient: boolean;
  message: string;
  details?: string;
  cause?: { source: 'repository'; code?: string; message?: string };
};

export type CarePlanResult<T> = { ok: true; data: T } | { ok: false; error: CarePlanError };

export type CarePlanContext = {
  sessionUserId: string;
  professionalUserId: string;
  organizationId: string;
};

export type CarePlan = {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  title: string;
  generalObjective: string;
  planStatus: CarePlanStatus;
  startsOn: string;
  targetDate: string | null;
  reassessmentDueOn: string | null;
  lastReassessedAt: string | null;
  clinicalNotes: string;
  version: number;
  schemaVersion: string;
  clinicalRecordId: string | null;
  createdBy: string;
  updatedBy: string;
  closedAt: string | null;
  closedBy: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
  status: 'ativo' | 'inativo';
};

export type CarePlanAction = {
  id: string;
  carePlanId: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  specificObjective: string;
  actionText: string;
  frequency: string;
  dueDate: string | null;
  actionStatus: CarePlanActionStatus;
  displayOrder: number;
  notes: string;
  version: number;
  completedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'ativo' | 'inativo';
};

export type CarePlanEvent = {
  id: string;
  carePlanId: string;
  carePlanActionId: string | null;
  organizationId: string;
  patientId: string;
  professionalId: string;
  eventKind: CarePlanEventKind;
  eventCategory: CarePlanEventCategory;
  payload: Record<string, unknown>;
  note: string | null;
  versionBefore: number | null;
  versionAfter: number | null;
  authoredBy: string;
  createdAt: string;
};

export type CarePlanBundle = {
  plan: CarePlan;
  actions: CarePlanAction[];
  events: CarePlanEvent[];
};

export type CreateCarePlanInput = {
  patientId: string;
  title: string;
  generalObjective: string;
  startsOn: string;
  targetDate?: string | null;
  reassessmentDueOn?: string | null;
  clinicalNotes?: string;
  clinicalRecordId?: string | null;
  planStatus?: 'planejado' | 'em_andamento';
};

export type UpdateCarePlanInput = {
  planId: string;
  expectedVersion: number;
  title?: string;
  generalObjective?: string;
  startsOn?: string;
  targetDate?: string | null;
  reassessmentDueOn?: string | null;
  clinicalNotes?: string;
  planStatus?: 'planejado' | 'em_andamento';
};

export type CreateCarePlanActionInput = {
  planId: string;
  specificObjective: string;
  actionText: string;
  frequency: string;
  dueDate?: string | null;
  displayOrder?: number;
  notes?: string;
};

export type UpdateCarePlanActionInput = {
  actionId: string;
  expectedVersion: number;
  specificObjective?: string;
  actionText?: string;
  frequency?: string;
  dueDate?: string | null;
  displayOrder?: number;
  notes?: string;
  actionStatus?: CarePlanActionStatus;
};

export type CloseCarePlanInput = {
  planId: string;
  expectedVersion: number;
  mode: 'conclude' | 'suspend';
  suspensionReason?: string;
};

export type CarePlanNoteInput = {
  planId: string;
  note: string;
  kind: 'evolution' | 'reassessment';
  reassessmentDueOn?: string | null;
  expectedPlanVersion?: number;
};
