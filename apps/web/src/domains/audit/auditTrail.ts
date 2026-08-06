import { bootstrapAuditTrail } from '@/application/audit';
import type { AuditEvent } from '@/domains/audit/types';
import type { AuditTrail } from '@/services/repositories/audit';

export type { AuditEvent } from '@/domains/audit/types';

let activeTrail: AuditTrail | null = null;
let bootstrapError: string | null = null;

function ensureTrail(): AuditTrail | null {
  if (activeTrail) return activeTrail;
  const bootstrap = bootstrapAuditTrail({ env: import.meta.env });
  if (!bootstrap.ok) {
    bootstrapError = bootstrap.message;
    console.error('[audit]', bootstrap.message);
    return null;
  }
  activeTrail = bootstrap.trail;
  bootstrapError = null;
  return activeTrail;
}

/** Test/app hook to inject a trail without relying on env bootstrap. */
export function configureAuditTrail(trail: AuditTrail | null) {
  activeTrail = trail;
  bootstrapError = null;
}

export function getAuditBootstrapError(): string | null {
  return bootstrapError;
}

export function registerAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>) {
  try {
    const trail = ensureTrail();
    if (!trail) return;
    trail.register(event);
  } catch (error) {
    console.error('[audit] Falha ao registrar evento de auditoria', error);
  }
}

/**
 * Awaitable register for audit-required mutations (fail-closed).
 * Returns ok:false when bootstrap/RPC fails — never falls back to mock silently.
 */
export async function registerAuditEventAsync(
  event: Omit<AuditEvent, 'id' | 'timestamp'>
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const trail = ensureTrail();
    if (!trail) {
      return { ok: false, message: bootstrapError ?? 'Auditoria indisponivel.' };
    }
    return trail.registerAsync(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao registrar auditoria.';
    console.error('[audit] Falha ao registrar evento de auditoria', error);
    return { ok: false, message };
  }
}

/**
 * Sync list for mock/demo and tests. Supabase mode returns [] — use listAuditEventsAsync.
 */
export function listAuditEvents(): AuditEvent[] {
  try {
    const trail = ensureTrail();
    if (!trail) return [];
    return trail.listSync();
  } catch {
    return [];
  }
}

export async function listAuditEventsAsync(): Promise<AuditEvent[]> {
  const trail = ensureTrail();
  if (!trail) {
    throw new Error(bootstrapError ?? 'Auditoria indisponivel.');
  }
  return trail.list();
}
