import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from '@/services/auth/AuthContext';

function AuthHarness() {
  const { user, login, logout } = useAuth();

  return (
    <div>
      <p data-testid="usuario-logado">{user ? `${user.email}|${user.organizationId}|${user.role}` : 'anonimo'}</p>
      <button
        type="button"
        onClick={() =>
          login({
            email: 'usuario.demo@biomed.health',
            password: 'Demo@123',
            organizationId: 'org-1',
          })
        }
      >
        login-org1
      </button>
      <button
        type="button"
        onClick={() =>
          login({
            email: 'usuario.org2@biomed.health',
            password: 'Demo@123',
            organizationId: 'org-2',
          })
        }
      >
        login-org2
      </button>
      <button
        type="button"
        onClick={() =>
          login({
            email: 'usuario.org2@biomed.health',
            password: 'Demo@123',
            organizationId: 'org-1',
          })
        }
      >
        login-cruzado
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('autentica usuario e persiste sessao em sessionStorage', () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    expect(screen.getByTestId('usuario-logado').textContent).toContain('usuario.demo@biomed.health|org-1|usuario');

    const stored = sessionStorage.getItem('biomed_demo_session');
    expect(stored).toContain('usuario.demo@biomed.health');
  });

  it('permite troca de organizacao para outro usuario valido', () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    fireEvent.click(screen.getByRole('button', { name: 'login-org2' }));

    expect(screen.getByTestId('usuario-logado').textContent).toContain('usuario.org2@biomed.health|org-2|usuario');
  });

  it('bloqueia tentativa de acesso cruzado por organizacao e mantem sessao anonima', () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'login-cruzado' }));
    expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo');
  });

  it('logout encerra sessao e limpa armazenamento', () => {
    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo');
    expect(sessionStorage.getItem('biomed_demo_session')).toBeNull();
  });
});
