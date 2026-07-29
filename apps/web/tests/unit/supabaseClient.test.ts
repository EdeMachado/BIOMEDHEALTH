import { describe, expect, it } from 'vitest';
import { isSupabaseAuthEnabled, validateSupabaseConfiguration } from '@/services/api/supabaseClient';

describe('supabaseClient configuration safety', () => {
  it('desabilita Supabase quando flag esta false', () => {
    const env = {
      VITE_ENABLE_SUPABASE_AUTH: 'false',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    };

    expect(isSupabaseAuthEnabled(env)).toBe(false);
    expect(validateSupabaseConfiguration(env)).toBeNull();
  });

  it('falha de forma segura sem credenciais quando flag esta true', () => {
    const env = {
      VITE_ENABLE_SUPABASE_AUTH: 'true',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    };

    expect(isSupabaseAuthEnabled(env)).toBe(true);
    expect(validateSupabaseConfiguration(env)).toBe('Supabase habilitado sem credenciais configuradas.');
  });
});
