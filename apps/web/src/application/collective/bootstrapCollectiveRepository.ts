import { getSupabaseClient } from '@/services/api/supabaseClient';
import {
  createCollectiveRepositoryFactory,
  resolveCollectiveRepositoryMode,
  type CollectiveRepository,
  type SupabaseCollectiveClient,
} from '@/services/repositories/collective';

export type CollectiveRepositoryBootstrap =
  | { ok: true; mode: 'mock' | 'supabase'; repository: CollectiveRepository }
  | { ok: false; message: string };

export interface CollectiveRepositoryBootstrapDependencies {
  env: ImportMetaEnv;
  getClient?: () => SupabaseCollectiveClient | null;
}

/**
 * Application-layer adapter for the collective repository.
 *
 * The UI must not decide repository mode, instantiate infrastructure,
 * or silently fall back to demo data. Supabase mode remains fail-closed.
 */
export function bootstrapCollectiveRepository(
  dependencies: CollectiveRepositoryBootstrapDependencies
): CollectiveRepositoryBootstrap {
  try {
    const mode = resolveCollectiveRepositoryMode(dependencies.env);

    if (mode === 'mock') {
      return {
        ok: true,
        mode,
        repository: createCollectiveRepositoryFactory({ mode: 'mock' }),
      };
    }

    const getClient =
      dependencies.getClient ??
      (() => getSupabaseClient() as unknown as SupabaseCollectiveClient | null);
    const client = getClient();

    if (!client) {
      return {
        ok: false,
        message:
          'Modo Supabase ativo sem cliente configurado. Gestao coletiva indisponivel (fail-closed).',
      };
    }

    return {
      ok: true,
      mode,
      repository: createCollectiveRepositoryFactory({
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
          : 'Configuracao invalida do repository coletivo.',
    };
  }
}
