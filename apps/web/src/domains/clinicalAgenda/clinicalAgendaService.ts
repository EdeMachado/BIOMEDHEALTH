import { fail } from '@/services/repositories/clinicalAgenda/errors';
import type { ClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/contracts';
import type {
  ClinicalAgendaContext,
  ClinicalAgendaResult,
  ClinicalAppointment,
  CreateClinicalAppointmentInput,
  UpdateClinicalAppointmentInput,
} from '@/services/repositories/clinicalAgenda/types';
import {
  createNoopClinicalAuditSink,
  type ClinicalAuditSink,
} from '@/domains/clinical/clinicalAuditSink';

function validateContext(context: ClinicalAgendaContext): ClinicalAgendaResult<true> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return { ok: true, data: true };
}

/** Lista compromissos clinicos autorizados ordenados por starts_at. */
export async function loadLinkedClinicalAgenda(
  repository: ClinicalAgendaRepository,
  context: ClinicalAgendaContext
): Promise<ClinicalAgendaResult<ClinicalAppointment[]>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  return repository.listLinkedClinicalAppointments({ context });
}

/** Cria compromisso apenas para paciente da carteira autorizada. */
export async function createLinkedClinicalAppointment(
  repository: ClinicalAgendaRepository,
  context: ClinicalAgendaContext,
  appointment: CreateClinicalAppointmentInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<ClinicalAgendaResult<ClinicalAppointment>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.createClinicalAppointment({ context, appointment });
  auditSink.registerSensitiveOperation({
    code: 'clinical_appointment_created',
    entity: 'clinical_appointment',
    entityId: result.ok ? result.data.id : undefined,
    result: result.ok ? 'sucesso' : 'falha',
  });
  return result;
}

/** Atualiza compromisso do profissional autenticado. */
export async function updateLinkedClinicalAppointment(
  repository: ClinicalAgendaRepository,
  context: ClinicalAgendaContext,
  appointment: UpdateClinicalAppointmentInput,
  auditSink: ClinicalAuditSink = createNoopClinicalAuditSink()
): Promise<ClinicalAgendaResult<ClinicalAppointment>> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  const result = await repository.updateClinicalAppointment({ context, appointment });
  auditSink.registerSensitiveOperation({
    code: 'clinical_appointment_updated',
    entity: 'clinical_appointment',
    entityId: result.ok ? result.data.id : appointment.appointmentId,
    result: result.ok ? 'sucesso' : 'falha',
  });
  return result;
}
