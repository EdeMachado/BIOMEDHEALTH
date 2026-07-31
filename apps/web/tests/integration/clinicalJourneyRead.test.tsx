import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AreaLayout } from '@/app/layouts/AreaLayout';
import { ClinicalPortfolioPage } from '@/features/biomed-clinica/ClinicalPages';
import { AuthProvider } from '@/services/auth/AuthContext';
import { assignedPatientsByProfessional } from '@/services/repositories/demoData';
import { createMockJourneyRepository } from '@/services/repositories/journey/mockJourneyRepository';

function setClinicalSession(professionalId = 'pro-1') {
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: professionalId,
      nome: professionalId === 'pro-2' ? 'Carla Demo' : 'Dr. Demo',
      email:
        professionalId === 'pro-2'
          ? 'profissional.demo@biomed.health'
          : 'medico.demo@biomed.health',
      role: professionalId === 'pro-2' ? 'profissional_saude' : 'medico',
      roles: professionalId === 'pro-2' ? ['profissional_saude'] : ['medico'],
      organizationId: 'org-1',
    })
  );
}

async function seedTitularJourney() {
  const repository = createMockJourneyRepository();
  const created = await repository.createOrGetActiveUserJourney({
    context: {
      sessionUserId: 'usr-1',
      userId: 'usr-1',
      organizationId: 'org-1',
    },
    journeyVersionId: 'jv-org1-preventive-v1',
    status: 'ativo',
  });
  expect(created.ok).toBe(true);
}

function renderPortfolio() {
  const router = createMemoryRouter(
    [
      {
        path: '/clinica',
        element: <AreaLayout area="clinica" title="BioMed Clinica" />,
        children: [{ path: 'carteira', element: <ClinicalPortfolioPage /> }],
      },
    ],
    { initialEntries: ['/clinica/carteira'] }
  );
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('integracao clinica de jornada vinculada', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('profissional vinculado visualiza jornada seedada pelo fluxo do titular', async () => {
    await seedTitularJourney();
    setClinicalSession('pro-1');
    renderPortfolio();
    expect(await screen.findByTestId('clinical-portfolio-card-usr-1')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('clinical-journey-label-usr-1')).toHaveTextContent(
        /Bem-estar e Prevenção/
      );
    });
    expect(screen.queryByRole('button', { name: /Marcar como concluída/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Jornada Ativa Cardiovascular/i)).not.toBeInTheDocument();
  });

  it('paciente vinculado sem jornada mostra estado vazio autorizado', async () => {
    setClinicalSession('pro-1');
    renderPortfolio();
    expect(await screen.findByTestId('clinical-portfolio-card-usr-1')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('clinical-journey-label-usr-1')).toHaveTextContent(
        /Sem jornada registrada/
      );
    });
    expect(screen.queryByText(/\(Ativa\)/i)).not.toBeInTheDocument();
  });

  it('carteira mock lista apenas pacientes com vinculo coerente', async () => {
    setClinicalSession('pro-2');
    renderPortfolio();
    const expected = assignedPatientsByProfessional['pro-2'] ?? [];
    for (const patientId of expected) {
      expect(await screen.findByTestId(`clinical-portfolio-card-${patientId}`)).toBeInTheDocument();
    }
    await waitFor(() => {
      expect(screen.queryByText(/Acesso clinico nao autorizado/i)).not.toBeInTheDocument();
    });
  });

  it('profissional sem vinculo nao visualiza carteira do paciente', async () => {
    setClinicalSession('pro-unknown');
    renderPortfolio();
    await waitFor(() => {
      expect(screen.queryByText('Ana Demo')).not.toBeInTheDocument();
    });
  });
});
