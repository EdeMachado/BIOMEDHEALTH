import { useMemo, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { ConsentManagementCard } from '@/features/minha-biomed/ConsentManagementCard';

type ActivityState = {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string;
  frequencia: string;
  status: 'Pendente' | 'Em andamento' | 'Concluída';
  progresso: number;
  dataPrevista: string;
};

const STORAGE_KEY = 'biomed_user_activities';

function getInitialActivities(): ActivityState[] {
  const fromStorage = sessionStorage.getItem(STORAGE_KEY);
  if (fromStorage) {
    try {
      return JSON.parse(fromStorage) as ActivityState[];
    } catch {
      return [];
    }
  }
  return [
    {
      id: 'act-1',
      titulo: 'Rotina de sono',
      categoria: 'Sono e recuperação',
      descricao: 'Registrar horário de dormir e acordar.',
      frequencia: 'Diária',
      status: 'Em andamento',
      progresso: 50,
      dataPrevista: 'Hoje',
    },
    {
      id: 'act-2',
      titulo: 'Hidratação',
      categoria: 'Prevenção',
      descricao: 'Registrar ingestão de água ao longo do dia.',
      frequencia: 'Diária',
      status: 'Pendente',
      progresso: 20,
      dataPrevista: 'Hoje',
    },
    {
      id: 'act-3',
      titulo: 'Conteúdo educativo',
      categoria: 'Bem-estar',
      descricao: 'Assistir ao conteúdo sobre organização de rotina.',
      frequencia: 'Semanal',
      status: 'Concluída',
      progresso: 100,
      dataPrevista: 'Concluída em 28/07',
    },
  ];
}

export function UserJourneyPage() {
  const weeks = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        week: i + 1,
        status: i < 3 ? 'concluída' : i === 3 ? 'em andamento' : 'bloqueada',
      })),
    []
  );

  return (
    <Card className="space-y-3">
      <CardTitle>Minha jornada — Bem-estar e Prevenção</CardTitle>
      <CardDescription>
        Público elegível: adultos ativos. Duração: 8 semanas. Próximo marco: reavaliação preventiva.
      </CardDescription>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {weeks.map((item) => (
          <div key={item.week} className="rounded-lg border bg-white p-3 text-sm">
            <p className="font-semibold">Semana {item.week}</p>
            <span
              className={`status-badge mt-2 inline-block ${
                item.status === 'concluída'
                  ? 'status-success'
                  : item.status === 'em andamento'
                    ? 'status-warning'
                    : 'status-info'
              }`}
            >
              {item.status}
            </span>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {item.status === 'bloqueada'
                ? 'Disponível após concluir a semana anterior.'
                : 'Atividades de prevenção e acompanhamento.'}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function UserActivitiesPage() {
  const [activities, setActivities] = useState<ActivityState[]>(getInitialActivities());

  function updateActivity(id: string, updates: Partial<ActivityState>) {
    const next = activities.map((item) => (item.id === id ? { ...item, ...updates } : item));
    setActivities(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const pending = activities.filter((a) => a.status !== 'Concluída');
  const done = activities.filter((a) => a.status === 'Concluída');

  return (
    <Card className="space-y-3">
      <CardTitle>Atividades da semana</CardTitle>
      <CardDescription>Acompanhamento de progresso da jornada preventiva.</CardDescription>
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Pendentes e em andamento</h4>
        <div className="grid gap-2">
          {pending.map((activity) => (
            <article key={activity.id} className="rounded-xl border bg-white p-3 text-sm shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{activity.titulo}</p>
                <span className={`status-badge ${activity.status === 'Pendente' ? 'status-info' : 'status-warning'}`}>
                  {activity.status}
                </span>
              </div>
              <p className="text-[var(--muted-foreground)]">{activity.categoria} • {activity.frequencia}</p>
              <p className="mt-1">{activity.descricao}</p>
              <div className="mt-2 h-2 rounded-full bg-[var(--muted)]">
                <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${activity.progresso}%` }} />
              </div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Data prevista: {activity.dataPrevista}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => updateActivity(activity.id, { status: 'Concluída', progresso: 100 })}>
                  Marcar como concluída
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateActivity(activity.id, { status: 'Em andamento', progresso: Math.min(activity.progresso + 20, 95) })}>
                  Registrar hoje
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Concluídas</h4>
        <div className="grid gap-2">
          {done.map((activity) => (
            <article key={activity.id} className="rounded-xl border bg-[var(--secondary)] p-3 text-sm">
              <p className="font-semibold">{activity.titulo}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{activity.dataPrevista}</p>
            </article>
          ))}
        </div>
      </section>
    </Card>
  );
}

export function UserProfilePrivacyPage() {
  const [message, setMessage] = useState('');

  return (
    <Card className="space-y-3">
      <CardTitle>Perfil e privacidade</CardTitle>
      <CardDescription>
        Histórico de consentimento, solicitação de exportação e correção de dados.
      </CardDescription>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border p-3">
          <h4 className="font-semibold">Preferências de comunicação</h4>
          <p className="text-sm text-[var(--muted-foreground)]">Canal atual: e-mail.</p>
          <Button size="sm" className="mt-2" variant="outline" onClick={() => setMessage('Preferências atualizadas em modo demonstração.')}>
            Editar preferências
          </Button>
        </section>
        <ConsentManagementCard onMessage={setMessage} />
        <section className="rounded-xl border p-3">
          <h4 className="font-semibold">Direitos LGPD</h4>
          <p className="text-sm text-[var(--muted-foreground)]">Solicitações administrativas disponíveis.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setMessage('Solicitação de exportação registrada em modo demonstração.')}>
              Solicitar exportação
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMessage('Solicitação de correção registrada em modo demonstração.')}>
              Solicitar correção
            </Button>
          </div>
        </section>
        <section className="rounded-xl border p-3">
          <h4 className="font-semibold">Segurança da conta</h4>
          <p className="text-sm text-[var(--muted-foreground)]">Sessão ativa em ambiente de demonstração.</p>
        </section>
      </div>
      {message ? <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm">{message}</p> : null}
    </Card>
  );
}

export function UserAgendaPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Agenda</CardTitle>
      <CardDescription>Solicitação, confirmação e histórico de atendimentos preventivos.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">12/08 - 14:00 - Consulta preventiva - confirmado</li>
        <li className="rounded-lg border p-2">26/08 - 09:00 - Reavaliação de rotina - solicitado</li>
      </ul>
    </Card>
  );
}
