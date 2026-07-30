import type {
  AssessmentError,
  AssessmentErrorCode,
  AssessmentErrorKind,
  AssessmentResult,
} from '@/services/repositories/assessment/types';

type ErrorDefaults = Record<
  AssessmentErrorCode,
  { kind: AssessmentErrorKind; transient: boolean; message: string }
>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: {
    kind: 'authentication',
    transient: false,
    message: 'Sessao ausente para operacao de avaliacao.',
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
  VERSION_NOT_FOUND: {
    kind: 'validation',
    transient: false,
    message: 'Versao de avaliacao nao encontrada para o tenant.',
  },
  VERSION_INELIGIBLE: {
    kind: 'validation',
    transient: false,
    message: 'Versao de avaliacao encontrada, mas nao elegivel para uso.',
  },
  VERSION_INCOMPATIBLE: {
    kind: 'validation',
    transient: false,
    message: 'Versao de avaliacao incompativel com o formulario operacional.',
  },
  ASSESSMENT_NOT_FOUND: {
    kind: 'authorization',
    transient: false,
    message: 'Avaliacao nao encontrada para o titular autenticado.',
  },
  ASSESSMENT_ALREADY_COMPLETED: {
    kind: 'validation',
    transient: false,
    message: 'Avaliacao ja concluida, sem permitir sobrescrita indevida.',
  },
  INVALID_ANSWER_PAYLOAD: {
    kind: 'validation',
    transient: false,
    message: 'Resposta invalida para o formato esperado da pergunta.',
  },
  QUESTION_NOT_IN_VERSION: {
    kind: 'validation',
    transient: false,
    message: 'Pergunta nao pertence a versao da avaliacao.',
  },
  OPTION_NOT_ALLOWED: {
    kind: 'validation',
    transient: false,
    message: 'Opcao de resposta nao permitida para a pergunta.',
  },
  TECHNICAL_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha tecnica ao operar a avaliacao.',
  },
};

export function assessmentError(
  code: AssessmentErrorCode,
  overrides: Partial<Omit<AssessmentError, 'code'>> = {}
): AssessmentError {
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

export function ok<T>(data: T): AssessmentResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  code: AssessmentErrorCode,
  overrides: Partial<Omit<AssessmentError, 'code'>> = {}
): AssessmentResult<T> {
  return { ok: false, error: assessmentError(code, overrides) };
}
