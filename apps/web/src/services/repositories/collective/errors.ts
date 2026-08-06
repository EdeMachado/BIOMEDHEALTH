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
      'Operacao atomica reservada para operacoes futuras ainda nao implementadas. Nao executada.',
  },
  TECHNICAL_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha tecnica na gestao coletiva.',
  },
  AUDIT_REQUIRED_FAILED: {
    kind: 'technical',
    transient: true,
    message: 'Operacao concluida no dominio, mas a auditoria obrigatoria falhou.',
  },
};

const COLLECTIVE_MESSAGE_CODES = new Set<string>(Object.keys(ERROR_DEFAULTS));

/**
 * Extrai `COLLECTIVE:CODE` de mensagens RPC (P0001 / raise exception).
 * Retorna o codigo tipado quando conhecido; senao null.
 */
export function parseCollectiveMessageCode(message?: string): CollectiveErrorCode | null {
  if (!message) return null;
  const trimmed = message.trim();
  const match =
    /^COLLECTIVE:([A-Z0-9_]+)/i.exec(trimmed) ?? /(?:^|[\s:])COLLECTIVE:([A-Z0-9_]+)/i.exec(trimmed);
  if (!match?.[1]) return null;
  const code = match[1].toUpperCase();
  if (!COLLECTIVE_MESSAGE_CODES.has(code)) return null;
  return code as CollectiveErrorCode;
}

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
