import { fail, ok } from '@/services/repositories/clinicalAgenda/errors';
import type { ClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/contracts';
import type {
  ClinicalAgendaContext,
  ClinicalAgendaResult,
  ClinicalAppointment,
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@/services/repositories/clinicalAgenda/types';
import {
  assignedPatientsByProfessional,
  clinicalPatients,
} from '@/services/repositories/demoData';

type MockAppointment = ClinicalAppointment;

type MockState = {
  appointments: MockAppointment[];
};

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `appt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortByStartsAt(items: ClinicalAppointment[]): ClinicalAppointment[] {
  return [...items].sort((a, b) => {
    const byStart = a.startsAt.localeCompare(b.startsAt);
    if (byStart !== 0) return byStart;
    return a.id.localeCompare(b.id);
  });
}

function validateContext(context: ClinicalAgendaContext): ClinicalAgendaResult<true> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return ok(true);
}

function isKnownClinicalProfessional(professionalId: string): boolean {
  return Object.prototype.hasOwnProperty.call(assignedPatientsByProfessional, professionalId);
}

function portfolioPatientIds(context: ClinicalAgendaContext): Set<string> {
  return new Set(
    (assignedPatientsByProfessional[context.professionalUserId] ?? []).filter(Boolean)
  );
}

function assertClinicalAccess(context: ClinicalAgendaContext): ClinicalAgendaResult<true> {
  const validation = validateContext(context);
  if (!validation.ok) return validation;
  if (!isKnownClinicalProfessional(context.professionalUserId)) {
    return fail('CLINICAL_ACCESS_DENIED');
  }
  return ok(true);
}

function isValidStatus(value: string): value is ClinicalAppointmentStatus {
  return ['solicitado', 'confirmado', 'concluido', 'cancelado', 'ausencia'].includes(value);
}

function isValidType(value: string): value is ClinicalAppointmentType {
  return ['preventiva', 'reavaliacao', 'acompanhamento'].includes(value);
}

function validateSlot(startsAt: string, endsAt: string): ClinicalAgendaResult<true> {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return fail('INVALID_INPUT');
  return ok(true);
}

function localDayIso(hours: number, minutes: number): { startsAt: string; endsAt: string } {
  const start = new Date();
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function defaultAppointments(): MockAppointment[] {
  // Espelha o demo visual atual da agenda clinica (modo mock somente), no dia local.
  const slot1 = localDayIso(9, 0);
  const slot2 = localDayIso(11, 0);
  const slot3 = localDayIso(14, 30);
  return [
    {
      id: 'appt-demo-1',
      organizationId: 'org-1',
      patientId: 'usr-1',
      professionalId: 'pro-1',
      startsAt: slot1.startsAt,
      endsAt: slot1.endsAt,
      appointmentStatus: 'confirmado',
      appointmentType: 'reavaliacao',
      status: 'ativo',
    },
    {
      id: 'appt-demo-2',
      organizationId: 'org-1',
      patientId: 'usr-3',
      professionalId: 'pro-1',
      startsAt: slot2.startsAt,
      endsAt: slot2.endsAt,
      appointmentStatus: 'solicitado',
      appointmentType: 'reavaliacao',
      status: 'ativo',
    },
    {
      id: 'appt-demo-3',
      organizationId: 'org-1',
      patientId: 'usr-4',
      professionalId: 'pro-1',
      startsAt: slot3.startsAt,
      endsAt: slot3.endsAt,
      appointmentStatus: 'concluido',
      appointmentType: 'acompanhamento',
      status: 'ativo',
    },
  ];
}

export function displayNameForAgendaPatient(patientId: string): string {
  return clinicalPatients.find((item) => item.id === patientId)?.nome ?? 'Paciente';
}

export function createMockClinicalAgendaRepository(
  input: { seed?: Partial<MockState> } = {}
): ClinicalAgendaRepository {
  const state: MockState = {
    appointments: input.seed?.appointments ?? defaultAppointments(),
  };

  return {
    listLinkedClinicalAppointments({ context }) {
      const access = assertClinicalAccess(context);
      if (!access.ok) return Promise.resolve(access);

      return Promise.resolve(
        ok(
          sortByStartsAt(
            state.appointments.filter(
              (item) =>
                item.organizationId === context.organizationId &&
                item.professionalId === context.professionalUserId &&
                item.status === 'ativo' &&
                portfolioPatientIds(context).has(item.patientId)
            )
          )
        )
      );
    },

    createClinicalAppointment({ context, appointment }) {
      const access = assertClinicalAccess(context);
      if (!access.ok) return Promise.resolve(access);
      if (!portfolioPatientIds(context).has(appointment.patientId)) {
        return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      }
      if (!isValidStatus(appointment.appointmentStatus) || !isValidType(appointment.appointmentType)) {
        return Promise.resolve(fail('INVALID_INPUT'));
      }
      const slot = validateSlot(appointment.startsAt, appointment.endsAt);
      if (!slot.ok) return Promise.resolve(slot);

      const conflict = state.appointments.some(
        (item) =>
          item.organizationId === context.organizationId &&
          item.professionalId === context.professionalUserId &&
          item.patientId === appointment.patientId &&
          item.startsAt === appointment.startsAt &&
          item.status === 'ativo'
      );
      if (conflict) return Promise.resolve(fail('CONFLICT'));

      const created: MockAppointment = {
        id: createId(),
        organizationId: context.organizationId,
        patientId: appointment.patientId,
        professionalId: context.professionalUserId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        appointmentStatus: appointment.appointmentStatus,
        appointmentType: appointment.appointmentType,
        status: 'ativo',
      };
      state.appointments.push(created);
      return Promise.resolve(ok(created));
    },

    updateClinicalAppointment({ context, appointment }) {
      const access = assertClinicalAccess(context);
      if (!access.ok) return Promise.resolve(access);

      const index = state.appointments.findIndex(
        (item) =>
          item.id === appointment.appointmentId &&
          item.organizationId === context.organizationId &&
          item.professionalId === context.professionalUserId
      );
      if (index < 0) return Promise.resolve(fail('NOT_FOUND'));

      const current = state.appointments[index];
      if (!portfolioPatientIds(context).has(current.patientId)) {
        return Promise.resolve(fail('PATIENT_NOT_IN_PORTFOLIO'));
      }

      const nextStatus = appointment.appointmentStatus ?? current.appointmentStatus;
      const nextType = appointment.appointmentType ?? current.appointmentType;
      const nextStarts = appointment.startsAt ?? current.startsAt;
      const nextEnds = appointment.endsAt ?? current.endsAt;
      if (!isValidStatus(nextStatus) || !isValidType(nextType)) {
        return Promise.resolve(fail('INVALID_INPUT'));
      }
      const slot = validateSlot(nextStarts, nextEnds);
      if (!slot.ok) return Promise.resolve(slot);

      const conflict = state.appointments.some(
        (item, itemIndex) =>
          itemIndex !== index &&
          item.organizationId === context.organizationId &&
          item.professionalId === context.professionalUserId &&
          item.patientId === current.patientId &&
          item.startsAt === nextStarts &&
          item.status === 'ativo'
      );
      if (conflict) return Promise.resolve(fail('CONFLICT'));

      const updated: MockAppointment = {
        ...current,
        startsAt: nextStarts,
        endsAt: nextEnds,
        appointmentStatus: nextStatus,
        appointmentType: nextType,
      };
      state.appointments[index] = updated;
      return Promise.resolve(ok(updated));
    },
  };
}
