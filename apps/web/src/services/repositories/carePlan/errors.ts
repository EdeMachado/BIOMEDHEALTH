import type {
  CarePlanError,
  CarePlanErrorCode,
  CarePlanErrorKind,
  CarePlanResult,
} from '@/services/repositories/carePlan/types';

type ErrorDefaults = Record<
  CarePlanErrorCode,
  { kind: CarePlanErrorKind; transient: boolean; message: string }
>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: { kind: 'authentication', transient: false, message: 'Sessao ausente para plano de cuidado.' },
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
    message: 'Acesso clinico ao plano de cuidado nao autorizado.',
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
  INVALID_INPUT: { kind: 'validation', transient: false, message: 'Dados do plano de cuidado invalidos.' },
  VALIDATION_REQUIRED_FIELDS: {
    kind: 'validation',
    transient: false,
    message: 'Campos obrigatorios ausentes no plano de cuidado.',
  },
  PLAN_CLOSED: {
    kind: 'validation',
    transient: false,
    message: 'Plano de cuidado encerrado nao pode ser editado.',
  },
  OPEN_PLAN_EXISTS: {
    kind: 'validation',
    transient: false,
    message: 'Ja existe plano nao encerrado para este paciente.',
  },
  VERSION_CONFLICT: {
    kind: 'consistency',
    transient: false,
    message: 'Conflito de versao: o plano foi alterado por outra operacao.',
  },
  NOT_FOUND: { kind: 'validation', transient: false, message: 'Plano de cuidado nao encontrado.' },
  CONFLICT: { kind: 'validation', transient: false, message: 'Conflito ao persistir plano de cuidado.' },
  TECHNICAL_ERROR: { kind: 'technical', transient: true, message: 'Falha tecnica ao operar plano de cuidado.' },
};

export function carePlanError(
  code: CarePlanErrorCode,
  overrides: Partial<Omit<CarePlanError, 'code'>> = {}
): CarePlanError {
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

export function ok<T>(data: T): CarePlanResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  code: CarePlanErrorCode,
  overrides: Partial<Omit<CarePlanError, 'code'>> = {}
): CarePlanResult<T> {
  return { ok: false, error: carePlanError(code, overrides) };
}
