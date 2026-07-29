import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { listAuditEvents } from '@/domains/audit/auditTrail';
import { RequireAuth, RequireRole } from '@/app/routes/guards';
import { AuthProvider } from '@/services/auth/AuthContext';

function setDemoSession(role: 'usuario' | 'medico' | 'gestor_institucional') {
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: 'demo-user',
      nome: 'Demo',
      email: 'demo@biomed.health',
      role,
      organizationId: 'org-1',
    })
  );
}

function renderRouter(initialEntry: string) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <h1>Tela Login</h1> },
      { path: '/acesso-negado', element: <h1>Acesso negado</h1> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/area-segura', element: <h1>Area Segura</h1> },
          {
            element: <RequireRole allow={['usuario']} />,
            children: [{ path: '/usuario-only', element: <h1>Area Usuario</h1> }],
          },
        ],
      },
    ],
    { initialEntries: [initialEntry] }
  );

  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('guards de autorizacao e roteamento protegido', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('redireciona usuario sem sessao para login', async () => {
    renderRouter('/area-segura');
    expect(await screen.findByRole('heading', { name: 'Tela Login' })).toBeInTheDocument();
  });

  it('permite acesso quando sessao valida', async () => {
    setDemoSession('usuario');
    renderRouter('/area-segura');
    expect(await screen.findByRole('heading', { name: 'Area Segura' })).toBeInTheDocument();
  });

  it('bloqueia perfil sem permissao e registra auditoria de negacao', async () => {
    setDemoSession('medico');
    renderRouter('/usuario-only');
    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument();

    const events = listAuditEvents();
    expect(events[0]?.action).toBe('rota_negada');
    expect(events[0]?.result).toBe('negado');
  });

  it('permite perfil autorizado em rota protegida', async () => {
    setDemoSession('usuario');
    renderRouter('/usuario-only');
    expect(await screen.findByRole('heading', { name: 'Area Usuario' })).toBeInTheDocument();
  });
});
