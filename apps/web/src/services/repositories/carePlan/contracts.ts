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

export interface CarePlanRepository {
  listCarePlans(input: {
    context: CarePlanContext;
    patientId: string;
  }): Promise<CarePlanResult<CarePlan[]>>;

  getOpenCarePlan(input: {
    context: CarePlanContext;
    patientId: string;
  }): Promise<CarePlanResult<CarePlanBundle | null>>;

  getCarePlanBundle(input: {
    context: CarePlanContext;
    planId: string;
  }): Promise<CarePlanResult<CarePlanBundle>>;

  createCarePlan(input: {
    context: CarePlanContext;
    plan: CreateCarePlanInput;
  }): Promise<CarePlanResult<CarePlan>>;

  updateCarePlan(input: {
    context: CarePlanContext;
    plan: UpdateCarePlanInput;
  }): Promise<CarePlanResult<CarePlan>>;

  createCarePlanAction(input: {
    context: CarePlanContext;
    action: CreateCarePlanActionInput;
  }): Promise<CarePlanResult<CarePlanAction>>;

  updateCarePlanAction(input: {
    context: CarePlanContext;
    action: UpdateCarePlanActionInput;
  }): Promise<CarePlanResult<CarePlanAction>>;

  closeCarePlan(input: {
    context: CarePlanContext;
    close: CloseCarePlanInput;
  }): Promise<CarePlanResult<CarePlan>>;

  addCarePlanNote(input: {
    context: CarePlanContext;
    note: CarePlanNoteInput;
  }): Promise<CarePlanResult<CarePlanEvent>>;

  listCarePlanEvents(input: {
    context: CarePlanContext;
    planId: string;
  }): Promise<CarePlanResult<CarePlanEvent[]>>;
}
