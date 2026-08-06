import { getSupabaseClient } from '@/services/api/supabaseClient';
import {
  createAuditTrailFactory,
  resolveAuditTrailMode,
  type AuditTrail,
  type SupabaseAuditClient,
} from '@/services/repositories/audit';

export type AuditTrailBootstrap =
  | { ok: true; mode: 'mock' | 'supabase'; trail: AuditTrail }
  | { ok: false; message: string };

export interface AuditTrailBootstrapDependencies {
  env: ImportMetaEnv;
  getClient?: () => SupabaseAuditClient | null;
}

/**
 * Single application adapter for audit persistence.
 * Mock mode may use sessionStorage; Supabase mode never falls back to mock.
 */
export function bootstrapAuditTrail(
  dependencies: AuditTrailBootstrapDependencies
): AuditTrailBootstrap {
  try {
    const mode = resolveAuditTrailMode(dependencies.env);

    if (mode === 'mock') {
      return {
        ok: true,
        mode,
        trail: createAuditTrailFactory({ mode: 'mock' }),
      };
    }

    const getClient =
      dependencies.getClient ??
      (() => getSupabaseClient() as SupabaseAuditClient | null);
    const client = getClient();

    if (!client) {
      return {
        ok: false,
        message:
          'Modo Supabase ativo sem cliente configurado. Auditoria indisponivel (fail-closed).',
      };
    }

    return {
      ok: true,
      mode,
      trail: createAuditTrailFactory({
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
          : 'Configuracao invalida do adapter de auditoria.',
    };
  }
}
