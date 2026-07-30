import type { ConsentError, ConsentErrorCode, ConsentErrorKind, ConsentResult } from '@/services/repositories/consent/types';

type ErrorDefaults = Record<ConsentErrorCode, { kind: ConsentErrorKind; transient: boolean; message: string }>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: {
    kind: 'authentication',
    transient: false,
    message: 'Sessao ausente para operacao de consentimento.',
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
  INELIGIBLE_DOCUMENT: {
    kind: 'validation',
    transient: false,
    message: 'Documento de consentimento nao elegivel para aceite.',
  },
  CONSENT_NOT_FOUND: {
    kind: 'authorization',
    transient: false,
    message: 'Consentimento nao encontrado para o titular autenticado.',
  },
  CONSENT_ALREADY_ACTIVE: {
    kind: 'validation',
    transient: false,
    message: 'Ja existe aceite ativo para o mesmo documento.',
  },
  CONSENT_ALREADY_REVOKED: {
    kind: 'validation',
    transient: false,
    message: 'Consentimento ja foi revogado anteriormente.',
  },
  TECHNICAL_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha tecnica ao operar consentimentos.',
  },
};

export function consentError(
  code: ConsentErrorCode,
  overrides: Partial<Omit<ConsentError, 'code'>> = {}
): ConsentError {
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

export function ok<T>(data: T): ConsentResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  code: ConsentErrorCode,
  overrides: Partial<Omit<ConsentError, 'code'>> = {}
): ConsentResult<T> {
  return { ok: false, error: consentError(code, overrides) };
}
