import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureAuditTrail,
  listAuditEvents,
  registerAuditEvent,
} from '@/domains/audit/auditTrail';

describe('auditTrail', () => {
  beforeEach(() => {
    sessionStorage.clear();
    configureAuditTrail(null);
  });

  it('registra e lista eventos em ordem inversa no modo mock', () => {
    registerAuditEvent({
      actorEmail: 'usuario.demo@biomed.health',
      actorRole: 'usuario',
      organizationId: 'org-1',
      action: 'login',
      entity: 'auth',
      result: 'sucesso',
    });
    registerAuditEvent({
      actorEmail: 'usuario.demo@biomed.health',
      actorRole: 'usuario',
      organizationId: 'org-1',
      action: 'logout',
      entity: 'auth',
      result: 'sucesso',
    });

    const events = listAuditEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.action).toBe('logout');
    expect(events[1]?.action).toBe('login');
  });
});
