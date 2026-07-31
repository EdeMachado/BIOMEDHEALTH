import type {
  ClinicalPortfolioError,
  ClinicalPortfolioErrorCode,
  ClinicalPortfolioErrorKind,
  ClinicalPortfolioResult,
} from '@/services/repositories/clinicalPortfolio/types';

type ErrorDefaults = Record<
  ClinicalPortfolioErrorCode,
  { kind: ClinicalPortfolioErrorKind; transient: boolean; message: string }
>;

const ERROR_DEFAULTS: ErrorDefaults = {
  NO_SESSION: {
    kind: 'authentication',
    transient: false,
    message: 'Sessao ausente para carteira clinica.',
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
    message: 'Acesso clinico a carteira nao autorizado.',
  },
  CROSS_TENANT_DATA: {
    kind: 'authorization',
    transient: false,
    message: 'Tentativa de acesso cross-tenant bloqueada.',
  },
  TECHNICAL_ERROR: {
    kind: 'technical',
    transient: true,
    message: 'Falha tecnica ao carregar carteira clinica.',
  },
};

export function portfolioError(
  code: ClinicalPortfolioErrorCode,
  overrides: Partial<Omit<ClinicalPortfolioError, 'code'>> = {}
): ClinicalPortfolioError {
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

export function ok<T>(data: T): ClinicalPortfolioResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  code: ClinicalPortfolioErrorCode,
  overrides: Partial<Omit<ClinicalPortfolioError, 'code'>> = {}
): ClinicalPortfolioResult<T> {
  return { ok: false, error: portfolioError(code, overrides) };
}
