import type {
  ClinicalAgendaContext,
  ClinicalAgendaResult,
  ClinicalAppointment,
  CreateClinicalAppointmentInput,
  UpdateClinicalAppointmentInput,
} from '@/services/repositories/clinicalAgenda/types';

export interface ClinicalAgendaRepository {
  listLinkedClinicalAppointments(input: {
    context: ClinicalAgendaContext;
  }): Promise<ClinicalAgendaResult<ClinicalAppointment[]>>;

  createClinicalAppointment(input: {
    context: ClinicalAgendaContext;
    appointment: CreateClinicalAppointmentInput;
  }): Promise<ClinicalAgendaResult<ClinicalAppointment>>;

  updateClinicalAppointment(input: {
    context: ClinicalAgendaContext;
    appointment: UpdateClinicalAppointmentInput;
  }): Promise<ClinicalAgendaResult<ClinicalAppointment>>;
}
