import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AreaLayout } from '@/app/layouts/AreaLayout';
import { ClinicalOverviewPage, ClinicalPortfolioPage } from '@/features/biomed-clinica/ClinicalPages';
import { AuthProvider } from '@/services/auth/AuthContext';
import type { ClinicalPortfolioPatient } from '@/services/repositories/clinicalPortfolio/types';

type PortfolioResult =
  | { ok: true; data: ClinicalPortfolioPatient[] }
  | { ok: false; error: { code: string } };

type PendingLoad = {
  resolve: (result: PortfolioResult) => void;
};

let portfolioResult: PortfolioResult = { ok: true, data: [] };
let usePendingLoads = false;
const pendingLoads: PendingLoad[] = [];

const listLinkedClinicalPatientsMock = vi.fn(async () => {
  if (usePendingLoads) {
    return new Promise<PortfolioResult>((resolve) => {
      pendingLoads.push({ resolve });
    });
  }
  return portfolioResult;
});

vi.mock('@/services/repositories/clinicalPortfolio/factory', () => ({
  resolveClinicalPortfolioRepositoryMode: () => 'supabase',
  createClinicalPortfolioRepositoryFactory: () => ({
    listLinkedClinicalPatients: () => listLinkedClinicalPatientsMock(),
  }),
}));

vi.mock('@/services/repositories/journey/factory', () => ({
  resolveJourneyRepositoryMode: () => 'mock',
  createJourneyRepositoryFactory: () => ({
    listLinkedPatientJourneys: () => Promise.resolve({ ok: true, data: [] }),
    listUserJourneysForClinicalRead: () => Promise.resolve({ ok: true, data: [] }),
    listUserJourneyProgressForClinicalRead: () => Promise.resolve({ ok: true, data: [] }),
    createOrGetActiveUserJourney: () =>
      Promise.resolve({ ok: false, error: { code: 'CLINICAL_ACCESS_DENIED' } }),
    registerActivityProgress: () =>
      Promise.resolve({ ok: false, error: { code: 'CLINICAL_ACCESS_DENIED' } }),
    completeUserJourney: () =>
      Promise.resolve({ ok: false, error: { code: 'CLINICAL_ACCESS_DENIED' } }),
  }),
}));

vi.mock('@/services/api/supabaseClient', () => ({
  getSupabaseClient: () => ({}),
  validateSupabaseConfiguration: () => null,
}));

function patient(
  overrides: Partial<ClinicalPortfolioPatient> &
    Pick<ClinicalPortfolioPatient, 'patientId' | 'displayName'>
): ClinicalPortfolioPatient {
  return {
    organizationId: 'org-1',
    assignmentStatus: 'ativo',
    assignmentReason: 'acompanhamento',
    ...overrides,
  };
}

function setClinicalSession() {
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: 'pro-1',
      nome: 'Dr. Persistido',
      email: 'medico.demo@biomed.health',
      role: 'medico',
      roles: ['medico'],
      organizationId: 'org-1',
    })
  );
}

