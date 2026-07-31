import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import {
  loadLinkedClinicalAgenda,
  updateLinkedClinicalAppointment,
} from '@/domains/clinicalAgenda/clinicalAgendaService';
import { loadLinkedClinicalPortfolio } from '@/domains/clinicalPortfolio/clinicalPortfolioService';
import {
  loadLinkedPatientJourneyViews,
  summarizeClinicalJourneyViews,
} from '@/domains/journey/journeyService';
import { useAuth } from '@/services/auth/AuthContext';
import { getSupabaseClient } from '@/services/api/supabaseClient';
import {
  createClinicalAgendaRepositoryFactory,
  resolveClinicalAgendaRepositoryMode,
} from '@/services/repositories/clinicalAgenda/factory';
import { displayNameForAgendaPatient } from '@/services/repositories/clinicalAgenda/mockClinicalAgendaRepository';
import type {
  ClinicalAgendaContext,
  ClinicalAppointment,
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@/services/repositories/clinicalAgenda/types';
import type { SupabaseClinicalAgendaClient } from '@/services/repositories/clinicalAgenda/supabaseClinicalAgendaRepository';
import {
  createClinicalPortfolioRepositoryFactory,
  resolveClinicalPortfolioRepositoryMode,
} from '@/services/repositories/clinicalPortfolio/factory';
import type { ClinicalPortfolioPatient } from '@/services/repositories/clinicalPortfolio/types';
import type { SupabaseClinicalPortfolioClient } from '@/services/repositories/clinicalPortfolio/supabaseClinicalPortfolioRepository';
import {
  createJourneyRepositoryFactory,
  resolveJourneyRepositoryMode,
} from '@/services/repositories/journey/factory';
import type { SupabaseJourneyClient } from '@/services/repositories/journey/supabaseJourneyRepository';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';

export function ClinicalOverviewPage() {
  const { patients, loading, error } = useClinicalPortfolio();
  const { appointments, loading: agendaLoading } = useClinicalAgenda();
  const primary = !loading && !error ? (patients[0] ?? null) : null;
  const upcoming = appointments
    .filter((item) => item.appointmentStatus !== 'cancelado' && item.appointmentStatus !== 'concluido')
    .slice(0, 2);
  const todayCount = appointments.filter((item) => isSameLocalDay(item.startsAt, new Date())).length;
  const pendingReassessment = appointments.filter(
    (item) => item.appointmentType === 'reavaliacao' && item.appointmentStatus !== 'concluido'
  ).length;

  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader patient={primary} />
      <Card className="space-y-3">
        {loading ? <p className="text-sm text-[var(--muted-foreground)]">Carregando carteira...</p> : null}
        {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && !error && primary ? (
          <ClinicalPatientJourneyPanel
            patientUserId={primary.patientId}
            patientName={primary.displayName}
          />
        ) : null}
        {!loading && !error && !primary ? (
          <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-portfolio-empty">
            Nenhum paciente vinculado para acompanhamento.
          </p>
        ) : null}
      </Card>
      <Card className="space-y-3">
      <CardTitle>Painel profissional</CardTitle>
      <CardDescription>Agenda, carteira de usuários vinculados e plano de cuidado.</CardDescription>
      <div className="grid gap-2 sm:grid-cols-3">
        <Info label="Atendimentos hoje" value={agendaLoading ? '…' : String(todayCount)} />
        <Info label="Usuários vinculados" value={String(patients.length)} />
        <Info label="Reavaliações pendentes" value={agendaLoading ? '…' : String(pendingReassessment)} />
      </div>
      <div className="rounded-xl border p-3">
        <p className="text-sm font-semibold">Próximos atendimentos</p>
        <ul className="mt-2 space-y-2 text-sm" data-testid="clinical-overview-upcoming">
          {agendaLoading ? (
            <li className="text-[var(--muted-foreground)]">Carregando agenda...</li>
          ) : null}
          {!agendaLoading && upcoming.length === 0 ? (
            <li className="text-[var(--muted-foreground)]" data-testid="clinical-overview-upcoming-empty">
              Nenhum compromisso agendado.
            </li>
          ) : null}
          {!agendaLoading
            ? upcoming.map((item) => {
                const name = resolveAgendaPatientName(item.patientId, patients);
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--secondary)] p-2"
                    data-testid={`clinical-overview-upcoming-${item.id}`}
                  >
                    <span>
                      {formatAppointmentTime(item.startsAt)} • {name} • {appointmentTypeLabel(item.appointmentType)}
                    </span>
                    <span className={`status-badge ${appointmentStatusBadgeClass(item.appointmentStatus)}`}>
                      {appointmentStatusLabel(item.appointmentStatus)}
                    </span>
                  </li>
                );
              })
            : null}
        </ul>
      </div>
      </Card>
    </div>
  );
}

