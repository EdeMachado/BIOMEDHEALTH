import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Environment = {
  VITE_ENABLE_SUPABASE_AUTH?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

let client: SupabaseClient | null = null;

export function isSupabaseAuthEnabled(env: Environment = import.meta.env): boolean {
  return env.VITE_ENABLE_SUPABASE_AUTH === 'true';
}

export function validateSupabaseConfiguration(env: Environment = import.meta.env): string | null {
  if (!isSupabaseAuthEnabled(env)) return null;

  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    return 'Supabase habilitado sem credenciais configuradas.';
  }
  return null;
}

export function getSupabaseClient(env: Environment = import.meta.env): SupabaseClient | null {
  if (!isSupabaseAuthEnabled(env)) return null;
  const configError = validateSupabaseConfiguration(env);
  if (configError) throw new Error(configError);

  if (!client) {
    const url = env.VITE_SUPABASE_URL as string;
    const anonKey = env.VITE_SUPABASE_ANON_KEY as string;
    client = createClient(url, anonKey);
  }

  return client;
}
