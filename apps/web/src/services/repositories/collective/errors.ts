import type {
  CollectiveError,
  CollectiveErrorCode,
  CollectiveErrorKind,
  CollectiveResult,
} from '@/services/repositories/collective/types';

type ErrorDefaults = Record<
  CollectiveErrorCode,
  { kind: CollectiveErrorKind; transient: boolean; message: string }
>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: {
    kind: 'authentication',
    transient: false,
    message: 'Sessao ausente para gestao coletiva.',
  },
  IDENTITY_MISMATCH: {
    kind: 'consistency',
    transient: false,
    message: 'Identidade da sessao diverge do contexto solicitado.',
  },
  NO_ACTIVE_MEMBERSHIP: {
    kind: 'authorization',
    transient: false,
    message: 'Usuario sem vinculo organizacional ativo.',
  },
  CROSS_TENANT_DATA: {
    kind: 'authorization',
    transient: false,
    message: 'Acesso cross-tenant bloqueado.',
  },
  AUTHORIZATION_DENIED: {
    kind: 'authorization',
    transient: false,
    message: 'Operacao coletiva nao autorizada.',
  },
  INVALID_INPUT: {
    kind: 'validation',
    transient: false,
    message: 'Dados coletivos invalidos.',
  },
  NOT_FOUND: {
    kind: 'validation',
    transient: false,
    message: 'Recurso coletivo nao encontrado.',
  },
  CONFLICT: {
    kind: 'consistency',
    transient: false,
    message: 'Conflito ao persistir recurso coletivo.',
  },
  ATOMICITY_REQUIRED: {
    kind: 'atomicity',
    transient: false,
    message:
      'Operacao multi-tabela exige RPC/transacao autorizada (fora do D01-C). Nao executada.',
  },
  TECHNICAL_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha tecnica na gestao coletiva.',
  },
};

export function collectiveError(
  code: CollectiveErrorCode,
  overrides: Partial<Omit<CollectiveError, 'code'>> = {}
): CollectiveError {
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

export function ok<T>(data: T): CollectiveResult<T> {
  return { ok: true, data };
}

export function fail(
  code: CollectiveErrorCode,
  overrides: Partial<Omit<CollectiveError, 'code'>> = {}
): { ok: false; error: CollectiveError } {
  return { ok: false, error: collectiveError(code, overrides) };
}
