import { useState } from 'react';
import { useNavigate } from 'react-router';
import { organizations } from '@/services/repositories/demoData';
import { useAuth } from '@/services/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Alert } from '@/shared/ui/alert';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('usuario.demo@biomed.health');
  const [password, setPassword] = useState('Demo@123');
  const [organizationId, setOrganizationId] = useState('org-1');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f7f6] p-4">
      <Card className="w-full max-w-lg space-y-4">
        <div className="space-y-2">
          <CardTitle>BIOMED HEALTH</CardTitle>
          <CardDescription>Saúde conectada. Decisões inteligentes.</CardDescription>
        </div>
        <Alert>
          Ambiente demonstrativo — dados fictícios. Não use informações reais de pacientes ou
          colaboradores.
        </Alert>
        {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              const result = await login({ email, password, organizationId });
              if (!result.ok) {
                setError(result.message ?? 'Falha de autenticação.');
                return;
              }
              void navigate(result.redirectTo ?? '/');
            })();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>E-mail</span>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Senha</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Organização</span>
            <select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="focus-ring h-10 w-full rounded-xl border bg-white px-3 text-sm"
            >
              {organizations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
        <p className="text-xs text-[var(--muted-foreground)]">
          Contas demo: usuário, médico, profissional de saúde, gestor clínico, gestor institucional,
          SST, administrador cliente, administrador BioMed e auditor (senha `Demo@123`).
        </p>
      </Card>
    </div>
  );
}
