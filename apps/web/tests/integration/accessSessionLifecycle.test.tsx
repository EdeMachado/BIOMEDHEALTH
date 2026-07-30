import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/shared/types/access';

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

type AccessResult<T> = { ok: true; data: T } | { ok: false; error: { code: string } };

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

function AuthHarness({ useAuth }: { useAuth: () => { user: SessionUser | null; login: (input: { email: string; password: string; organizationId: string }) => Promise<{ ok: boolean; message?: string; redirectTo?: string }>; logout: () => Promise<void> } }) {
  const { user, login, logout } = useAuth();
  const [result, setResult] = useState('idle');

  return (
    <div>
      <p data-testid="user-state">{user ? `${user.id}|${user.email}|${user.organizationId}|${user.role}|${user.roles.join(',')}` : 'anonimo'}</p>
      <p data-testid="result-state">{result}</p>
      <button type="button" onClick={() => void login({ email: 'usuario.demo@biomed.health', password: 'Demo@123', organizationId: 'org-1' }).then((value) => setResult(value.ok ? `ok:${value.redirectTo}` : `erro:${value.message}`))}>
        login-org1
      </button>
      <button type="button" onClick={() => void login({ email: 'usuario.org2@biomed.health', password: 'Demo@123', organizationId: 'org-2' }).then((value) => setResult(value.ok ? `ok:${value.redirectTo}` : `erro:${value.message}`))}>
        login-org2
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

function deferred<T>() {
  let resolveRef: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolveRef = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      resolveRef?.(value);
    },
  };
}

describe('accessSessionLifecycle integration', () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    resolveAccessContextMock.mockReset();
  });

  it('G65/G66: resultado assíncrono antigo não sobrescreve nova sessão', async () => {
    const delayed = deferred<AccessResult<AccessContext>>();
    resolveAccessContextMock
      .mockReturnValueOnce(delayed.promise)
      .mockResolvedValueOnce({
        ok: true,
        data: baseContext({
          identity: { sessionUserId: 'usr-8', userId: 'usr-8', organizationId: 'org-2', selectedUnitId: null },
          membership: { id: 'm-8', userId: 'usr-8', organizationId: 'org-2', status: 'active' },
          organization: { id: 'org-2', nome: 'Org 2', status: 'active' },
        }),
      });

    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    fireEvent.click(screen.getByRole('button', { name: 'login-org2' }));
    delayed.resolve({ ok: true, data: baseContext() });

    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('|org-2|'));
  });

  it('B16/G65: resolução concluída após logout é descartada', async () => {
    const delayed = deferred<AccessResult<AccessContext>>();
    resolveAccessContextMock.mockReturnValueOnce(delayed.promise);

    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    delayed.resolve({ ok: true, data: baseContext() });

    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
  });

  it('G59-G64: logout limpa usuário, papéis, org/unidade e storages', async () => {
    resolveAccessContextMock.mockResolvedValue({ ok: true, data: baseContext() });

    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('|org-1|usuario|usuario'));

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));
    expect(sessionStorage.getItem('biomed_demo_session')).toBeNull();
    expect(sessionStorage.getItem('biomed_supabase_org_selection')).toBeNull();
  });

  it('A4/C25/C26/E46/E47: troca de contexto invalida sessão anterior sem contaminação', async () => {
    resolveAccessContextMock
      .mockResolvedValueOnce({
        ok: true,
        data: baseContext(),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: baseContext({
          identity: { sessionUserId: 'usr-8', userId: 'usr-8', organizationId: 'org-2', selectedUnitId: null },
          membership: { id: 'm-8', userId: 'usr-8', organizationId: 'org-2', status: 'active' },
          organization: { id: 'org-2', nome: 'Org 2', status: 'active' },
          roles: ['medico', 'usuario'],
          effectiveRole: 'medico',
        }),
      });

    await renderHarness();
    fireEvent.click(screen.getByRole('button', { name: 'login-org1' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('|org-1|'));

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toBe('anonimo'));

    fireEvent.click(screen.getByRole('button', { name: 'login-org2' }));
    await waitFor(() => expect(screen.getByTestId('user-state').textContent).toContain('|org-2|medico|medico,usuario'));
  });
});
