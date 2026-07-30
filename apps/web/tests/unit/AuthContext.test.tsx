import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/services/auth/AuthContext';
import type { AccessContext, AccessErrorCode, AccessIdentity, AccessResult } from '@/services/repositories/access/types';

type AccessMode = 'mock' | 'supabase';

type FakeSupabaseClient = {
  auth: {
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
  };
};

const resolveAccessContextMock = vi.fn<
  (identity: AccessIdentity) => Promise<AccessResult<AccessContext>>
>();

let mockedMode: AccessMode = 'mock';
let mockedModeError: Error | null = null;
let mockedConfigError: string | null = null;
let mockedSupabaseClient: FakeSupabaseClient | null = null;

vi.mock('@/services/repositories/access/factory', () => {
  return {
    resolveAccessRepositoryMode: () => {
      if (mockedModeError) throw mockedModeError;
      return mockedMode;
    },
    resolveRuntimeEnvironment: () => 'non-production',
    createAccessContextRepositoryFactory: () => ({
      resolveAccessContext: resolveAccessContextMock,
    }),
  };
});

vi.mock('@/services/api/supabaseClient', () => {
  return {
    isSupabaseAuthEnabled: () => mockedMode === 'supabase',
    validateSupabaseConfiguration: () => mockedConfigError,
    getSupabaseClient: () => mockedSupabaseClient,
  };
});

function AuthHarness() {
  const { user, login, logout } = useAuth();
  const [lastResult, setLastResult] = useState<string>('idle');

  return (
    <div>
      <p data-testid="usuario-logado">{user ? `${user.id}|${user.email}|${user.organizationId}|${user.role}|${user.roles.join(',')}` : 'anonimo'}</p>
      <p data-testid="resultado-login">{lastResult}</p>
      <button
        type="button"
        onClick={() => {
          void login({
            email: 'usuario.demo@biomed.health',
            password: 'Demo@123',
            organizationId: 'org-1',
          }).then((result) => setLastResult(result.ok ? `ok:${result.redirectTo}` : `erro:${result.message}`));
        }}
      >
        login-org1
      </button>
      <button
        type="button"
        onClick={() => {
          void login({
            email: 'usuario.org2@biomed.health',
            password: 'Demo@123',
            organizationId: 'org-2',
          }).then((result) => setLastResult(result.ok ? `ok:${result.redirectTo}` : `erro:${result.message}`));
        }}
      >
        login-org2
      </button>
      <button
        type="button"
        onClick={() => {
          void login({
            email: 'usuario.org2@biomed.health',
            password: 'Demo@123',
            organizationId: 'org-1',
          }).then((result) => setLastResult(result.ok ? `ok:${result.redirectTo}` : `erro:${result.message}`));
        }}
      >
        login-cruzado
      </button>
      <button
        type="button"
        onClick={() => {
          void login({
            email: 'usuario.supabase@biomed.health',
            password: 'Demo@123',
            organizationId: 'org-1',
          }).then((result) => setLastResult(result.ok ? `ok:${result.redirectTo}` : `erro:${result.message}`));
        }}
      >
        login-supabase
      </button>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
      >
        logout
      </button>
    </div>
  );
}

function baseAccessContext(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    identity: {
      sessionUserId: 'usr-1',
      userId: 'usr-1',
      organizationId: 'org-1',
      selectedUnitId: null,
    },
    organization: {
      id: 'org-1',
      nome: 'Org 1',
      status: 'active',
    },
    membership: {
      id: 'm-1',
      userId: 'usr-1',
      organizationId: 'org-1',
      status: 'active',
    },
    roleBindings: [{ membershipId: 'm-1', role: 'usuario', unitId: null, status: 'active' }],
    roles: ['usuario'],
    effectiveRole: 'usuario',
    unitScopes: [],
    ...overrides,
  };
}

function accessErrorResult(code: AccessErrorCode): AccessResult<AccessContext> {
  return {
    ok: false,
    error: {
      code,
      kind: code === 'TRANSIENT_BACKEND_ERROR' || code === 'UNEXPECTED_BACKEND_ERROR' ? 'technical' : 'authorization',
      transient: code === 'TRANSIENT_BACKEND_ERROR',
      message: code,
    },
  };
}

function createSupabaseClient(): FakeSupabaseClient {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'usr-1',
            email: 'usuario.supabase@biomed.health',
            user_metadata: { nome: 'Usuário Supabase' },
          },
        },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };
}

