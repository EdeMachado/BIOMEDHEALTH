import { fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AreaLayout } from '@/app/layouts/AreaLayout';
import { UserDashboardPage } from '@/features/minha-biomed/UserDashboardPage';
import { UserActivitiesPage, UserJourneyPage, UserProfilePrivacyPage } from '@/features/minha-biomed/UserSupportPages';
import { AuthProvider } from '@/services/auth/AuthContext';

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
  beforeEach(() => {
    sessionStorage.clear();
    setDemoSession();
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

  it('conclui atividade mock em memória', async () => {
    renderUserArea('/minha-biomed/atividades');
    const completeButtons = await screen.findAllByRole('button', { name: 'Marcar como concluída' });
    fireEvent.click(completeButtons[0]);
    expect(await screen.findByText('Concluídas')).toBeInTheDocument();
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
