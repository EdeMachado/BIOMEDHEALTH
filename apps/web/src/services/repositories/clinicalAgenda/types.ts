export type ClinicalAgendaErrorKind =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'technical'
  | 'consistency';

export type ClinicalAgendaErrorCode =
  | 'NO_SESSION'
  | 'IDENTITY_MISMATCH'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'CLINICAL_ACCESS_DENIED'
  | 'PATIENT_NOT_IN_PORTFOLIO'
  | 'CROSS_TENANT_DATA'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TECHNICAL_ERROR';

export type ClinicalAgendaError = {
  code: ClinicalAgendaErrorCode;
  kind: ClinicalAgendaErrorKind;
  transient: boolean;
  message: string;
  details?: string;
  cause?: { source: 'repository'; code?: string; message?: string };
};

export type ClinicalAgendaResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ClinicalAgendaError };

export type ClinicalAgendaContext = {
  sessionUserId: string;
  professionalUserId: string;
  organizationId: string;
};

export type ClinicalAppointmentStatus =
  | 'solicitado'
  | 'confirmado'
  | 'concluido'
  | 'cancelado'
  | 'ausencia';

export type ClinicalAppointmentType = 'preventiva' | 'reavaliacao' | 'acompanhamento';

export type ClinicalAppointment = {
  id: string;
  organizationId: string;
  patientId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  appointmentStatus: ClinicalAppointmentStatus;
  appointmentType: ClinicalAppointmentType;
  status: 'ativo' | 'inativo';
};

export type CreateClinicalAppointmentInput = {
  patientId: string;
  startsAt: string;
  endsAt: string;
  appointmentStatus: ClinicalAppointmentStatus;
  appointmentType: ClinicalAppointmentType;
};

export type UpdateClinicalAppointmentInput = {
  appointmentId: string;
  startsAt?: string;
  endsAt?: string;
  appointmentStatus?: ClinicalAppointmentStatus;
  appointmentType?: ClinicalAppointmentType;
};
