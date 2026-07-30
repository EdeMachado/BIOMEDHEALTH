import { beforeEach, describe, expect, it } from 'vitest';
import { loadLinkedClinicalPortfolio } from '@/domains/clinicalPortfolio/clinicalPortfolioService';
import { assignedPatientsByProfessional } from '@/services/repositories/demoData';
import { createMockClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/mockClinicalPortfolioRepository';
import { createSupabaseClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/supabaseClinicalPortfolioRepository';
import type { ClinicalPortfolioContext } from '@/services/repositories/clinicalPortfolio/types';

function context(overrides: Partial<ClinicalPortfolioContext> = {}): ClinicalPortfolioContext {
  return {
    sessionUserId: 'pro-1',
    professionalUserId: 'pro-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('carteira clinica vinculada', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('lista somente pacientes com vinculo ativo do profissional na organizacao', async () => {
    const repository = createMockClinicalPortfolioRepository();
    const loaded = await loadLinkedClinicalPortfolio(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.map((item) => item.patientId).sort()).toEqual(
      [...(assignedPatientsByProfessional['pro-1'] ?? [])].sort()
    );
    expect(loaded.data.every((item) => item.assignmentStatus === 'ativo')).toBe(true);
    expect(loaded.data.every((item) => item.organizationId === 'org-1')).toBe(true);
  });

  it('ordena deterministicamente e nao muta storage em leituras consecutivas', async () => {
    const repository = createMockClinicalPortfolioRepository();
    const before = sessionStorage.length;
    const first = await repository.listLinkedClinicalPatients({ context: context() });
    const second = await repository.listLinkedClinicalPatients({ context: context() });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.map((item) => item.patientId)).toEqual(second.data.map((item) => item.patientId));
    expect(first.data.map((item) => item.displayName)).toEqual(
      [...first.data].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((item) => item.displayName)
    );
    expect(sessionStorage.length).toBe(before);
  });

  it('exclui vinculo inativo e cross-tenant; nega profissional desconhecido', async () => {
    const repository = createMockClinicalPortfolioRepository({
      seed: {
        clinicalAssignments: [
          {
            organizationId: 'org-1',
            professionalId: 'pro-1',
            userId: 'usr-1',
            status: 'inativo',
            assignmentReason: 'encerrado',
          },
          {
            organizationId: 'org-2',
            professionalId: 'pro-1',
            userId: 'usr-2',
            status: 'ativo',
            assignmentReason: 'outro-tenant',
          },
        ],
      },
    });

    const inactiveOnly = await loadLinkedClinicalPortfolio(repository, context());
    expect(inactiveOnly.ok).toBe(true);
    if (!inactiveOnly.ok) return;
    // org-1: vinculo inativo excluido; assignment de org-2 nao vaza na sessao org-1
    expect(inactiveOnly.data).toHaveLength(0);
    expect(inactiveOnly.data.find((item) => item.patientId === 'usr-2')).toBeUndefined();

    const denied = await loadLinkedClinicalPortfolio(
      createMockClinicalPortfolioRepository(),
      context({ sessionUserId: 'pro-unknown', professionalUserId: 'pro-unknown' })
    );
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('CLINICAL_ACCESS_DENIED');
  });

  it('repository supabase falha fechado sem fallback ficticio (fake client; nao prova RLS)', async () => {
    const client = {
      authUserId: 'pro-1' as string | null,
      canList: true as boolean,
      rows: [] as Array<Record<string, unknown>>,
      forcedError: null as { code?: string; message?: string } | null,
      auth: {
        getUser: () =>
          Promise.resolve({
            data: { user: client.authUserId ? { id: client.authUserId } : null },
            error: null,
          }),
      },
      rpc(fn: string) {
        if (client.forcedError) return Promise.resolve({ data: null, error: client.forcedError });
        if (fn === 'can_list_linked_clinical_portfolio') {
          return Promise.resolve({ data: client.canList, error: null });
        }
        if (fn === 'list_linked_clinical_patients') {
          return Promise.resolve({ data: client.rows, error: null });
        }
        return Promise.resolve({ data: null, error: { code: '42883', message: 'missing' } });
      },
    };

    const repository = createSupabaseClinicalPortfolioRepository({ client });
    const empty = await repository.listLinkedClinicalPatients({ context: context() });
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.data).toHaveLength(0);

    client.canList = false;
    const denied = await repository.listLinkedClinicalPatients({ context: context() });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('CLINICAL_ACCESS_DENIED');

    client.canList = true;
    client.forcedError = { code: '42501', message: 'denied' };
    const backend = await repository.listLinkedClinicalPatients({ context: context() });
    expect(backend.ok).toBe(false);

    client.forcedError = null;
    client.rows = [
      {
        patient_user_id: 'usr-1',
        organization_id: 'org-2',
        assignment_status: 'ativo',
        assignment_reason: 'x',
        display_name: 'Leak',
      },
    ];
    const filtered = await repository.listLinkedClinicalPatients({ context: context() });
    expect(filtered.ok).toBe(true);
    if (!filtered.ok) return;
    expect(filtered.data).toHaveLength(0);
  });
});
