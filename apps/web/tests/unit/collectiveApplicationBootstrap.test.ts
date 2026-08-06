import { describe, expect, it, vi } from 'vitest';
import { bootstrapCollectiveRepository } from '@/application/collective';
import type { SupabaseCollectiveClient } from '@/services/repositories/collective';

describe('collective application bootstrap', () => {
  it('creates the mock repository only when mock mode is explicit or inherited', () => {
    const result = bootstrapCollectiveRepository({
      env: {
        VITE_ENABLE_SUPABASE_AUTH: 'false',
        VITE_COLLECTIVE_REPOSITORY_MODE: 'mock',
      } as ImportMetaEnv,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe('mock');
    expect(result.repository).toBeDefined();
  });

  it('fails closed when Supabase mode has no configured client', () => {
    const result = bootstrapCollectiveRepository({
      env: {
        VITE_COLLECTIVE_REPOSITORY_MODE: 'supabase',
      } as ImportMetaEnv,
      getClient: () => null,
    });

    expect(result).toEqual({
      ok: false,
      message:
        'Modo Supabase ativo sem cliente configurado. Gestao coletiva indisponivel (fail-closed).',
    });
  });

  it('injects the configured Supabase client without consulting global infrastructure', () => {
    const client = {} as SupabaseCollectiveClient;
    const getClient = vi.fn(() => client);
    const result = bootstrapCollectiveRepository({
      env: {
        VITE_COLLECTIVE_REPOSITORY_MODE: 'supabase',
      } as ImportMetaEnv,
      getClient,
    });

    expect(getClient).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe('supabase');
    expect(result.repository).toBeDefined();
  });

  it('returns deterministic configuration errors instead of silently falling back', () => {
    const result = bootstrapCollectiveRepository({
      env: {
        VITE_COLLECTIVE_REPOSITORY_MODE: 'invalid',
      } as ImportMetaEnv,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/VITE_COLLECTIVE_REPOSITORY_MODE/);
    expect(result.message).toMatch(/invalid/);
  });
});
