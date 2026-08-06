import { getSupabaseClient } from '@/services/api/supabaseClient';
import {
  createAssessmentRepositoryFactory,
  resolveAssessmentRepositoryMode,
} from '@/services/repositories/assessment/factory';
import type { AssessmentRepository } from '@/services/repositories/assessment/contracts';
import type { SupabaseAssessmentClient } from '@/services/repositories/assessment/supabaseAssessmentRepository';

export type AssessmentRepositoryBootstrap =
  | { ok: true; mode: 'mock' | 'supabase'; repository: AssessmentRepository }
  | { ok: false; message: string };

export interface AssessmentRepositoryBootstrapDependencies {
  env: ImportMetaEnv;
  getClient?: () => SupabaseAssessmentClient | null;
}

/**
 * Application-layer adapter for assessment repository.
 * Supabase mode is fail-closed: never silently falls back to mock.
 */
export function bootstrapAssessmentRepository(
  dependencies: AssessmentRepositoryBootstrapDependencies
): AssessmentRepositoryBootstrap {
  try {
    const mode = resolveAssessmentRepositoryMode(dependencies.env);

    if (mode === 'mock') {
      return {
        ok: true,
        mode,
        repository: createAssessmentRepositoryFactory({ mode: 'mock' }),
      };
    }

    const getClient =
      dependencies.getClient ??
      (() => getSupabaseClient() as SupabaseAssessmentClient | null);
    const client = getClient();

    if (!client) {
      return {
        ok: false,
        message:
          'Modo Supabase ativo sem cliente configurado. Avaliacao indisponivel (fail-closed).',
      };
    }

    return {
      ok: true,
      mode,
      repository: createAssessmentRepositoryFactory({
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
          : 'Configuracao invalida do repository de avaliacao.',
    };
  }
}
