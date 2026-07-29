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
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AuditEvent[];
  } catch {
    return [];
  }
}

function writeEvents(events: AuditEvent[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-200)));
}

export function registerAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>) {
  const newEvent: AuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const events = readEvents();
  events.push(newEvent);
  writeEvents(events);
}

export function listAuditEvents(): AuditEvent[] {
  return readEvents().slice().reverse();
}
