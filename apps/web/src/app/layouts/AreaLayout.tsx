import { NavLink, Outlet, type NavLinkRenderProps } from 'react-router';
import { LayoutDashboard, CalendarDays, ClipboardList, UserRound, Activity, ShieldCheck, Menu, X, LogOut, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';

const menuByArea = {
  'minha-biomed': [
    { label: 'Início', to: '/minha-biomed', icon: LayoutDashboard },
    { label: 'Jornada', to: '/minha-biomed/jornada' },
    { label: 'Atividades', to: '/minha-biomed/atividades' },
    { label: 'Agenda', to: '/minha-biomed/agenda' },
    { label: 'Perfil', to: '/minha-biomed/perfil' },
  ],
  clinica: [
    { label: 'Visão Geral', to: '/clinica', icon: LayoutDashboard },
    { label: 'Agenda', to: '/clinica/agenda' },
    { label: 'Minha Carteira', to: '/clinica/carteira' },
    { label: 'Avaliações', to: '/clinica/avaliacoes' },
    { label: 'Ficha Clínica', to: '/clinica/ficha' },
    { label: 'Plano de Cuidado', to: '/clinica/plano-cuidado' },
    { label: 'Registros', to: '/clinica/registros' },
  ],
  gestao: [
    { label: 'Visão Geral', to: '/gestao', icon: LayoutDashboard },
    { label: 'Campanhas', to: '/gestao/campanhas' },
    { label: 'Indicadores', to: '/gestao/indicadores' },
    { label: 'Plano de Ação', to: '/gestao/plano-acao' },
    { label: 'Auditoria', to: '/gestao/auditoria' },
  ],
} as const;

type AreaLayoutProps = {
  area: keyof typeof menuByArea;
  title: string;
};

export function AreaLayout({ area, title }: AreaLayoutProps) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menu = menuByArea[area];

  return (
    <div className="min-h-screen bg-[#f8fbfa] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
              BioMed Health
            </p>
            <h1 className="text-lg font-bold text-[var(--card-foreground)] sm:text-xl">{title}</h1>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Badge>Ambiente demonstrativo — dados fictícios</Badge>
            <span className="text-sm text-[var(--muted-foreground)]">{user?.nome}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void logout();
              }}
              className="inline-flex items-center gap-1"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[240px_1fr]">
        <aside className={`${mobileOpen ? 'block' : 'hidden'} rounded-2xl border bg-white p-3 shadow-sm lg:block`}>
          <nav className="flex flex-col gap-1">
            {menu.map((item) => {
              const Icon: LucideIcon = ('icon' in item ? item.icon : undefined) ?? resolveIcon(item.label);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }: NavLinkRenderProps) =>
                    `focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'text-[var(--card-foreground)] hover:bg-[var(--secondary)]'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-4 border-t pt-3 md:hidden">
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">{user?.nome}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function resolveIcon(label: string) {
  if (label.includes('Agenda')) return CalendarDays;
  if (label.includes('Carteira') || label.includes('Perfil')) return UserRound;
  if (label.includes('Atividade') || label.includes('Jornada')) return Activity;
  if (label.includes('Auditoria')) return ShieldCheck;
  return ClipboardList;
}
