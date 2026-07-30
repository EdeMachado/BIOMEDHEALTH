import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    context: { sessionUserId: 'usr-1', userId: 'usr-1', organizationId: 'org-1' },
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

describe('integracao da carteira clinica persistida', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('profissional autorizado carrega carteira coerente com assignments', async () => {
    setClinicalSession('pro-1');
    renderPortfolio();
    for (const patientId of assignedPatientsByProfessional['pro-1'] ?? []) {
      expect(await screen.findByTestId(`clinical-portfolio-card-${patientId}`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Jornada Ativa Cardiovascular/i)).not.toBeInTheDocument();
  });

  it('selecionar paciente autorizado carrega jornada seedada pelo titular', async () => {
    await seedTitularJourney();
    setClinicalSession('pro-1');
    renderPortfolio();
    await userEvent.click(await screen.findByTestId('clinical-portfolio-select-usr-1'));
    await waitFor(() => {
      expect(screen.getByTestId('clinical-journey-label-usr-1')).toHaveTextContent(
        /Bem-estar e Prevenção/
      );
    });
    expect(screen.queryByRole('button', { name: /Marcar como concluída/i })).not.toBeInTheDocument();
  });

  it('paciente autorizado sem jornada mostra vazio e troca limpa estado anterior', async () => {
    await seedTitularJourney();
    setClinicalSession('pro-1');
    renderPortfolio();
    await userEvent.click(await screen.findByTestId('clinical-portfolio-select-usr-1'));
    await waitFor(() => {
      expect(screen.getByTestId('clinical-journey-label-usr-1')).toHaveTextContent(/Ativa/);
    });
    await userEvent.click(screen.getByTestId('clinical-portfolio-select-usr-3'));
    await waitFor(() => {
      expect(screen.getByTestId('clinical-journey-label-usr-3')).toHaveTextContent(
        /Sem jornada registrada/
      );
    });
    expect(screen.queryByTestId('clinical-journey-label-usr-1')).not.toBeInTheDocument();
  });

  it('profissional sem vinculo recebe estado vazio ou negado sem listar Ana Demo', async () => {
    setClinicalSession('pro-unknown');
    renderPortfolio();
    await waitFor(() => {
      expect(screen.queryByTestId('clinical-portfolio-card-usr-1')).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId('clinical-patient-context-empty')).toHaveTextContent(
      'Nenhum paciente selecionado'
    );
    expect(screen.queryByText('Ana Demo')).not.toBeInTheDocument();
  });

  it('modo mock: header segue displayName da carteira e atualiza na troca', async () => {
    setClinicalSession('pro-1');
    renderPortfolio();
    expect(await screen.findByTestId('clinical-patient-context-name')).toHaveTextContent('Ana Demo');
    await userEvent.click(screen.getByTestId('clinical-portfolio-select-usr-3'));
    expect(screen.getByTestId('clinical-patient-context-name')).toHaveTextContent('Carlos Exemplo');
    expect(screen.getByTestId('clinical-patient-context-header')).not.toHaveTextContent(/Faixa etária/i);
    expect(screen.queryByText(/BM-CLI-001/i)).not.toBeInTheDocument();
  });
});
