import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAuditEvents } from '@/domains/audit/auditTrail';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthProvider } from '@/services/auth/AuthContext';

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('mostra erro para credenciais inválidas', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText('E-mail');
    fireEvent.change(emailInput, { target: { value: 'invalido@biomed.health' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/credenciais inv[aá]lidas/i)).toBeInTheDocument();
  });

  it('mantem login funcional sem crypto.randomUUID e registra auditoria', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues(array: Uint8Array) {
        for (let index = 0; index < array.length; index += 1) array[index] = (index + 17) % 255;
        return array;
      },
    });

    const router = createMemoryRouter(
      [
        { path: '/login', element: <LoginPage /> },
        { path: '/minha-biomed', element: <h1>Minha BioMed</h1> },
      ],
      { initialEntries: ['/login'] }
    );

    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'usuario.demo@biomed.health' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Demo@123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Minha BioMed' })).toBeInTheDocument();

    const events = listAuditEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.action).toBe('login');
    expect(events[0]?.result).toBe('sucesso');
    expect(events[0]?.id).toMatch(/^id-/);
  });
});
