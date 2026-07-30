import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadJourneyRuntimeSnapshot,
  registerJourneyActivityProgress,
} from '@/domains/journey/journeyService';
import { createMockJourneyRepository } from '@/services/repositories/journey/mockJourneyRepository';
import type { JourneyContext, JourneyVersion } from '@/services/repositories/journey/types';

function context(overrides: Partial<JourneyContext> = {}): JourneyContext {
  return {
    sessionUserId: 'usr-1',
    userId: 'usr-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('journeyService', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('resolve versao ativa e cria jornada em andamento', async () => {
    const repository = createMockJourneyRepository();
    const loaded = await loadJourneyRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || !loaded.data) return;
    expect(loaded.data.userJourney.status).toBe('ativo');
    expect(loaded.data.catalog.version.id).toBe('jv-org1-preventive-v1');
  });

  it('retoma jornada existente e preserva versao historica mesmo com nova versao ativa', async () => {
    const repository = createMockJourneyRepository({
      seed: {
        versions: [
          version('v1', 'ativo', 1),
          version('v2', 'futuro', 2),
        ],
      },
    });
    const first = await loadJourneyRuntimeSnapshot(repository, context());
    expect(first.ok).toBe(true);
    if (!first.ok || !first.data) return;
    expect(first.data.catalog.version.id).toBe('v1');

    const withNewOperational = createMockJourneyRepository({
      seed: {
        versions: [
          version('v1', 'ativo', 1),
          version('v2', 'ativo', 2),
        ],
      },
    });
    const resumed = await loadJourneyRuntimeSnapshot(withNewOperational, context());
    expect(resumed.ok).toBe(true);
    if (!resumed.ok || !resumed.data) return;
    expect(resumed.data.userJourney.journeyVersionId).toBe('v1');
  });

  it('registra progresso com idempotencia sem duplicar atividade', async () => {
    const repository = createMockJourneyRepository();
    const loaded = await loadJourneyRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || !loaded.data) return;

    const first = await registerJourneyActivityProgress(
      repository,
      context(),
      loaded.data,
      { activityId: loaded.data.activities[0].id, intent: 'register_today' }
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await registerJourneyActivityProgress(
      repository,
      context(),
      first.data,
      { activityId: loaded.data.activities[0].id, intent: 'register_today' }
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.data.progress).toHaveLength(1);
    expect(second.data.activities[0].progresso).toBe(40);
  });

  it('conclui atividade e bloqueia escrita apos encerramento da jornada', async () => {
    const repository = createMockJourneyRepository();
    const loaded = await loadJourneyRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || !loaded.data) return;

    let runtime = loaded.data;
    for (const activity of loaded.data.activities) {
      const updated = await registerJourneyActivityProgress(repository, context(), runtime, {
        activityId: activity.id,
        intent: 'complete',
      });
      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      runtime = updated.data;
    }

    expect(runtime.completed).toBe(true);
    const blocked = await registerJourneyActivityProgress(repository, context(), runtime, {
      activityId: loaded.data.activities[0].id,
      intent: 'register_today',
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error.code).toBe('USER_JOURNEY_COMPLETED');
  });

  it('nega contexto cross-user e tenant divergente', async () => {
    const repository = createMockJourneyRepository();
    const crossUser = await loadJourneyRuntimeSnapshot(
      repository,
      context({ sessionUserId: 'usr-1', userId: 'usr-2' })
    );
    expect(crossUser.ok).toBe(false);
    if (crossUser.ok) return;
    expect(crossUser.error.code).toBe('IDENTITY_MISMATCH');

    const crossTenant = await loadJourneyRuntimeSnapshot(
      repository,
      context({ organizationId: 'org-2' })
    );
    expect(crossTenant.ok).toBe(true);
    if (!crossTenant.ok) return;
    expect(crossTenant.data).toBeNull();
  });
});

function version(id: string, status: string, schemaVersion: number): JourneyVersion {
  return {
    id,
    organizationId: 'org-1',
    journeyId: 'hj-org1-preventive',
    code: `journey-${id}`,
    status,
    version: schemaVersion,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}
