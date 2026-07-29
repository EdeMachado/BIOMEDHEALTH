import { Link, Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/services/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';

const menuByArea = {
  'minha-biomed': [
    { label: 'Inicio', to: '/minha-biomed' },
    { label: 'Jornada', to: '/minha-biomed/jornada' },
    { label: 'Atividades', to: '/minha-biomed/atividades' },
    { label: 'Perfil', to: '/minha-biomed/perfil' },
  ],
  clinica: [
    { label: 'Visao Geral', to: '/clinica' },
    { label: 'Agenda', to: '/clinica/agenda' },
    { label: 'Minha Carteira', to: '/clinica/carteira' },
    { label: 'Avaliacoes', to: '/clinica/avaliacoes' },
    { label: 'Ficha Clinica', to: '/clinica/ficha' },
    { label: 'Plano de Cuidado', to: '/clinica/plano-cuidado' },
    { label: 'Registros', to: '/clinica/registros' },
  ],
  gestao: [
    { label: 'Visao Geral', to: '/gestao' },
    { label: 'Campanhas', to: '/gestao/campanhas' },
    { label: 'Indicadores', to: '/gestao/indicadores' },
    { label: 'Plano de Acao', to: '/gestao/plano-acao' },
    { label: 'Auditoria', to: '/gestao/auditoria' },
  ],
} as const;

type AreaLayoutProps = {
  area: keyof typeof menuByArea;
  title: string;
};

export function AreaLayout({ area, title }: AreaLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8fbfa]">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              BIOMED HEALTH
            </p>
            <h1 className="text-xl font-bold text-[var(--card-foreground)]">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge>Ambiente demonstrativo - dados ficticios</Badge>
            <span className="text-sm text-[var(--muted-foreground)]">{user?.nome}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="inline-flex items-center gap-1"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border bg-white p-3 shadow-sm">
          <nav className="flex flex-wrap gap-2 md:flex-col">
            {menuByArea[area].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="focus-ring rounded-lg px-3 py-2 text-sm font-medium text-[var(--card-foreground)] hover:bg-[var(--secondary)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
