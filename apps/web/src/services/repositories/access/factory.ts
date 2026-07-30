import { createMockAccessRepository } from '@/services/repositories/access/mockAccessRepository';
import {
  createSupabaseAccessRepository,
  type SupabaseAccessClient,
} from '@/services/repositories/access/supabaseAccessRepository';
import type { AccessContextRepository } from '@/services/repositories/access/contracts';
import type { AccessContext, AccessErrorCode, AccessIdentity, AccessResult } from '@/services/repositories/access/types';

export type AccessRepositoryMode = 'mock' | 'supabase';
export type AccessRuntimeEnvironment = 'production' | 'non-production';

export type AccessFallbackPolicy = {
  enableTransientFallback: boolean;
  runtime: AccessRuntimeEnvironment;
};

type AccessRepositoryFactoryInput = {
  mode: AccessRepositoryMode;
  supabaseClient?: SupabaseAccessClient | null;
  fallbackPolicy?: AccessFallbackPolicy;
};

type AccessRepositoryModeEnvironment = {
  VITE_ENABLE_SUPABASE_AUTH?: string;
};

const FALLBACK_BLOCKED_CODES: ReadonlySet<AccessErrorCode> = new Set([
  'NO_SESSION',
  'USER_NOT_FOUND',
  'ORGANIZATION_NOT_FOUND',
  'ORGANIZATION_INACTIVE',
  'NO_ACTIVE_MEMBERSHIP',
  'MEMBERSHIP_INACTIVE',
  'NO_ACTIVE_ROLES',
  'UNIT_SCOPE_INCOMPATIBLE',
  'CROSS_TENANT_DATA',
  'IDENTITY_MISMATCH',
  'UNEXPECTED_BACKEND_ERROR',
]);

export function resolveAccessRepositoryMode(env: AccessRepositoryModeEnvironment): AccessRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor inválido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function resolveRuntimeEnvironment(env: { VITE_APP_ENV?: string }): AccessRuntimeEnvironment {
  if (env.VITE_APP_ENV === 'production') return 'production';
  return 'non-production';
}

export function createAccessContextRepositoryFactory(
  input: AccessRepositoryFactoryInput
): AccessContextRepository {
  const fallbackPolicy = input.fallbackPolicy ?? {
    enableTransientFallback: false,
    runtime: 'non-production',
  };

  if (input.mode === 'mock') {
    return createMockAccessRepository();
  }

  if (!input.supabaseClient) {
    throw new Error('Modo Supabase exige client por injeção.');
  }

  const supabaseRepository = createSupabaseAccessRepository({
    client: input.supabaseClient,
  });

  if (!fallbackPolicy.enableTransientFallback) {
    return supabaseRepository;
  }

  const fallbackRepository = createMockAccessRepository();

  return {
    async resolveAccessContext(identity: AccessIdentity): Promise<AccessResult<AccessContext>> {
      const primaryResult = await supabaseRepository.resolveAccessContext(identity);
      if (primaryResult.ok) return primaryResult;

      if (!shouldAttemptFallback(primaryResult.error.code, fallbackPolicy)) {
        return primaryResult;
      }

      const fallbackResult = await fallbackRepository.resolveAccessContext(identity);
      if (!fallbackResult.ok) return primaryResult;
      if (!isFallbackContextCompatible(identity, fallbackResult.data)) return primaryResult;
      return fallbackResult;
    },
  };
}

export function shouldAttemptFallback(
  errorCode: AccessErrorCode,
  fallbackPolicy: AccessFallbackPolicy
): boolean {
  if (FALLBACK_BLOCKED_CODES.has(errorCode)) return false;
  if (errorCode !== 'TRANSIENT_BACKEND_ERROR') return false;
  if (!fallbackPolicy.enableTransientFallback) return false;
  if (fallbackPolicy.runtime === 'production') return false;
  return true;
}

export function isFallbackContextCompatible(
  requestedIdentity: AccessIdentity,
  fallbackContext: AccessContext
): boolean {
  if (!requestedIdentity.sessionUserId || !requestedIdentity.userId) return false;
  if (requestedIdentity.sessionUserId !== requestedIdentity.userId) return false;

  const fallbackIdentity = fallbackContext.identity;
  if (
    fallbackIdentity.sessionUserId !== requestedIdentity.sessionUserId ||
    fallbackIdentity.userId !== requestedIdentity.userId ||
    fallbackIdentity.organizationId !== requestedIdentity.organizationId
  ) {
    return false;
  }

  const requestedUnitId = requestedIdentity.selectedUnitId ?? null;
  const fallbackUnitId = fallbackIdentity.selectedUnitId ?? null;
  if (requestedUnitId !== fallbackUnitId) return false;

  if (fallbackContext.membership.userId !== requestedIdentity.userId) return false;
  if (fallbackContext.membership.organizationId !== requestedIdentity.organizationId) return false;
  if (fallbackContext.organization.id !== requestedIdentity.organizationId) return false;

  if (fallbackContext.roles.length === 0) return false;
  if (!fallbackContext.roles.includes(fallbackContext.effectiveRole)) return false;

  if (
    fallbackContext.roleBindings.some(
      (binding) => binding.membershipId !== fallbackContext.membership.id
    )
  ) {
    return false;
  }

  if (
    fallbackContext.unitScopes.some(
      (scope) =>
        scope.membershipId !== fallbackContext.membership.id ||
        scope.organizationId !== requestedIdentity.organizationId
    )
  ) {
    return false;
  }

  return true;
}
