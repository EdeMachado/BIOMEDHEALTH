import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/shared/types/access';

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

const resolveAccessContextMock = vi.fn<(identity: AccessIdentity) => Promise<AccessResult<AccessContext>>>();

vi.mock('@/services/repositories/access/factory', () => {
  return {
    resolveAccessRepositoryMode: () => 'mock',
    resolveRuntimeEnvironment: () => 'non-production',
    createAccessContextRepositoryFactory: () => ({
      resolveAccessContext: resolveAccessContextMock,
    }),
  };
});

vi.mock('@/services/api/supabaseClient', () => {
  return {
    getSupabaseClient: () => null,
    validateSupabaseConfiguration: () => null,
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

function AuthHarness({ useAuth }: { useAuth: () => { user: SessionUser | null; login: (input: { email: string; password: string; organizationId: string }) => Promise<{ ok: boolean; message?: string }>; logout: () => Promise<void> } }) {
  const { user, login, logout } = useAuth();
  const [result, setResult] = useState('idle');

  return (
    <div>
      <p data-testid="user-state">{user ? `${user.id}|${user.organizationId}|${user.role}|${user.roles.join(',')}` : 'anonimo'}</p>
      <p data-testid="login-result">{result}</p>
      <button type="button" onClick={() => void login({ email: 'usuario.demo@biomed.health', password: 'Demo@123', organizationId: 'org-1' }).then((value) => setResult(value.ok ? 'ok' : `erro:${value.message}`))}>
        login
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

describe('accessIsolation integration', () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    resolveAccessContextMock.mockReset();
  });

  it('C19: organização/vínculo válidos permitem sessão completa', async () => {
    resolveAccessContextMock.mockResolvedValue({ ok: true, data: baseContext() });
    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('usr-1|org-1|usuario|usuario'));
  });

  it('C20-C24/D33-D35/E39-E41/F53: erros de organização, vínculo, papel e unidade falham fechado', async () => {
    const blockedCodes: AccessErrorCode[] = [
      'ORGANIZATION_NOT_FOUND',
      'ORGANIZATION_INACTIVE',
      'NO_ACTIVE_MEMBERSHIP',
      'MEMBERSHIP_INACTIVE',
      'NO_ACTIVE_ROLES',
      'UNIT_SCOPE_INCOMPATIBLE',
      'CROSS_TENANT_DATA',
    ];

    for (const code of blockedCodes) {
      resolveAccessContextMock.mockResolvedValueOnce({ ok: false, error: { code } });
      const view = await renderHarness();
      fireEvent.click(screen.getByRole('button', { name: 'login' }));
      await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
      expect(sessionStorage.getItem('biomed_demo_session')).toBeNull();
      view.unmount();
      sessionStorage.clear();
    }
  });

  it('B10-B12/C27/F50-F52: identidade/sessão/consistência inválidas não vazam estado público', async () => {
    const blockedCodes: AccessErrorCode[] = ['NO_SESSION', 'IDENTITY_MISMATCH', 'USER_NOT_FOUND', 'CROSS_TENANT_DATA'];
    for (const code of blockedCodes) {
      resolveAccessContextMock.mockResolvedValueOnce({ ok: false, error: { code } });
      const view = await renderHarness();
      fireEvent.click(screen.getByRole('button', { name: 'login' }));
      await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
      await waitFor(() => expect(screen.getByTestId('login-result').textContent).not.toContain('token'));
      await waitFor(() => expect(screen.getByTestId('login-result').textContent).not.toContain('secret'));
      view.unmount();
      sessionStorage.clear();
    }
  });

  it('D36-D37/E42-E45: mantém escopos válidos e nega escopos de outro tenant', async () => {
    resolveAccessContextMock
      .mockResolvedValueOnce({
        ok: true,
        data: baseContext({
          roles: ['medico', 'usuario'],
          effectiveRole: 'medico',
          roleBindings: [
            { membershipId: 'm-1', role: 'medico', unitId: 'unit-a', status: 'active' },
            { membershipId: 'm-1', role: 'usuario', unitId: null, status: 'active' },
          ],
          unitScopes: [{ membershipId: 'm-1', unitId: 'unit-a', organizationId: 'org-1', status: 'active' }],
        }),
      })
      .mockResolvedValueOnce({ ok: false, error: { code: 'CROSS_TENANT_DATA' } });

    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('medico|medico,usuario'));

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));

    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
  });
});
