import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/shared/types/access';

type AccessMode = 'mock' | 'supabase';

type AccessErrorCode =
  | 'NO_SESSION'
  | 'USER_NOT_FOUND'
  | 'ORGANIZATION_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'MEMBERSHIP_INACTIVE'
  | 'NO_ACTIVE_ROLES'
  | 'UNIT_SCOPE_INCOMPATIBLE'
  | 'CROSS_TENANT_DATA'
  | 'IDENTITY_MISMATCH'
  | 'TRANSIENT_BACKEND_ERROR'
  | 'UNEXPECTED_BACKEND_ERROR';

type AccessIdentity = {
  sessionUserId: string | null;
  userId: string | null;
  organizationId: string;
  selectedUnitId?: string | null;
};

type AccessContext = {
  identity: AccessIdentity;
  organization: { id: string; nome: string; status: 'active' | 'inactive' };
  membership: { id: string; userId: string; organizationId: string; status: 'active' | 'inactive' };
  roleBindings: Array<{ membershipId: string; role: SessionUser['role']; unitId: string | null; status: 'active' | 'inactive' }>;
  roles: SessionUser['roles'];
  effectiveRole: SessionUser['role'];
  unitScopes: Array<{ membershipId: string; unitId: string; organizationId: string; status: 'active' | 'inactive' }>;
};

type AccessResult<T> = { ok: true; data: T } | { ok: false; error: { code: AccessErrorCode } };

type FakeSupabaseClient = {
  auth: {
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
  };
  operations: Array<{ op: string; table?: string }>;
};

const resolveAccessContextMock = vi.fn<(identity: AccessIdentity) => Promise<AccessResult<AccessContext>>>();
const getSupabaseClientMock = vi.fn<() => FakeSupabaseClient | null>();
const validateSupabaseConfigurationMock = vi.fn<() => string | null>();

let mockedMode: AccessMode = 'mock';
let mockedModeError: Error | null = null;
let mockedRuntime: 'production' | 'non-production' = 'non-production';

vi.mock('@/services/repositories/access/factory', () => {
  return {
    resolveAccessRepositoryMode: () => {
      if (mockedModeError) throw mockedModeError;
      return mockedMode;
    },
    resolveRuntimeEnvironment: () => mockedRuntime,
    createAccessContextRepositoryFactory: () => ({
      resolveAccessContext: resolveAccessContextMock,
    }),
  };
});

vi.mock('@/services/api/supabaseClient', () => {
  return {
    getSupabaseClient: getSupabaseClientMock,
    validateSupabaseConfiguration: validateSupabaseConfigurationMock,
  };
});

function baseContext(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    identity: {
      sessionUserId: 'usr-1',
      userId: 'usr-1',
      organizationId: 'org-1',
      selectedUnitId: null,
    },
    organization: { id: 'org-1', nome: 'Org 1', status: 'active' },
    membership: { id: 'm-1', userId: 'usr-1', organizationId: 'org-1', status: 'active' },
    roleBindings: [{ membershipId: 'm-1', role: 'usuario', unitId: null, status: 'active' }],
    roles: ['usuario'],
    effectiveRole: 'usuario',
    unitScopes: [],
    ...overrides,
  };
}

