import type {
  JourneyError,
  JourneyErrorCode,
  JourneyErrorKind,
  JourneyResult,
} from '@/services/repositories/journey/types';

type ErrorDefaults = Record<
  JourneyErrorCode,
  { kind: JourneyErrorKind; transient: boolean; message: string }
>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: {
    kind: 'authentication',
    transient: false,
    message: 'Sessao ausente para operacao de jornada.',
  },
  IDENTITY_MISMATCH: {
    kind: 'consistency',
    transient: false,
    message: 'Identidade da sessao diverge da identidade solicitada.',
  },
  CROSS_TENANT_DATA: {
    kind: 'authorization',
    transient: false,
    message: 'Tentativa de acesso cross-tenant bloqueada.',
  },
  NO_ACTIVE_MEMBERSHIP: {
    kind: 'authorization',
    transient: false,
    message: 'Usuario sem vinculo organizacional ativo para jornada.',
  },
  JOURNEY_VERSION_NOT_FOUND: {
    kind: 'validation',
    transient: false,
    message: 'Versao de jornada nao encontrada para o tenant.',
  },
  JOURNEY_VERSION_AMBIGUOUS: {
    kind: 'validation',
    transient: false,
    message: 'Mais de uma versao de jornada ativa encontrada; resolucao ambigua.',
  },
  JOURNEY_VERSION_INELIGIBLE: {
    kind: 'validation',
    transient: false,
    message: 'Versao de jornada nao elegivel para uso.',
  },
  JOURNEY_VERSION_INCOMPATIBLE: {
    kind: 'validation',
    transient: false,
    message: 'Versao de jornada incompativel com passos e atividades.',
  },
  USER_JOURNEY_NOT_FOUND: {
    kind: 'authorization',
    transient: false,
    message: 'Jornada do titular nao encontrada.',
  },
  USER_JOURNEY_COMPLETED: {
    kind: 'validation',
    transient: false,
    message: 'Jornada ja concluida; progresso nao pode ser alterado.',
  },
  ACTIVITY_NOT_FOUND: {
    kind: 'validation',
    transient: false,
    message: 'Atividade nao encontrada para jornada vigente.',
  },
  ACTIVITY_VERSION_MISMATCH: {
    kind: 'validation',
    transient: false,
    message: 'Atividade nao pertence a versao da jornada em andamento.',
  },
  INVALID_PROGRESS_PAYLOAD: {
    kind: 'validation',
    transient: false,
    message: 'Carga de progresso invalida.',
  },
  TECHNICAL_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha tecnica ao operar jornada.',
  },
};

export function journeyError(
  code: JourneyErrorCode,
  overrides: Partial<Omit<JourneyError, 'code'>> = {}
): JourneyError {
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

export function ok<T>(data: T): JourneyResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  code: JourneyErrorCode,
  overrides: Partial<Omit<JourneyError, 'code'>> = {}
): JourneyResult<T> {
  return { ok: false, error: journeyError(code, overrides) };
}