function renderHarness() {
  return render(
    <AuthProvider>
      <AuthHarness />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockedMode = 'mock';
    mockedModeError = null;
    mockedConfigError = null;
    mockedSupabaseClient = createSupabaseClient();
    resolveAccessContextMock.mockReset();
    resolveAccessContextMock.mockResolvedValue({ ok: true, data: baseAccessContext() });
    sessionStorage.clear();
  });

  it('1) login mock válido', async () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() =>
      expect(screen.getByTestId('usuario-logado').textContent).toContain(
        'usr-1|usuario.demo@biomed.health|org-1|usuario|usuario'
      )
    );
    expect(screen.getByTestId('resultado-login').textContent).toContain('ok:/minha-biomed');
  });

  it('2) login Supabase válido', async () => {
    mockedMode = 'supabase';
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-supabase' }));
    await waitFor(() =>
      expect(screen.getByTestId('usuario-logado').textContent).toContain(
        'usr-1|usuario.supabase@biomed.health|org-1|usuario|usuario'
      )
    );
  });

  it('3,4,5) preserva roles cumulativos e effectiveRole sem eliminar papéis', async () => {
    resolveAccessContextMock.mockResolvedValue({
      ok: true,
      data: baseAccessContext({
        roleBindings: [
          { membershipId: 'm-1', role: 'usuario', unitId: null, status: 'active' },
          { membershipId: 'm-1', role: 'medico', unitId: null, status: 'active' },
        ],
        roles: ['usuario', 'medico'],
        effectiveRole: 'medico',
      }),
    });

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() =>
      expect(screen.getByTestId('usuario-logado').textContent).toContain(
        'usuario.demo@biomed.health|org-1|medico|usuario,medico'
      )
    );
  });

  it('6-16,17) falhas de acesso não criam SessionUser parcial', async () => {
    const scenarios: AccessErrorCode[] = [
      'NO_SESSION',
      'IDENTITY_MISMATCH',
      'ORGANIZATION_NOT_FOUND',
      'ORGANIZATION_INACTIVE',
      'NO_ACTIVE_MEMBERSHIP',
      'MEMBERSHIP_INACTIVE',
      'NO_ACTIVE_ROLES',
      'UNIT_SCOPE_INCOMPATIBLE',
      'CROSS_TENANT_DATA',
      'TRANSIENT_BACKEND_ERROR',
      'UNEXPECTED_BACKEND_ERROR',
    ];

    for (const errorCode of scenarios) {
      resolveAccessContextMock.mockResolvedValueOnce(accessErrorResult(errorCode));
      const view = renderHarness();
      fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
      await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo'));
      view.unmount();
      sessionStorage.clear();
    }
  });

  it('18) logout limpa contexto e sessionStorage', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toContain('usuario.demo@biomed.health'));
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo'));
    expect(sessionStorage.getItem('biomed_demo_session')).toBeNull();
    expect(sessionStorage.getItem('biomed_supabase_org_selection')).toBeNull();
  });

  it('19) login A, logout e login B não reutiliza contexto de A', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toContain('usuario.demo@biomed.health'));
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo'));

    resolveAccessContextMock.mockResolvedValueOnce({
      ok: true,
      data: baseAccessContext({
        identity: { sessionUserId: 'usr-8', userId: 'usr-8', organizationId: 'org-2', selectedUnitId: null },
        membership: { id: 'm-8', userId: 'usr-8', organizationId: 'org-2', status: 'active' },
        organization: { id: 'org-2', nome: 'Org 2', status: 'active' },
        roles: ['usuario'],
        effectiveRole: 'usuario',
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'login-org2' }));
    await waitFor(() =>
      expect(screen.getByTestId('usuario-logado').textContent).toContain('usuario.org2@biomed.health|org-2|usuario')
    );
  });

  it('20) troca de organização invalida contexto anterior', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toContain('|org-1|'));

    resolveAccessContextMock.mockResolvedValueOnce({
      ok: true,
      data: baseAccessContext({
        identity: { sessionUserId: 'usr-8', userId: 'usr-8', organizationId: 'org-2', selectedUnitId: null },
        membership: { id: 'm-8', userId: 'usr-8', organizationId: 'org-2', status: 'active' },
        organization: { id: 'org-2', nome: 'Org 2', status: 'active' },
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'login-org2' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toContain('|org-2|'));
  });

  it('21) troca de modo invalida contexto anterior', async () => {
    const { unmount } = render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toContain('usuario.demo@biomed.health'));
    unmount();

    mockedMode = 'supabase';
    resolveAccessContextMock.mockResolvedValueOnce({
      ok: true,
      data: baseAccessContext(),
    });

    renderHarness();
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo'));
  });

  it('22) resultado assíncrono antigo não sobrescreve sessão nova', async () => {
    const first = { resolve: null as ((value: AccessResult<AccessContext>) => void) | null };
    const firstPromise = new Promise<AccessResult<AccessContext>>((resolve) => {
      first.resolve = resolve;
    });
    resolveAccessContextMock
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({
        ok: true,
        data: baseAccessContext({
          identity: { sessionUserId: 'usr-8', userId: 'usr-8', organizationId: 'org-2', selectedUnitId: null },
          membership: { id: 'm-8', userId: 'usr-8', organizationId: 'org-2', status: 'active' },
          organization: { id: 'org-2', nome: 'Org 2', status: 'active' },
        }),
      });

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    fireEvent.click(screen.getByRole('button', { name: 'login-org2' }));
    if (first.resolve) {
      first.resolve({
        ok: true,
        data: baseAccessContext(),
      });
    }

    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toContain('|org-2|'));
  });

  it('23) resolução concluída após logout é descartada', async () => {
    const delayed = { resolve: null as ((value: AccessResult<AccessContext>) => void) | null };
    resolveAccessContextMock.mockReturnValueOnce(
      new Promise<AccessResult<AccessContext>>((resolve) => {
        delayed.resolve = resolve;
      })
    );

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    if (delayed.resolve) delayed.resolve({ ok: true, data: baseAccessContext() });
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo'));
  });

  it('24) regressão mock: bloqueia acesso cruzado no login', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-cruzado' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo'));
  });

  it('25) login supabase inválido por configuração mantém fail-closed', async () => {
    mockedMode = 'supabase';
    mockedConfigError = 'missing config';
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-supabase' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo'));
  });

  it('modo inválido fica fail-closed', async () => {
    mockedModeError = new Error('invalid mode');
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() => expect(screen.getByTestId('usuario-logado').textContent).toBe('anonimo'));
    await waitFor(() => expect(screen.getByTestId('resultado-login').textContent).toContain('erro:invalid mode'));
  });
});
