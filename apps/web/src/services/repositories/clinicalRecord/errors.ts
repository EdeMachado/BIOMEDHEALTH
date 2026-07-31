import type {
  ClinicalRecordError,
  ClinicalRecordErrorCode,
  ClinicalRecordErrorKind,
  ClinicalRecordResult,
} from '@/services/repositories/clinicalRecord/types';

type ErrorDefaults = Record<
  ClinicalRecordErrorCode,
  { kind: ClinicalRecordErrorKind; transient: boolean; message: string }
>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: {
    kind: 'authentication',
    transient: false,
    message: 'Sessao ausente para ficha clinica.',
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
    message: 'Acesso clinico a ficha nao autorizado.',
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
    message: 'Dados da ficha clinica invalidos.',
  },
  VALIDATION_REQUIRED_FIELDS: {
    kind: 'validation',
    transient: false,
    message: 'Campos obrigatorios ausentes para conclusao da ficha.',
  },
  RECORD_CONCLUDED: {
    kind: 'validation',
    transient: false,
    message: 'Ficha clinica concluida nao pode ser editada.',
  },
  NOT_FOUND: {
    kind: 'validation',
    transient: false,
    message: 'Ficha clinica nao encontrada.',
  },
  CONFLICT: {
    kind: 'validation',
    transient: false,
    message: 'Conflito ao persistir ficha clinica.',
  },
  TECHNICAL_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha tecnica ao operar ficha clinica.',
  },
};

export function clinicalRecordError(
  code: ClinicalRecordErrorCode,
  overrides: Partial<Omit<ClinicalRecordError, 'code'>> = {}
): ClinicalRecordError {
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

export function ok<T>(data: T): ClinicalRecordResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  code: ClinicalRecordErrorCode,
  overrides: Partial<Omit<ClinicalRecordError, 'code'>> = {}
): ClinicalRecordResult<T> {
  return { ok: false, error: clinicalRecordError(code, overrides) };
}
