import { createMockAuditTrail } from './mockAuditTrail';
import { createSupabaseAuditTrail } from './supabaseAuditTrail';
import type { AuditTrail, SupabaseAuditClient } from './types';

export type AuditTrailMode = 'mock' | 'supabase';

export type AuditModeEnvironment = {
  VITE_ENABLE_SUPABASE_AUTH?: string;
  VITE_AUDIT_TRAIL_MODE?: string;
};

export const AUDIT_TRAIL_MODE_ENV_KEY = 'VITE_AUDIT_TRAIL_MODE';

function resolveInheritedGlobalMode(env: AuditModeEnvironment): AuditTrailMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function resolveAuditTrailMode(env: AuditModeEnvironment): AuditTrailMode {
  const specific = env.VITE_AUDIT_TRAIL_MODE;
  if (specific === undefined) return resolveInheritedGlobalMode(env);
  if (specific === 'mock' || specific === 'supabase') return specific;
  throw new Error(`Valor invalido para ${AUDIT_TRAIL_MODE_ENV_KEY}: "${specific}"`);
}

export function createAuditTrailFactory(input: {
  mode: AuditTrailMode;
  supabaseClient?: SupabaseAuditClient | null;
}): AuditTrail {
  if (input.mode === 'mock') return createMockAuditTrail();
  if (!input.supabaseClient) {
    throw new Error('Modo Supabase exige client de auditoria por injecao.');
  }
  return createSupabaseAuditTrail(input.supabaseClient);
}

export type { AuditTrail, AuditRegisterInput, SupabaseAuditClient } from './types';
