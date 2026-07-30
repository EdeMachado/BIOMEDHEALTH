import { fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AreaLayout } from '@/app/layouts/AreaLayout';
import { UserDashboardPage } from '@/features/minha-biomed/UserDashboardPage';
import { UserActivitiesPage, UserJourneyPage, UserProfilePrivacyPage } from '@/features/minha-biomed/UserSupportPages';
import { AuthProvider } from '@/services/auth/AuthContext';
import * as journeyService from '@/domains/journey/journeyService';

vi.mock('@/domains/journey/journeyService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/journey/journeyService')>();
  return {
    ...actual,
    registerJourneyActivityProgress: vi.fn(actual.registerJourneyActivityProgress),
  };
});

function setDemoSession() {
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: 'usr-1',
      nome: 'Ana Demo',
      email: 'usuario.demo@biomed.health',
      role: 'usuario',
      roles: ['usuario'],
      organizationId: 'org-1',
    })
  );
}

function renderUserArea(path = '/minha-biomed') {
  const router = createMemoryRouter(
    [
      {
        path: '/minha-biomed',
        element: <AreaLayout area="minha-biomed" title="Minha BioMed" />,
        children: [
          { index: true, element: <UserDashboardPage /> },
          { path: 'jornada', element: <UserJourneyPage /> },
          { path: 'atividades', element: <UserActivitiesPage /> },
          { path: 'perfil', element: <UserProfilePrivacyPage /> },
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

describe('refinamentos de UX nos ambientes', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    setDemoSession();
    const actual = await vi.importActual<typeof import('@/domains/journey/journeyService')>(
      '@/domains/journey/journeyService'
    );
    vi.mocked(journeyService.registerJourneyActivityProgress).mockImplementation(
      actual.registerJourneyActivityProgress
    );
  });

  it('destaca item ativo no menu lateral', async () => {
    renderUserArea('/minha-biomed/jornada');
    const activeLink = await screen.findByRole('link', { name: 'Jornada' });
    expect(activeLink.className).toContain('bg-[var(--primary)]');
  });

  it('avança avaliação inicial por etapas', async () => {
    renderUserArea('/minha-biomed');
    expect(await screen.findByText('Habitos e rotina')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Sono e recuperacao')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Movimento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Bem-estar percebido')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Revisao e consentimento')).toBeInTheDocument();
  });

  it('conclui atividade com persistencia no repository mock', async () => {
    renderUserArea('/minha-biomed/atividades');
    expect(
      await screen.findByRole('heading', { name: 'Pendentes e em andamento' })
    ).toBeInTheDocument();
    const completeButtons = await screen.findAllByRole('button', { name: 'Marcar como concluída' });
    fireEvent.click(completeButtons[0]);
    expect(await screen.findByRole('heading', { name: 'Concluídas' })).toBeInTheDocument();
    expect(screen.getByText('Progresso da atividade persistido com sucesso.')).toBeInTheDocument();
  });

  it('nao apresenta confirmacao falsa quando persistencia falha', async () => {
    vi.mocked(journeyService.registerJourneyActivityProgress).mockResolvedValue({
      ok: false,
      error: {
        code: 'TECHNICAL_ERROR',
        kind: 'technical',
        transient: true,
        message: 'falha simulada',
      },
    });
    renderUserArea('/minha-biomed/atividades');
    const completeButtons = await screen.findAllByRole('button', { name: 'Marcar como concluída' });
    fireEvent.click(completeButtons[0]);
    expect(
      await screen.findByText('Nao foi possivel persistir o progresso da jornada neste momento.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Progresso da atividade persistido com sucesso.')).not.toBeInTheDocument();
  });

  it('solicita confirmação ao revogar consentimento', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderUserArea('/minha-biomed/perfil');
    fireEvent.click(await screen.findByRole('button', { name: 'Aceitar documento vigente' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Revogar consentimento' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(await screen.findByText(/Consentimento revogado/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
