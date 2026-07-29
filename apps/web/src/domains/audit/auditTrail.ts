import { generateId } from '@/shared/lib/id';
import { readSessionItem, writeSessionItem } from '@/shared/lib/sessionStorage';

export type AuditEvent = {
  id: string;
  actorEmail: string;
  actorRole: string;
  organizationId: string;
  action: string;
  entity: string;
  result: 'sucesso' | 'falha' | 'negado';
  timestamp: string;
  reason?: string;
};

const STORAGE_KEY = 'biomed_demo_audit_events';

function readEvents(): AuditEvent[] {
  const raw = readSessionItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AuditEvent[];
  } catch {
    return [];
  }
}

function writeEvents(events: AuditEvent[]) {
  writeSessionItem(STORAGE_KEY, JSON.stringify(events.slice(-200)));
}

export function registerAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>) {
  try {
    const newEvent: AuditEvent = {
      ...event,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    const events = readEvents();
    events.push(newEvent);
    writeEvents(events);
  } catch (error) {
    console.error('[audit] Falha ao registrar evento de auditoria', error);
  }
}

export function listAuditEvents(): AuditEvent[] {
  return readEvents().slice().reverse();
}
