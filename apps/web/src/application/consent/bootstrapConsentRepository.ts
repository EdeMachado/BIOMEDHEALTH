import { getSupabaseClient } from '@/services/api/supabaseClient';
import {
  createConsentRepositoryFactory,
  resolveConsentRepositoryMode,
} from '@/services/repositories/consent/factory';
import type { ConsentRepository } from '@/services/repositories/consent/contracts';
import type { SupabaseConsentClient } from '@/services/repositories/consent/supabaseConsentRepository';

export type ConsentRepositoryBootstrap =
  | { ok: true; mode: 'mock' | 'supabase'; repository: ConsentRepository }
  | { ok: false; message: string };

export interface ConsentRepositoryBootstrapDependencies {
  env: ImportMetaEnv;
  getClient?: () => SupabaseConsentClient | null;
}

/**
 * Application-layer adapter for consent repository.
 * Supabase mode is fail-closed: never silently falls back to mock.
 */
export function bootstrapConsentRepository(
  dependencies: ConsentRepositoryBootstrapDependencies
): ConsentRepositoryBootstrap {
  try {
    const mode = resolveConsentRepositoryMode(dependencies.env);

    if (mode === 'mock') {
      return {
        ok: true,
        mode,
        repository: createConsentRepositoryFactory({ mode: 'mock' }),
      };
    }

    const getClient =
      dependencies.getClient ??
      (() => getSupabaseClient() as SupabaseConsentClient | null);
    const client = getClient();

    if (!client) {
      return {
        ok: false,
        message:
          'Modo Supabase ativo sem cliente configurado. Consentimentos indisponiveis (fail-closed).',
      };
    }

    return {
      ok: true,
      mode,
      repository: createConsentRepositoryFactory({
        mode: 'supabase',
        supabaseClient: client,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Configuracao invalida do repository de consentimento.',
    };
  }
}
