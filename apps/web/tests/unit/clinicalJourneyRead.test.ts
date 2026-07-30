import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadLinkedPatientJourneyViews,
  summarizeClinicalJourneyViews,
} from '@/domains/journey/journeyService';
import { assignedPatientsByProfessional } from '@/services/repositories/demoData';
import { createMockJourneyRepository } from '@/services/repositories/journey/mockJourneyRepository';
import type { ClinicalJourneyContext } from '@/services/repositories/journey/types';

const JOURNEY_STORAGE_KEY = 'biomed_mock_journey_runtime_v1';

function clinicalContext(
  overrides: Partial<ClinicalJourneyContext> = {}
): ClinicalJourneyContext {
  return {
    sessionUserId: 'pro-1',
    professionalUserId: 'pro-1',
    organizationId: 'org-1',
    patientUserId: 'usr-1',
    ...overrides,
  };
}

describe('leitura clinica vinculada de jornada', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('prioriza jornada ativa e ordena concluidas pela mais recente', async () => {
    const repository = createMockJourneyRepository({
      seed: {
        userJourneys: [
          {
            id: 'uj-old',
            organizationId: 'org-1',
            userId: 'usr-1',
            journeyVersionId: 'jv-org1-preventive-v1',
            startedAt: '2026-01-01T00:00:00.000Z',
            completedAt: '2026-02-01T00:00:00.000Z',
            status: 'concluida',
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
          },
          {
            id: 'uj-new-completed',
            organizationId: 'org-1',
            userId: 'usr-1',
            journeyVersionId: 'jv-org1-preventive-v1',
            startedAt: '2026-03-01T00:00:00.000Z',
            completedAt: '2026-04-01T00:00:00.000Z',
            status: 'concluida',
            version: 1,
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
          {
            id: 'uj-active',
            organizationId: 'org-1',
            userId: 'usr-1',
            journeyVersionId: 'jv-org1-preventive-v1',
            startedAt: '2026-05-01T00:00:00.000Z',
            completedAt: null,
            status: 'ativo',
            version: 1,
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        progress: [],
      },
    });

    const loaded = await loadLinkedPatientJourneyViews(repository, clinicalContext());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.map((item) => item.userJourney.id)).toEqual([
      'uj-active',
      'uj-new-completed',
      'uj-old',
    ]);
    const summary = summarizeClinicalJourneyViews(loaded.data);
    expect(summary.label).toContain('Ativa');
    expect(summary.primary?.userJourney.id).toBe('uj-active');
  });

  it('nao altera storage e retorna vazio autorizado em leituras consecutivas', async () => {
    const repository = createMockJourneyRepository({
      seed: {
        userJourneys: [],
        progress: [],
      },
    });
    const before = sessionStorage.getItem(JOURNEY_STORAGE_KEY);

    const first = await repository.listLinkedPatientJourneys({ context: clinicalContext() });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data).toHaveLength(0);
    expect(sessionStorage.getItem(JOURNEY_STORAGE_KEY)).toBe(before);

    const second = await repository.listLinkedPatientJourneys({ context: clinicalContext() });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data).toHaveLength(0);
    expect(sessionStorage.getItem(JOURNEY_STORAGE_KEY)).toBe(before);
    expect(summarizeClinicalJourneyViews(second.data).label).toBe('Sem jornada registrada');
  });

  it('nega vinculo ausente, inativo e cross-tenant sem escrita clinica', async () => {
    const repository = createMockJourneyRepository({
      seed: {
        clinicalAssignments: [
          {
            organizationId: 'org-1',
            professionalId: 'pro-1',
            userId: 'usr-1',
            status: 'inativo',
          },
        ],
      },
    });

    const inactive = await loadLinkedPatientJourneyViews(repository, clinicalContext());
    expect(inactive.ok).toBe(false);
    if (inactive.ok) return;
    expect(inactive.error.code).toBe('CLINICAL_ACCESS_DENIED');

    const crossTenant = await loadLinkedPatientJourneyViews(
      repository,
      clinicalContext({ organizationId: 'org-2' })
    );
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) {
      expect(crossTenant.error.code).toBe('CLINICAL_ACCESS_DENIED');
    }

    const unlinked = await loadLinkedPatientJourneyViews(
      createMockJourneyRepository(),
      clinicalContext({ patientUserId: 'usr-unknown' })
    );
    expect(unlinked.ok).toBe(false);
    if (!unlinked.ok) {
      expect(unlinked.error.code).toBe('CLINICAL_ACCESS_DENIED');
    }

    expect(typeof repository.listLinkedPatientJourneys).toBe('function');
    expect(typeof repository.upsertUserActivityProgress).toBe('function');
    expect(typeof repository.markUserJourneyCompletion).toBe('function');
  });

  it('alinha clinicalAssignments com assignedPatientsByProfessional no mock', async () => {
    const repository = createMockJourneyRepository();
    for (const patientUserId of assignedPatientsByProfessional['pro-2'] ?? []) {
      const loaded = await loadLinkedPatientJourneyViews(
        repository,
        clinicalContext({
          sessionUserId: 'pro-2',
          professionalUserId: 'pro-2',
          patientUserId,
        })
      );
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(Array.isArray(loaded.data)).toBe(true);
    }
  });
});
