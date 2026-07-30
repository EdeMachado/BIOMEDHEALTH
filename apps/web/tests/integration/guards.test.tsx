import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { listAuditEvents } from '@/domains/audit/auditTrail';
import { RequireAuth, RequireRole } from '@/app/routes/guards';
import { AuthProvider } from '@/services/auth/AuthContext';
import { demoUsers } from '@/services/repositories/demoData';

function setDemoSession(role: 'usuario' | 'medico' | 'gestor_institucional') {
  const source = demoUsers.find((user) => user.role === role && user.organizationId === 'org-1');
  if (!source) throw new Error(`Usuário demo não encontrado para role=${role}`);
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: source.id,
      nome: source.nome,
      email: source.email,
      role,
      roles: [role],
      organizationId: 'org-1',
    })
  );
}

function setDemoSessionWithMultipleRoles(roles: Array<'usuario' | 'medico' | 'gestor_institucional'>) {
  const baseUser = demoUsers.find((user) => user.role === roles[0] && user.organizationId === 'org-1');
  if (!baseUser) throw new Error(`Usuário demo não encontrado para role=${roles[0]}`);
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: baseUser.id,
      nome: baseUser.nome,
      email: baseUser.email,
      role: roles[0],
      roles,
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

  it('reconhece permissao cumulativa quando usuario possui multiplos papeis ativos', async () => {
    const router = createMemoryRouter(
      [
        { path: '/login', element: <h1>Tela Login</h1> },
        { path: '/acesso-negado', element: <h1>Acesso negado</h1> },
        {
          element: <RequireAuth />,
          children: [
            {
              element: <RequireRole allow={['medico']} />,
              children: [{ path: '/clinica-only', element: <h1>Area Clinica</h1> }],
            },
          ],
        },
      ],
      { initialEntries: ['/clinica-only'] }
    );

    setDemoSessionWithMultipleRoles(['medico', 'usuario']);
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Area Clinica' })).toBeInTheDocument();
  });
});
