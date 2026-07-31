import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicalCarePlanPage } from '@/features/biomed-clinica/ClinicalPages';
import { AuthProvider } from '@/services/auth/AuthContext';
import type { CarePlanBundle } from '@/services/repositories/carePlan/types';
import type { ClinicalPortfolioPatient } from '@/services/repositories/clinicalPortfolio/types';

const patients: ClinicalPortfolioPatient[] = [
  {
    patientId: 'usr-1',
    organizationId: 'org-1',
    displayName: 'Ana Demo',
    assignmentStatus: 'ativo',
    assignmentReason: 'acompanhamento',
  },
];

let openResult: { ok: true; data: CarePlanBundle | null } | { ok: false; error: { code: string } } = {
  ok: true,
  data: null,
};

const getOpenCarePlanMock = vi.fn(() => Promise.resolve(openResult));
const listCarePlansMock = vi.fn(() => Promise.resolve({ ok: true as const, data: [] }));
const createCarePlanMock = vi.fn(() => {
  openResult = {
    ok: true,
    data: {
      plan: {
        id: 'cp-1',
        organizationId: 'org-1',
        patientId: 'usr-1',
        professionalId: 'pro-1',
        title: 'Plano sono',
        generalObjective: 'Melhorar sono',
        planStatus: 'planejado',
        startsOn: '2026-07-31',
        targetDate: null,
        reassessmentDueOn: null,
        lastReassessedAt: null,
        clinicalNotes: '',
        version: 1,
        schemaVersion: 'care_plan.v1',
        clinicalRecordId: null,
        createdBy: 'pro-1',
        updatedBy: 'pro-1',
        closedAt: null,
        closedBy: null,
        suspensionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'ativo',
      },
      actions: [],
      events: [
        {
          id: 'cpe-1',
          carePlanId: 'cp-1',
          carePlanActionId: null,
          organizationId: 'org-1',
          patientId: 'usr-1',
          professionalId: 'pro-1',
          eventKind: 'create',
          eventCategory: 'structural',
          payload: {},
          note: null,
          versionBefore: null,
          versionAfter: 1,
          authoredBy: 'pro-1',
          createdAt: new Date().toISOString(),
        },
      ],
    },
  };
  return Promise.resolve({ ok: true as const, data: openResult.data!.plan });
});

vi.mock('@/services/repositories/clinicalPortfolio/factory', () => ({
  resolveClinicalPortfolioRepositoryMode: () => 'mock',
  createClinicalPortfolioRepositoryFactory: () => ({
    listLinkedClinicalPatients: () => Promise.resolve({ ok: true, data: patients }),
  }),
}));

vi.mock('@/services/repositories/carePlan/factory', () => ({
  resolveCarePlanRepositoryMode: () => 'mock',
  createCarePlanRepositoryFactory: () => ({
    getOpenCarePlan: () => getOpenCarePlanMock(),
    listCarePlans: () => listCarePlansMock(),
    createCarePlan: () => createCarePlanMock(),
    createCarePlanAction: () => Promise.resolve({ ok: false, error: { code: 'INVALID_INPUT' } }),
    updateCarePlanAction: () => Promise.resolve({ ok: false, error: { code: 'INVALID_INPUT' } }),
    closeCarePlan: () => Promise.resolve({ ok: false, error: { code: 'INVALID_INPUT' } }),
    addCarePlanNote: () => Promise.resolve({ ok: false, error: { code: 'INVALID_INPUT' } }),
    getCarePlanBundle: () => Promise.resolve({ ok: false, error: { code: 'NOT_FOUND' } }),
    updateCarePlan: () => Promise.resolve({ ok: false, error: { code: 'INVALID_INPUT' } }),
    listCarePlanEvents: () => Promise.resolve({ ok: true, data: [] }),
  }),
}));

function setClinicalSession() {
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: 'pro-1',
      nome: 'Dr. Demo',
      email: 'medico.demo@biomed.health',
      role: 'medico',
      roles: ['medico'],
      organizationId: 'org-1',
    })
  );
}

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <ClinicalCarePlanPage /> }], {
    initialEntries: ['/'],
  });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('ClinicalCarePlanPage integracao', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setClinicalSession();
    openResult = { ok: true, data: null };
    getOpenCarePlanMock.mockClear();
    createCarePlanMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('mostra painel de criacao e cria plano ativo', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByTestId('care-plan-validation-note')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('care-plan-create-panel')).toBeInTheDocument();
    });
    await user.clear(screen.getByTestId('care-plan-draft-objective'));
    await user.type(screen.getByTestId('care-plan-draft-objective'), 'Melhorar sono');
    await user.click(screen.getByTestId('care-plan-create'));
    await waitFor(() => {
      expect(createCarePlanMock).toHaveBeenCalled();
      expect(screen.getByTestId('care-plan-active-title')).toHaveTextContent('Plano sono');
      expect(screen.getByTestId('care-plan-history')).toBeInTheDocument();
    });
  });

  it('exibe erro de acesso clinico', async () => {
    openResult = { ok: false, error: { code: 'CLINICAL_ACCESS_DENIED' } };
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('care-plan-error')).toHaveTextContent(/nao autorizado/i);
    });
  });
});