export function ClinicalAgendaPage() {
  const [dateFilter, setDateFilter] = useState('hoje');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [message, setMessage] = useState('');
  const { patients } = useClinicalPortfolio();
  const { appointments, loading, error, refresh, repository, context } = useClinicalAgenda();

  const rows = appointments.filter((item) => {
    const statusMatch =
      statusFilter === 'todos' ||
      item.appointmentStatus === statusFilter ||
      (statusFilter === 'concluído' && item.appointmentStatus === 'concluido');
    const typeMatch =
      typeFilter === 'todos' ||
      item.appointmentType === typeFilter ||
      (typeFilter === 'reavaliação' && item.appointmentType === 'reavaliacao');
    const dateMatch = dateFilter === 'semana' || isSameLocalDay(item.startsAt, new Date());
    return statusMatch && typeMatch && dateMatch;
  });

  async function confirmAppointment(appointment: ClinicalAppointment) {
    if (!repository || !context) {
      setMessage('Nao foi possivel atualizar o compromisso neste momento.');
      return;
    }
    const result = await updateLinkedClinicalAppointment(repository, context, {
      appointmentId: appointment.id,
      appointmentStatus: 'confirmado',
    });
    if (!result.ok) {
      setMessage('Nao foi possivel confirmar o compromisso.');
      return;
    }
    setMessage(
      `Status de ${resolveAgendaPatientName(appointment.patientId, patients)} atualizado para Confirmado.`
    );
    await refresh();
  }

  return (
    <Card className="space-y-3">
      <CardTitle>Agenda</CardTitle>
      <CardDescription>Estados: Solicitado, Confirmado, Concluído, Cancelado e Ausência.</CardDescription>
      <div className="grid gap-2 sm:grid-cols-3">
        <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="hoje">Hoje</option>
          <option value="semana">Esta semana</option>
        </select>
        <select
          className="focus-ring h-10 rounded-xl border px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="clinical-agenda-status-filter"
        >
          <option value="todos">Todos os status</option>
          <option value="solicitado">Solicitado</option>
          <option value="confirmado">Confirmado</option>
          <option value="concluído">Concluído</option>
          <option value="cancelado">Cancelado</option>
          <option value="ausencia">Ausência</option>
        </select>
        <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          <option value="preventiva">Preventiva</option>
          <option value="reavaliação">Reavaliação</option>
          <option value="acompanhamento">Acompanhamento</option>
        </select>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-agenda-loading">
          Carregando agenda persistida...
        </p>
      ) : null}
      {!loading && error ? (
        <p className="text-sm text-red-600" data-testid="clinical-agenda-error">
          {error}
        </p>
      ) : null}
      {!loading && !error && appointments.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-agenda-empty">
          Nenhum compromisso na agenda autorizada.
        </p>
      ) : null}
      {!loading && !error && appointments.length > 0 && rows.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-agenda-filter-empty">
          Nenhum compromisso correspondente aos filtros.
        </p>
      ) : null}
      <div className="space-y-2 text-sm">
        {rows.map((row) => {
          const usuario = resolveAgendaPatientName(row.patientId, patients);
          const statusLabel = appointmentStatusLabel(row.appointmentStatus);
          return (
            <div key={row.id} className="rounded-xl border p-3" data-testid={`clinical-agenda-row-${row.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {formatAppointmentTime(row.startsAt)} • {usuario}
                </p>
                <span className={`status-badge ${appointmentStatusBadgeClass(row.appointmentStatus)}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-[var(--muted-foreground)]">{appointmentTypeLabel(row.appointmentType)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setMessage(`Atendimento de ${usuario} aberto.`)}>
                  Ver atendimento
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void confirmAppointment(row)}
                  disabled={row.appointmentStatus === 'confirmado' || row.appointmentStatus === 'concluido'}
                >
                  Confirmar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMessage(`Reagendamento de ${usuario} solicitado.`)}>
                  Reagendar
                </Button>
                <Button size="sm" onClick={() => setMessage(`Registro de atendimento iniciado para ${usuario}.`)}>
                  Registrar atendimento
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {message ? <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm">{message}</p> : null}
    </Card>
  );
}

export function ClinicalPortfolioPage() {
  const [query, setQuery] = useState('');
  const { patients, loading, error } = useClinicalPortfolio();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      setSelectedPatientId(null);
      return;
    }
    if (error || patients.length === 0) {
      setSelectedPatientId(null);
      return;
    }
    setSelectedPatientId((current) =>
      current && patients.some((item) => item.patientId === current) ? current : patients[0].patientId
    );
  }, [loading, error, patients]);

  const list = patients.filter((patient) =>
    patient.displayName.toLowerCase().includes(query.toLowerCase())
  );
  const selectedPatient =
    !loading && !error && selectedPatientId
      ? (patients.find((item) => item.patientId === selectedPatientId) ?? null)
      : null;

  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader patient={selectedPatient} />
      <Card className="space-y-3">
        <CardTitle>Minha carteira</CardTitle>
        <CardDescription>Exibe apenas usuários com vínculo clínico ativo do profissional logado.</CardDescription>
        <input
          className="focus-ring h-10 w-full rounded-xl border px-3 text-sm"
          placeholder="Buscar usuário vinculado"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          data-testid="clinical-portfolio-search"
        />
        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-portfolio-loading">
            Carregando carteira persistida...
          </p>
        ) : null}
        {!loading && error ? (
          <p className="text-sm text-red-600" data-testid="clinical-portfolio-error">
            {error}
          </p>
        ) : null}
        {!loading && !error && patients.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-portfolio-empty">
            Nenhum paciente vinculado para acompanhamento.
          </p>
        ) : null}
        {!loading && !error && patients.length > 0 && list.length === 0 ? (
          <p
            className="text-sm text-[var(--muted-foreground)]"
            data-testid="clinical-portfolio-search-empty"
          >
            Nenhum paciente correspondente à busca.
          </p>
        ) : null}
        <div className="grid gap-2">
          {list.map((patient) => (
            <article
              key={patient.patientId}
              className="rounded-xl border bg-white p-3 text-sm shadow-[var(--shadow-card)]"
              data-testid={`clinical-portfolio-card-${patient.patientId}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{patient.displayName}</p>
                <span className="status-badge status-info">{patient.assignmentStatus}</span>
              </div>
              <button
                type="button"
                className="focus-ring mt-2 text-sm text-[var(--primary)] underline"
                onClick={() => setSelectedPatientId(patient.patientId)}
                data-testid={`clinical-portfolio-select-${patient.patientId}`}
              >
                Ver jornada
              </button>
              {selectedPatient?.patientId === patient.patientId ? (
                <ClinicalPatientJourneyPanel
                  key={patient.patientId}
                  patientUserId={patient.patientId}
                  patientName={patient.displayName}
                />
              ) : null}
              <Button className="mt-2" size="sm" asChild>
                <NavLink to="/clinica/avaliacoes">Abrir acompanhamento</NavLink>
              </Button>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ClinicalRecordPage() {
  const [editing, setEditing] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  return (
    <div className="space-y-4">
      <ClinicalDemoPatientContextHeader />
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Ficha clínica demonstrativa</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Visualizar' : 'Editar ficha'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(false);
                setSavedMessage('Registro concluído em modo demonstração.');
              }}
            >
              Concluir registro
            </Button>
          </div>
        </div>
        <CardDescription>Última atualização: 29/07/2026 • Dados fictícios.</CardDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Identificação', 'Usuário fictício, jornada preventiva ativa.'],
            ['Motivo do acompanhamento', 'Reforçar rotina de sono e autocuidado.'],
            ['Hábitos e rotina', 'Relata rotina parcialmente organizada.'],
            ['Sono', 'Média de 6h por noite com variação semanal.'],
            ['Atividade física', 'Caminhadas 2 a 3 vezes por semana.'],
            ['Alimentação percebida', 'Busca regularidade de horários.'],
            ['Bem-estar', 'Estresse moderado em períodos de trabalho intenso.'],
            ['Conduta orientativa', 'Acompanhamento preventivo e conteúdo educativo.'],
          ].map(([title, value]) => (
            <section key={title} className="rounded-xl border p-3 text-sm">
              <p className="font-semibold">{title}</p>
              {editing ? (
                <textarea className="focus-ring mt-2 min-h-20 w-full rounded-lg border p-2" defaultValue={value} />
              ) : (
                <p className="mt-1 text-[var(--muted-foreground)]">{value}</p>
              )}
            </section>
          ))}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSavedMessage('Rascunho salvo em memória para demonstração.')}>
              Salvar rascunho
            </Button>
          </div>
        ) : null}
        {savedMessage ? <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm">{savedMessage}</p> : null}
      </Card>
    </div>
  );
}

export function ClinicalAssessmentPage() {
  return (
    <div className="space-y-4">
      <ClinicalDemoPatientContextHeader />
      <Card className="space-y-2">
        <CardTitle>Avaliações do usuário vinculado</CardTitle>
        <CardDescription>Histórico orientativo com reavaliação preventiva.</CardDescription>
        <div className="space-y-2 text-sm">
          <article className="rounded-lg border p-2">
            <p className="font-semibold">Avaliação inicial — versão 1.0</p>
            <p>Data: 29/07/2026 • Profissional: Dr. Lucas Demo • Status: Concluída</p>
            <p>Resultado orientativo: acompanhamento preventivo recomendado.</p>
            <Button size="sm" className="mt-2" variant="outline">Ver detalhes</Button>
          </article>
          <article className="rounded-lg border p-2">
            <p className="font-semibold">Reavaliação de rotina — versão 1.0</p>
            <p>Data prevista: 26/08/2026 • Status: Programada</p>
          </article>
        </div>
      </Card>
    </div>
  );
}

export function ClinicalCarePlanPage() {
  const [items, setItems] = useState([
    {
      id: 'plan-1',
      objetivo: 'Melhorar rotina de sono',
      status: 'Em andamento',
      prazo: '26/08/2026',
      reavaliacao: '30/08/2026',
    },
  ]);

  return (
    <div className="space-y-4">
      <ClinicalDemoPatientContextHeader />
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Plano de cuidado</CardTitle>
          <Button size="sm" onClick={() => setItems((current) => [...current, { id: `plan-${current.length + 1}`, objetivo: 'Aumentar frequência de movimento', status: 'Planejado', prazo: '15/09/2026', reavaliacao: '20/09/2026' }])}>
            Adicionar objetivo
          </Button>
        </div>
        <CardDescription>Objetivos, ações, responsável e reavaliação.</CardDescription>
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border p-3 text-sm">
            <p className="font-semibold">{item.objetivo}</p>
            <p className="text-[var(--muted-foreground)]">Responsável: equipe clínica demo</p>
            <p>Status: {item.status} • Prazo: {item.prazo}</p>
            <p>Reavaliação: {item.reavaliacao}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline">Editar</Button>
              <Button size="sm" variant="secondary">Atualizar status</Button>
              <Button size="sm" variant="outline">Registrar evolução</Button>
            </div>
          </article>
        ))}
      </Card>
    </div>
  );
}

export function ClinicalAttendanceRecordPage() {
  const [records, setRecords] = useState([
    {
      id: 'reg-1',
      data: '29/07/2026 09:00',
      profissional: 'Dr. Lucas Demo',
      tipo: 'Acompanhamento preventivo',
      resumo: 'Reforço de rotina de sono e hidratação.',
      proximaAcao: 'Reavaliação em 30 dias',
      status: 'Concluído',
    },
  ]);

  return (
    <div className="space-y-4">
      <ClinicalDemoPatientContextHeader />
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Registros assistenciais</CardTitle>
          <Button size="sm" onClick={() => setRecords((prev) => [{ id: `reg-${prev.length + 1}`, data: 'Hoje 15:30', profissional: 'Carla Profissional', tipo: 'Contato de acompanhamento', resumo: 'Orientação sobre organização de rotina.', proximaAcao: 'Retorno em 15 dias', status: 'Em andamento' }, ...prev])}>
            Novo registro
          </Button>
        </div>
        <CardDescription>Linha do tempo demonstrativa sem conteúdo sensível real.</CardDescription>
        <div className="space-y-2">
          {records.map((record) => (
            <article key={record.id} className="rounded-xl border p-3 text-sm">
              <p className="font-semibold">{record.data} • {record.tipo}</p>
              <p>{record.resumo}</p>
              <p className="text-[var(--muted-foreground)]">Profissional: {record.profissional}</p>
              <p>Próxima ação: {record.proximaAcao}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className={`status-badge ${record.status === 'Concluído' ? 'status-success' : 'status-warning'}`}>{record.status}</span>
                <Button size="sm" variant="outline">Ver registro</Button>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-[var(--secondary)] p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function useClinicalPortfolio() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<ClinicalPortfolioPatient[]>([]);
  const requestIdRef = useRef(0);

  const repositoryConfig = useMemo(() => {
    try {
      const mode = resolveClinicalPortfolioRepositoryMode(import.meta.env);
      if (mode === 'supabase') {
        return {
          mode,
          repository: createClinicalPortfolioRepositoryFactory({
            mode: 'supabase',
            supabaseClient: getSupabaseClient() as unknown as SupabaseClinicalPortfolioClient,
          }),
        };
      }
      return {
        mode,
        repository: createClinicalPortfolioRepositoryFactory({ mode: 'mock' }),
      };
    } catch {
      return { mode: 'mock' as const, repository: null };
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    if (!user || !repositoryConfig.repository) {
      setLoading(false);
      setPatients([]);
      setError('Nao foi possivel carregar a carteira clinica neste momento.');
      return;
    }

    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setPatients([]);
    void loadLinkedClinicalPortfolio(repositoryConfig.repository, {
      sessionUserId: user.id,
      professionalUserId: user.id,
      organizationId: user.organizationId,
    }).then((result) => {
      if (disposed || currentRequest !== requestIdRef.current) return;
      setLoading(false);
      if (!result.ok) {
        setPatients([]);
        if (result.error.code === 'CLINICAL_ACCESS_DENIED' || result.error.code === 'CROSS_TENANT_DATA') {
          setError('Acesso clinico nao autorizado para a carteira.');
          return;
        }
        if (result.error.code === 'NO_SESSION' || result.error.code === 'IDENTITY_MISMATCH') {
          setError('Sessao clinica ausente ou invalida.');
          return;
        }
        setError('Nao foi possivel carregar a carteira clinica neste momento.');
        return;
      }
      setPatients(result.data);
      setError(null);
    });

    return () => {
      disposed = true;
    };
  }, [user, repositoryConfig]);

  return { patients, loading, error };
}

function useClinicalAgenda() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<ClinicalAppointment[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const requestIdRef = useRef(0);

  const repositoryConfig = useMemo(() => {
    try {
      const mode = resolveClinicalAgendaRepositoryMode(import.meta.env);
      if (mode === 'supabase') {
        return {
          mode,
          repository: createClinicalAgendaRepositoryFactory({
            mode: 'supabase',
            supabaseClient: getSupabaseClient() as unknown as SupabaseClinicalAgendaClient,
          }),
        };
      }
      return {
        mode,
        repository: createClinicalAgendaRepositoryFactory({ mode: 'mock' }),
      };
    } catch {
      return { mode: 'mock' as const, repository: null };
    }
  }, []);

  const context: ClinicalAgendaContext | null = user
    ? {
        sessionUserId: user.id,
        professionalUserId: user.id,
        organizationId: user.organizationId,
      }
    : null;

  useEffect(() => {
    let disposed = false;
    if (!user || !repositoryConfig.repository || !context) {
      setLoading(false);
      setAppointments([]);
      setError('Nao foi possivel carregar a agenda clinica neste momento.');
      return;
    }

    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setAppointments([]);
    void loadLinkedClinicalAgenda(repositoryConfig.repository, context).then((result) => {
      if (disposed || currentRequest !== requestIdRef.current) return;
      setLoading(false);
      if (!result.ok) {
        setAppointments([]);
        if (result.error.code === 'CLINICAL_ACCESS_DENIED' || result.error.code === 'CROSS_TENANT_DATA') {
          setError('Acesso clinico nao autorizado para a agenda.');
          return;
        }
        if (result.error.code === 'NO_SESSION' || result.error.code === 'IDENTITY_MISMATCH') {
          setError('Sessao clinica ausente ou invalida.');
          return;
        }
        setError('Nao foi possivel carregar a agenda clinica neste momento.');
        return;
      }
      setAppointments(result.data);
      setError(null);
    });

    return () => {
      disposed = true;
    };
  }, [user, repositoryConfig, reloadToken, context?.organizationId, context?.professionalUserId, context?.sessionUserId]);

  return {
    appointments,
    loading,
    error,
    repository: repositoryConfig.repository,
    context,
    refresh: () => {
      setReloadToken((value) => value + 1);
      return Promise.resolve();
    },
  };
}

function resolveAgendaPatientName(patientId: string, patients: ClinicalPortfolioPatient[]): string {
  return patients.find((item) => item.patientId === patientId)?.displayName ?? displayNameForAgendaPatient(patientId);
}

function appointmentStatusLabel(status: ClinicalAppointmentStatus): string {
  switch (status) {
    case 'solicitado':
      return 'Solicitado';
    case 'confirmado':
      return 'Confirmado';
    case 'concluido':
      return 'Concluído';
    case 'cancelado':
      return 'Cancelado';
    case 'ausencia':
      return 'Ausência';
  }
}

function appointmentTypeLabel(type: ClinicalAppointmentType): string {
  switch (type) {
    case 'preventiva':
      return 'Consulta preventiva';
    case 'reavaliacao':
      return 'Reavaliação';
    case 'acompanhamento':
      return 'Acompanhamento';
  }
}

function appointmentStatusBadgeClass(status: ClinicalAppointmentStatus): string {
  if (status === 'concluido') return 'status-success';
  if (status === 'confirmado') return 'status-warning';
  if (status === 'cancelado' || status === 'ausencia') return 'status-warning';
  return 'status-info';
}

function formatAppointmentTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function isSameLocalDay(iso: string, reference: Date): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

/** Header da carteira/overview: somente paciente autorizado da carteira persistida. */
function ClinicalPatientContextHeader({
  patient,
}: {
  patient: ClinicalPortfolioPatient | null;
}) {
  return (
    <Card className="space-y-2" data-testid="clinical-patient-context-header">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {patient ? (
            <>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Paciente vinculado
              </p>
              <h3 className="text-lg font-semibold" data-testid="clinical-patient-context-name">
                {patient.displayName}
              </h3>
              <p
                className="text-sm text-[var(--muted-foreground)]"
                data-testid="clinical-patient-context-status"
              >
                Vínculo: {patient.assignmentStatus}
              </p>
            </>
          ) : (
            <h3
              className="text-lg font-semibold"
              data-testid="clinical-patient-context-empty"
            >
              Nenhum paciente selecionado
            </h3>
          )}
        </div>
        {patient ? (
          <span className="status-badge status-info" data-testid="clinical-patient-context-badge">
            {patient.assignmentStatus}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <NavLink to="/clinica" className={tabLinkClass}>Resumo</NavLink>
        <NavLink to="/clinica/avaliacoes" className={tabLinkClass}>Avaliações</NavLink>
        <NavLink to="/clinica/ficha" className={tabLinkClass}>Ficha clínica</NavLink>
        <NavLink to="/clinica/plano-cuidado" className={tabLinkClass}>Plano de cuidado</NavLink>
        <NavLink to="/clinica/registros" className={tabLinkClass}>Registros</NavLink>
      </div>
    </Card>
  );
}

/** Chrome demonstrativo isolado (ficha/plano/avaliacoes/registros ainda ficticios). */
function ClinicalDemoPatientContextHeader() {
  return (
    <Card className="space-y-2" data-testid="clinical-demo-patient-context-header">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Dados fictícios</p>
          <h3 className="text-lg font-semibold">Ana Demo • Faixa etária 35-44</h3>
          <p className="text-sm text-[var(--muted-foreground)]">ID demonstrativo: BM-CLI-001</p>
        </div>
        <span className="status-badge status-info">Acompanhamento ativo</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <NavLink to="/clinica" className={tabLinkClass}>Resumo</NavLink>
        <NavLink to="/clinica/avaliacoes" className={tabLinkClass}>Avaliações</NavLink>
        <NavLink to="/clinica/ficha" className={tabLinkClass}>Ficha clínica</NavLink>
        <NavLink to="/clinica/plano-cuidado" className={tabLinkClass}>Plano de cuidado</NavLink>
        <NavLink to="/clinica/registros" className={tabLinkClass}>Registros</NavLink>
      </div>
    </Card>
  );
}

function ClinicalPatientJourneyPanel({
  patientUserId,
  patientName,
}: {
  patientUserId: string;
  patientName: string;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const repositoryConfig = useMemo(() => {
    try {
      const mode = resolveJourneyRepositoryMode(import.meta.env);
      if (mode === 'supabase') {
        return {
          mode,
          repository: createJourneyRepositoryFactory({
            mode: 'supabase',
            supabaseClient: getSupabaseClient() as unknown as SupabaseJourneyClient,
          }),
        };
      }
      return {
        mode,
        repository: createJourneyRepositoryFactory({ mode: 'mock' }),
      };
    } catch {
      return { mode: 'mock' as const, repository: null, configError: true };
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    setLabel(null);
    setDetail(null);
    setError(null);
    if (!user || !repositoryConfig.repository) {
      setLoading(false);
      setError('Nao foi possivel carregar a jornada clinica neste momento.');
      return;
    }

    setLoading(true);
    void loadLinkedPatientJourneyViews(repositoryConfig.repository, {
      sessionUserId: user.id,
      professionalUserId: user.id,
      organizationId: user.organizationId,
      patientUserId,
    }).then((result) => {
      if (disposed) return;
      setLoading(false);
      if (!result.ok) {
        setLabel(null);
        setDetail(null);
        if (result.error.code === 'CLINICAL_ACCESS_DENIED' || result.error.code === 'CROSS_TENANT_DATA') {
          setError('Acesso clinico nao autorizado para este usuario.');
          return;
        }
        setError('Nao foi possivel carregar a jornada clinica neste momento.');
        return;
      }
      const summary = summarizeClinicalJourneyViews(result.data);
      setLabel(summary.label);
      setDetail(summary.detail);
      setError(null);
    });

    return () => {
      disposed = true;
    };
  }, [user, patientUserId, repositoryConfig]);

  return (
    <div className="mt-1 space-y-1 text-sm" data-testid={`clinical-journey-${patientUserId}`}>
      <p className="font-medium">Jornada de {patientName}</p>
      {loading ? <p className="text-[var(--muted-foreground)]">Carregando jornada persistida...</p> : null}
      {!loading && error ? <p className="text-red-600">{error}</p> : null}
      {!loading && !error && label ? (
        <>
          <p data-testid={`clinical-journey-label-${patientUserId}`}>{label}</p>
          {detail ? (
            <p className="text-[var(--muted-foreground)]" data-testid={`clinical-journey-detail-${patientUserId}`}>
              {detail}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function tabLinkClass({ isActive }: { isActive: boolean }) {
  return `focus-ring rounded-lg px-3 py-1 text-sm ${
    isActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--secondary)] text-[var(--secondary-foreground)]'
  }`;
}