function renderAt(path: '/clinica' | '/clinica/carteira') {
  const router = createMemoryRouter(
    [
      {
        path: '/clinica',
        element: <AreaLayout area="clinica" title="BioMed Clinica" />,
        children: [
          { index: true, element: <ClinicalOverviewPage /> },
          { path: 'carteira', element: <ClinicalPortfolioPage /> },
        ],
      },
    ],
    { initialEntries: [path] }
  );
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('header clinico da carteira no modo Supabase', () => {
  beforeEach(() => {
    sessionStorage.clear();
    portfolioResult = { ok: true, data: [] };
    usePendingLoads = false;
    pendingLoads.length = 0;
    listLinkedClinicalPatientsMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('paciente real na carteira → header igual ao displayName retornado', async () => {
    setClinicalSession();
    portfolioResult = {
      ok: true,
      data: [
        patient({ patientId: 'usr-persist-1', displayName: 'Paciente Persistido Alpha' }),
        patient({ patientId: 'usr-persist-2', displayName: 'Paciente Persistido Beta' }),
      ],
    };
    renderAt('/clinica/carteira');

    expect(await screen.findByTestId('clinical-patient-context-name')).toHaveTextContent(
      'Paciente Persistido Alpha'
    );
    const header = screen.getByTestId('clinical-patient-context-header');
    expect(header).not.toHaveTextContent('Ana Demo');
    expect(header).not.toHaveTextContent(/Faixa etária/i);
    expect(header).not.toHaveTextContent(/BM-CLI-001/i);
    expect(header).not.toHaveTextContent(/Dados fictícios/i);
  });

  it('header nao contem Ana Demo no modo Supabase', async () => {
    setClinicalSession();
    portfolioResult = {
      ok: true,
      data: [patient({ patientId: 'usr-persist-1', displayName: 'Maria Persistida' })],
    };
    renderAt('/clinica/carteira');
    await screen.findByTestId('clinical-patient-context-name');
    expect(screen.getByTestId('clinical-patient-context-header')).not.toHaveTextContent('Ana Demo');
    expect(screen.getByTestId('clinical-portfolio-card-usr-persist-1')).toBeInTheDocument();
  });

  it('overview com dados persistidos tambem evita Ana Demo no header', async () => {
    setClinicalSession();
    portfolioResult = {
      ok: true,
      data: [patient({ patientId: 'usr-persist-1', displayName: 'Overview Persistido' })],
    };
    renderAt('/clinica');
    const header = await screen.findByTestId('clinical-patient-context-header');
    expect(screen.getByTestId('clinical-patient-context-name')).toHaveTextContent(
      'Overview Persistido'
    );
    expect(header).not.toHaveTextContent('Ana Demo');
  });

  it('nenhum paciente selecionado → estado neutro', async () => {
    setClinicalSession();
    portfolioResult = { ok: true, data: [] };
    renderAt('/clinica/carteira');
    expect(await screen.findByTestId('clinical-patient-context-empty')).toHaveTextContent(
      'Nenhum paciente selecionado'
    );
    expect(screen.queryByTestId('clinical-patient-context-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('clinical-patient-context-header')).not.toHaveTextContent('Ana Demo');
  });

  it('carteira autorizada vazia mostra estado sem vinculos (nao busca)', async () => {
    setClinicalSession();
    portfolioResult = { ok: true, data: [] };
    renderAt('/clinica/carteira');
    expect(await screen.findByTestId('clinical-portfolio-empty')).toHaveTextContent(
      'Nenhum paciente vinculado para acompanhamento.'
    );
    expect(screen.queryByTestId('clinical-portfolio-search-empty')).not.toBeInTheDocument();
  });

  it('troca de paciente atualiza imediatamente o header', async () => {
    setClinicalSession();
    portfolioResult = {
      ok: true,
      data: [
        patient({ patientId: 'usr-a', displayName: 'Alpha Persistido' }),
        patient({ patientId: 'usr-b', displayName: 'Beta Persistido' }),
      ],
    };
    renderAt('/clinica/carteira');
    expect(await screen.findByTestId('clinical-patient-context-name')).toHaveTextContent(
      'Alpha Persistido'
    );
    await userEvent.click(screen.getByTestId('clinical-portfolio-select-usr-b'));
    expect(screen.getByTestId('clinical-patient-context-name')).toHaveTextContent('Beta Persistido');
    expect(screen.getByTestId('clinical-patient-context-header')).not.toHaveTextContent(
      'Alpha Persistido'
    );
  });

  it('resposta assincrona atrasada nao restaura identificacao anterior', async () => {
    setClinicalSession();
    usePendingLoads = true;

    renderAt('/clinica/carteira');
    expect(await screen.findByTestId('clinical-patient-context-empty')).toBeInTheDocument();
    await waitFor(() => {
      expect(pendingLoads.length).toBeGreaterThanOrEqual(1);
    });

    const stale = pendingLoads[0];
    const latest = pendingLoads[pendingLoads.length - 1];

    stale.resolve({
      ok: true,
      data: [patient({ patientId: 'usr-stale', displayName: 'Paciente Obsoleto' })],
    });
    await waitFor(() => {
      expect(screen.queryByText('Paciente Obsoleto')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('clinical-patient-context-empty')).toBeInTheDocument();

    latest.resolve({
      ok: true,
      data: [patient({ patientId: 'usr-new', displayName: 'Paciente Atual' })],
    });
    // Resolve quaisquer pendencias extras do Strict Mode com o mesmo payload atual.
    for (const pending of pendingLoads.slice(1, -1)) {
      pending.resolve({
        ok: true,
        data: [patient({ patientId: 'usr-new', displayName: 'Paciente Atual' })],
      });
    }

    expect(await screen.findByTestId('clinical-patient-context-name')).toHaveTextContent(
      'Paciente Atual'
    );
    expect(screen.queryByText('Paciente Obsoleto')).not.toBeInTheDocument();
    expect(screen.getByTestId('clinical-patient-context-header')).not.toHaveTextContent('Ana Demo');
  });

  it('paciente removido da carteira nao permanece no header', async () => {
    setClinicalSession();
    portfolioResult = {
      ok: true,
      data: [patient({ patientId: 'usr-keep', displayName: 'Paciente Removivel' })],
    };
    renderAt('/clinica/carteira');
    expect(await screen.findByTestId('clinical-patient-context-name')).toHaveTextContent(
      'Paciente Removivel'
    );

    cleanup();
    setClinicalSession();
    portfolioResult = { ok: true, data: [] };
    renderAt('/clinica/carteira');

    expect(await screen.findByTestId('clinical-patient-context-empty')).toBeInTheDocument();
    expect(screen.queryByText('Paciente Removivel')).not.toBeInTheDocument();
    expect(screen.getByTestId('clinical-patient-context-header')).not.toHaveTextContent('Ana Demo');
  });
});
