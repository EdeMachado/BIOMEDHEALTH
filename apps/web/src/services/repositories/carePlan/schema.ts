export const CARE_PLAN_SCHEMA_VERSION = 'care_plan.v1' as const;

export type CarePlanStatus = 'planejado' | 'em_andamento' | 'concluido' | 'suspenso';
export type CarePlanActionStatus = 'pendente' | 'em_andamento' | 'concluida' | 'suspensa' | 'cancelada';

export type CarePlanEventKind =
  | 'create'
  | 'plan_update'
  | 'action_create'
  | 'action_update'
  | 'action_status'
  | 'plan_status'
  | 'evolution'
  | 'reassessment'
  | 'conclude'
  | 'suspend';

export type CarePlanEventCategory =
  | 'structural'
  | 'clinical_evolution'
  | 'reassessment'
  | 'status_change';

export function isOpenCarePlanStatus(status: CarePlanStatus): boolean {
  return status === 'planejado' || status === 'em_andamento';
}

export function isClosedCarePlanStatus(status: CarePlanStatus): boolean {
  return status === 'concluido' || status === 'suspenso';
}