function createSupabaseClient(): FakeSupabaseClient {
  const operations: Array<{ op: string; table?: string }> = [];
  return {
    operations,
    auth: {
      signInWithPassword: vi.fn(() => {
        operations.push({ op: 'signInWithPassword' });
        return Promise.resolve({ error: null });
      }),
      signOut: vi.fn(() => {
        operations.push({ op: 'signOut' });
        return Promise.resolve({ error: null });
      }),
      getUser: vi.fn(() => {
        operations.push({ op: 'getUser' });
        return Promise.resolve({
          data: { user: { id: 'usr-1', email: 'usuario.supabase@biomed.health', user_metadata: { nome: 'Usuário Supabase' } } },
          error: null,
        });
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  };
}

function AuthHarness({ useAuth }: { useAuth: () => { user: SessionUser | null; login: (input: { email: string; password: string; organizationId: string }) => Promise<{ ok: boolean; message?: string; redirectTo?: string }>; logout: () => Promise<void> } }) {
  const { user, login, logout } = useAuth();
  const [result, setResult] = useState('idle');

  return (
    <div>
      <p data-testid="user-state">{user ? `${user.id}|${user.organizationId}|${user.role}|${user.roles.join(',')}` : 'anonimo'}</p>
      <p data-testid="login-state">{result}</p>
      <button type="button" onClick={() => void login({ email: 'usuario.demo@biomed.health', password: 'Demo@123', organizationId: 'org-1' }).then((value) => setResult(value.ok ? `ok:${value.redirectTo}` : `erro:${value.message}`))}>
        login-mock
      </button>
      <button type="button" onClick={() => void login({ email: 'usuario.supabase@biomed.health', password: 'Demo@123', organizationId: 'org-1' }).then((value) => setResult(value.ok ? `ok:${value.redirectTo}` : `erro:${value.message}`))}>
        login-supabase
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  );
}

async function renderHarness() {
  const authModule = await import('@/services/auth/AuthContext');
  return render(
    <authModule.AuthProvider>
      <AuthHarness useAuth={authModule.useAuth} />
    </authModule.AuthProvider>
  );
}

describe('accessResolution integration', () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    mockedMode = 'mock';
    mockedModeError = null;
    mockedRuntime = 'non-production';
    resolveAccessContextMock.mockReset();
    getSupabaseClientMock.mockReset();
    validateSupabaseConfigurationMock.mockReset();
    vi.clearAllMocks();
  });

  it('A1/A5/B8: modo mock explícito com login válido e sem consulta Supabase', async () => {
    mockedMode = 'mock';
    resolveAccessContextMock.mockResolvedValue({ ok: true, data: baseContext() });
    validateSupabaseConfigurationMock.mockReturnValue(null);
    getSupabaseClientMock.mockReturnValue(createSupabaseClient());

    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-mock' }));

    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('usr-1|org-1|usuario|usuario'));
    expect(getSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('A2/B9: modo Supabase explícito com login válido', async () => {
    mockedMode = 'supabase';
    resolveAccessContextMock.mockResolvedValue({ ok: true, data: baseContext() });
    validateSupabaseConfigurationMock.mockReturnValue(null);
    const fakeClient = createSupabaseClient();
    getSupabaseClientMock.mockReturnValue(fakeClient);

    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-supabase' }));

    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('usr-1|org-1|usuario|usuario'));
    expect(fakeClient.auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('A3: modo inválido mantém fail-closed', async () => {
    mockedModeError = new Error('modo inválido');
    resolveAccessContextMock.mockResolvedValue({ ok: true, data: baseContext() });
    validateSupabaseConfigurationMock.mockReturnValue(null);
    getSupabaseClientMock.mockReturnValue(null);

    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-mock' }));

    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
    await waitFor(() => expect(screen.getByTestId('login-state').textContent).toContain('erro:modo inválido'));
  });

  it('D29/D30/D31/D32: preserva roles[] cumulativos e effectiveRole determinístico', async () => {
    resolveAccessContextMock.mockResolvedValue({
      ok: true,
      data: baseContext({
        roleBindings: [
          { membershipId: 'm-1', role: 'usuario', unitId: null, status: 'active' },
          { membershipId: 'm-1', role: 'medico', unitId: null, status: 'active' },
        ],
        roles: ['usuario', 'medico'],
        effectiveRole: 'medico',
      }),
    });
    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-mock' }));

    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('usr-1|org-1|medico|usuario,medico'));
  });

  it('F48/F49/F58: erro técnico permanece fail-closed sem fallback automático', async () => {
    const errors: AccessErrorCode[] = ['TRANSIENT_BACKEND_ERROR', 'UNEXPECTED_BACKEND_ERROR'];
    for (const code of errors) {
      resolveAccessContextMock.mockResolvedValueOnce({ ok: false, error: { code } });
      const view = await renderHarness();
      fireEvent.click(screen.getByRole('button', { name: 'login-mock' }));
      await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
      view.unmount();
      sessionStorage.clear();
    }
  });

  it('B18/G59-G64: falha de resolução não cria sessão parcial e logout limpa tudo', async () => {
    resolveAccessContextMock
      .mockResolvedValueOnce({ ok: true, data: baseContext() })
      .mockResolvedValueOnce({ ok: false, error: { code: 'NO_ACTIVE_MEMBERSHIP' } });
    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-mock' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('usr-1|org-1|usuario|usuario'));

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
    expect(sessionStorage.getItem('biomed_demo_session')).toBeNull();
    expect(sessionStorage.getItem('biomed_supabase_org_selection')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'login-mock' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
  });
});
