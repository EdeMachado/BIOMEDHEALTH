import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthProvider } from '@/services/auth/AuthContext';

describe('LoginPage', () => {
  it('mostra erro para credenciais invalidas', async () => {
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

    expect(await screen.findByText(/credenciais invalidas/i)).toBeInTheDocument();
  });
});
