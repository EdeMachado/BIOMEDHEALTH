import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Environment = {
  VITE_ENABLE_SUPABASE_AUTH?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

let client: SupabaseClient | null = null;

export function getSupabaseClient(env: Environment = import.meta.env): SupabaseClient | null {
  const enabled = env.VITE_ENABLE_SUPABASE_AUTH === 'true';
  if (!enabled) return null;

  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Supabase habilitado sem credenciais configuradas.');
  }

  if (!client) {
    client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  }

  return client;
}
