import type {
  ClinicalAgendaError,
  ClinicalAgendaErrorCode,
  ClinicalAgendaErrorKind,
  ClinicalAgendaResult,
} from '@/services/repositories/clinicalAgenda/types';

type ErrorDefaults = Record<
  ClinicalAgendaErrorCode,
  { kind: ClinicalAgendaErrorKind; transient: boolean; message: string }
>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: {
    kind: 'authentication',
    transient: false,
    message: 'Sessao ausente para agenda clinica.',
  },
  IDENTITY_MISMATCH: {
    kind: 'consistency',
    transient: false,
    message: 'Identidade da sessao diverge da identidade profissional solicitada.',
  },
  NO_ACTIVE_MEMBERSHIP: {
    kind: 'authorization',
    transient: false,
    message: 'Profissional sem vinculo organizacional ativo.',
  },
  CLINICAL_ACCESS_DENIED: {
    kind: 'authorization',
    transient: false,
    message: 'Acesso clinico a agenda nao autorizado.',
  },
  PATIENT_NOT_IN_PORTFOLIO: {
    kind: 'authorization',
    transient: false,
    message: 'Paciente fora da carteira clinica autorizada.',
  },
  CROSS_TENANT_DATA: {
    kind: 'authorization',
    transient: false,
    message: 'Tentativa de acesso cross-tenant bloqueada.',
  },
  INVALID_INPUT: {
    kind: 'validation',
    transient: false,
    message: 'Dados do compromisso clinico invalidos.',
  },
  NOT_FOUND: {
    kind: 'validation',
    transient: false,
    message: 'Compromisso clinico nao encontrado.',
  },
  CONFLICT: {
    kind: 'validation',
    transient: false,
    message: 'Conflito de horario ou duplicidade de compromisso.',
  },
  TECHNICAL_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha tecnica ao operar agenda clinica.',
  },
};

export function agendaError(
  code: ClinicalAgendaErrorCode,
  overrides: Partial<Omit<ClinicalAgendaError, 'code'>> = {}
): ClinicalAgendaError {
  const defaults = ERROR_DEFAULTS[code];
  return {
    code,
    kind: overrides.kind ?? defaults.kind,
    transient: overrides.transient ?? defaults.transient,
    message: overrides.message ?? defaults.message,
    details: overrides.details,
    cause: overrides.cause,
  };
}

export function ok<T>(data: T): ClinicalAgendaResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  code: ClinicalAgendaErrorCode,
  overrides: Partial<Omit<ClinicalAgendaError, 'code'>> = {}
): ClinicalAgendaResult<T> {
  return { ok: false, error: agendaError(code, overrides) };
}
