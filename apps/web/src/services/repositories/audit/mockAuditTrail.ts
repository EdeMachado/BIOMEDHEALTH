import { generateId } from '@/shared/lib/id';
import { readSessionItem, writeSessionItem } from '@/shared/lib/sessionStorage';
import type { AuditEvent } from '@/domains/audit/types';
import type { AuditRegisterInput, AuditTrail } from './types';

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

/**
 * Demo/mock audit trail. sessionStorage is used only when bootstrap
 * intentionally selected mock mode — never as a silent Supabase fallback.
 */
export function createMockAuditTrail(): AuditTrail {
  return {
    mode: 'mock',
    register(event) {
      const newEvent: AuditEvent = {
        ...event,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };
      const events = readEvents();
      events.push(newEvent);
      writeEvents(events);
    },
    listSync() {
      return readEvents().slice().reverse();
    },
    list() {
      return Promise.resolve(readEvents().slice().reverse());
    },
  };
}

export function createMemoryAuditTrail(seed: AuditEvent[] = []): AuditTrail {
  const events = [...seed];
  return {
    mode: 'mock',
    register(event: AuditRegisterInput) {
      events.push({
        ...event,
        id: generateId(),
        timestamp: new Date().toISOString(),
      });
    },
    listSync() {
      return events.slice().reverse();
    },
    list() {
      return Promise.resolve(events.slice().reverse());
    },
  };
}
