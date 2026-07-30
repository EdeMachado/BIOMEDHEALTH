import type { AccessError, AccessErrorCode, AccessErrorKind, AccessResult } from '@/services/repositories/access/types';

type ErrorDefaults = Record<AccessErrorCode, { kind: AccessErrorKind; transient: boolean; message: string }>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: {
    kind: 'authentication',
    transient: false,
    message: 'Sessão ausente para resolução de acesso.',
  },
  USER_NOT_FOUND: {
    kind: 'authentication',
    transient: false,
    message: 'Usuário autenticado não encontrado no repositório de acesso.',
  },
  ORGANIZATION_NOT_FOUND: {
    kind: 'authorization',
    transient: false,
    message: 'Organização informada não encontrada.',
  },
  ORGANIZATION_INACTIVE: {
    kind: 'authorization',
    transient: false,
    message: 'Organização informada está inativa.',
  },
  NO_ACTIVE_MEMBERSHIP: {
    kind: 'authorization',
    transient: false,
    message: 'Usuário sem vínculo ativo com a organização informada.',
  },
  MEMBERSHIP_INACTIVE: {
    kind: 'authorization',
    transient: false,
    message: 'Vínculo do usuário com a organização está inativo.',
  },
  NO_ACTIVE_ROLES: {
    kind: 'authorization',
    transient: false,
    message: 'Usuário sem papéis ativos para o vínculo informado.',
  },
  UNIT_SCOPE_INCOMPATIBLE: {
    kind: 'authorization',
    transient: false,
    message: 'Unidade solicitada não é compatível com os escopos autorizados.',
  },
  CROSS_TENANT_DATA: {
    kind: 'consistency',
    transient: false,
    message: 'Dados inconsistentes de tenant foram detectados na resolução.',
  },
  IDENTITY_MISMATCH: {
    kind: 'consistency',
    transient: false,
    message: 'Identidade da sessão não corresponde à identidade requisitada.',
  },
  TRANSIENT_BACKEND_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha técnica transitória ao resolver acesso.',
  },
  UNEXPECTED_BACKEND_ERROR: {
    kind: 'technical',
    transient: false,
    message: 'Falha técnica inesperada ao resolver acesso.',
  },
};

export function accessError(
  code: AccessErrorCode,
  overrides: Partial<Omit<AccessError, 'code'>> = {}
): AccessError {
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

export function ok<T>(data: T): AccessResult<T> {
  return { ok: true, data };
}

export function fail<T>(code: AccessErrorCode, overrides: Partial<Omit<AccessError, 'code'>> = {}): AccessResult<T> {
  return { ok: false, error: accessError(code, overrides) };
}
