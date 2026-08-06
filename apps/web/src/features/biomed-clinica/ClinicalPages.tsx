import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import {
  loadLinkedClinicalAgenda,
  updateLinkedClinicalAppointment,
} from '@/domains/clinicalAgenda/clinicalAgendaService';
import { loadLinkedClinicalPortfolio } from '@/domains/clinicalPortfolio/clinicalPortfolioService';
import {
  concludeLinkedClinicalRecord,
  loadClinicalRecordHistory,
  loadLinkedClinicalRecord,
  reopenLinkedClinicalRecord,
  saveLinkedClinicalRecordDraft,
} from '@/domains/clinicalRecord/clinicalRecordService';
import {
  addLinkedCarePlanNote,
  closeLinkedCarePlan,
  createLinkedCarePlan,
  createLinkedCarePlanAction,
  listLinkedCarePlans,
  loadOpenCarePlan,
  updateLinkedCarePlan,
  updateLinkedCarePlanAction,
} from '@/domains/carePlan/carePlanService';
import {
  loadLinkedPatientJourneyViews,
  summarizeClinicalJourneyViews,
} from '@/domains/journey/journeyService';
import {
  createNoopClinicalAuditSink,
  createPersistingClinicalAuditSink,
} from '@/domains/clinical/clinicalAuditSink';
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
  createClinicalRecordRepositoryFactory,
  resolveClinicalRecordRepositoryMode,
} from '@/services/repositories/clinicalRecord/factory';
import {
  createCarePlanRepositoryFactory,
  resolveCarePlanRepositoryMode,
} from '@/services/repositories/carePlan/factory';
import type { SupabaseCarePlanClient } from '@/services/repositories/carePlan/supabaseCarePlanRepository';
import type {
  CarePlan,
  CarePlanAction,
  CarePlanBundle,
  CarePlanContext,
} from '@/services/repositories/carePlan/types';
import {
  CLINICAL_RECORD_SECTION_DEFINITIONS,
  CLINICAL_RECORD_SCHEMA_VERSION,
  emptyClinicalRecordSections,
  mergeClinicalRecordSections,
  type ClinicalRecordSections,
} from '@/services/repositories/clinicalRecord/schema';
import type { SupabaseClinicalRecordClient } from '@/services/repositories/clinicalRecord/supabaseClinicalRecordRepository';
import type {
  ClinicalRecord,
  ClinicalRecordContext,
  ClinicalRecordVersion,
} from '@/services/repositories/clinicalRecord/types';
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
  const { patients, loading: portfolioLoading, error: portfolioError } = useClinicalPortfolio();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const {
    record,
    versions,
    sections,
    setSections,
    loading,
    error,
    message,
    editing,
    setEditing,
    saveDraft,
    conclude,
    reopen,
    busy,
  } = useClinicalRecord(selectedPatientId);

  useEffect(() => {
    if (portfolioLoading) {
      setSelectedPatientId(null);
      return;
    }
    if (portfolioError || patients.length === 0) {
      setSelectedPatientId(null);
      return;
    }
    setSelectedPatientId((current) =>
      current && patients.some((item) => item.patientId === current) ? current : patients[0].patientId
    );
  }, [portfolioLoading, portfolioError, patients]);

  const selectedPatient =
    !portfolioLoading && !portfolioError && selectedPatientId
      ? (patients.find((item) => item.patientId === selectedPatientId) ?? null)
      : null;

  const activeSections = CLINICAL_RECORD_SECTION_DEFINITIONS.filter((item) => item.active);
  const concluded = record?.recordStatus === 'concluido';
  const canEdit = Boolean(selectedPatient) && !loading && !error && !concluded;

  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader patient={selectedPatient} />
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Ficha clínica</CardTitle>
            <CardDescription>
              Modelo {CLINICAL_RECORD_SCHEMA_VERSION}
              {record ? ` • revisão ${record.revisionNumber}` : ''}
              {record?.updatedAt ? ` • atualizada em ${formatDateTime(record.updatedAt)}` : ''}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {!concluded ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canEdit || busy}
                  onClick={() => setEditing((value) => !value)}
                  data-testid="clinical-record-toggle-edit"
                >
                  {editing ? 'Visualizar' : 'Editar ficha'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canEdit || busy}
                  onClick={() => void saveDraft()}
                  data-testid="clinical-record-save-draft"
                >
                  Salvar rascunho
                </Button>
                <Button
                  size="sm"
                  disabled={!canEdit || busy || !record}
                  onClick={() => void conclude()}
                  data-testid="clinical-record-conclude"
                >
                  Concluir registro
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={busy || !record}
                onClick={() => void reopen()}
                data-testid="clinical-record-reopen"
              >
                Nova versão
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-[var(--muted-foreground)]" data-testid="clinical-record-validation-note">
          Estrutura clínica em validação — sujeita a aprimoramentos.
        </p>

        {patients.length > 1 ? (
          <label className="block text-sm">
            <span className="text-[var(--muted-foreground)]">Paciente vinculado</span>
            <select
              className="focus-ring mt-1 h-10 w-full rounded-xl border px-3"
              value={selectedPatientId ?? ''}
              onChange={(event) => setSelectedPatientId(event.target.value)}
              data-testid="clinical-record-patient-select"
            >
              {patients.map((patient) => (
                <option key={patient.patientId} value={patient.patientId}>
                  {patient.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {portfolioLoading || loading ? (
          <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-record-loading">
            Carregando ficha clínica...
          </p>
        ) : null}
        {!portfolioLoading && portfolioError ? (
          <p className="text-sm text-red-600" data-testid="clinical-record-portfolio-error">
            {portfolioError}
          </p>
        ) : null}
        {!loading && error ? (
          <p className="text-sm text-red-600" data-testid="clinical-record-error">
            {error}
          </p>
        ) : null}
        {!portfolioLoading && !portfolioError && patients.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-record-empty-portfolio">
            Nenhum paciente vinculado para abrir a ficha.
          </p>
        ) : null}
        {!loading && !error && selectedPatient && !record ? (
          <p className="text-sm text-[var(--muted-foreground)]" data-testid="clinical-record-empty">
            Nenhuma ficha persistida ainda. Edite as seções e salve o rascunho inicial.
          </p>
        ) : null}

        {!loading && !error && selectedPatient ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeSections.map((definition) => {
              const value = sections[definition.key]?.value ?? '';
              return (
                <section key={definition.key} className="rounded-xl border p-3 text-sm">
                  <p className="font-semibold">
                    {definition.label}
                    {definition.requiredForConclusion ? (
                      <span className="ml-1 text-xs font-normal text-[var(--muted-foreground)]">(obrigatório na conclusão)</span>
                    ) : null}
                  </p>
                  {editing && !concluded ? (
                    <textarea
                      className="focus-ring mt-2 min-h-20 w-full rounded-lg border p-2"
                      value={value}
                      onChange={(event) =>
                        setSections((current) => ({
                          ...current,
                          [definition.key]: { value: event.target.value },
                        }))
                      }
                      data-testid={`clinical-record-field-${definition.key}`}
                    />
                  ) : (
                    <p className="mt-1 text-[var(--muted-foreground)]">
                      {value.trim() ? value : 'Não informado'}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        ) : null}

        {message ? (
          <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm" data-testid="clinical-record-message">
            {message}
          </p>
        ) : null}

        {record && versions.length > 0 ? (
          <div className="space-y-2" data-testid="clinical-record-history">
            <p className="text-sm font-semibold">Histórico de versões</p>
            <ul className="space-y-1 text-sm text-[var(--muted-foreground)]">
              {versions.slice(0, 8).map((version) => (
                <li key={version.id} data-testid={`clinical-record-history-item-${version.id}`}>
                  {formatDateTime(version.createdAt)} • {version.changeKind} • revisão {version.revisionNumber} •{' '}
                  {version.recordStatus} • {version.schemaVersion}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
  const { patients, loading: portfolioLoading, error: portfolioError } = useClinicalPortfolio();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const carePlan = useCarePlan(selectedPatientId);

  useEffect(() => {
    if (portfolioLoading) {
      setSelectedPatientId(null);
      return;
    }
    if (portfolioError || patients.length === 0) {
      setSelectedPatientId(null);
      return;
    }
    setSelectedPatientId((current) =>
      current && patients.some((item) => item.patientId === current) ? current : patients[0].patientId
    );
  }, [portfolioLoading, portfolioError, patients]);

  const selectedPatient =
    !portfolioLoading && !portfolioError && selectedPatientId
      ? (patients.find((item) => item.patientId === selectedPatientId) ?? null)
      : null;

  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader patient={selectedPatient} />
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Plano de cuidado</CardTitle>
            <CardDescription>Objetivos, ações, prazos, reavaliações e evoluções persistidas.</CardDescription>
          </div>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]" data-testid="care-plan-validation-note">
          Estrutura clínica sujeita a aprimoramentos futuros.
        </p>

        {patients.length > 1 ? (
          <label className="block text-sm">
            <span className="text-[var(--muted-foreground)]">Paciente vinculado</span>
            <select
              className="focus-ring mt-1 h-10 w-full rounded-xl border px-3"
              value={selectedPatientId ?? ''}
              onChange={(event) => setSelectedPatientId(event.target.value)}
              data-testid="care-plan-patient-select"
            >
              {patients.map((patient) => (
                <option key={patient.patientId} value={patient.patientId}>
                  {patient.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {portfolioLoading || carePlan.loading ? (
          <p className="text-sm text-[var(--muted-foreground)]" data-testid="care-plan-loading">
            Carregando plano de cuidado...
          </p>
        ) : null}
        {!portfolioLoading && portfolioError ? (
          <p className="text-sm text-red-600" data-testid="care-plan-portfolio-error">
            {portfolioError}
          </p>
        ) : null}
        {!carePlan.loading && carePlan.error ? (
          <p className="text-sm text-red-600" data-testid="care-plan-error">
            {carePlan.error}
          </p>
        ) : null}
        {!portfolioLoading && !portfolioError && patients.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]" data-testid="care-plan-empty-portfolio">
            Nenhum paciente vinculado para abrir o plano.
          </p>
        ) : null}

        {!carePlan.loading && !carePlan.error && selectedPatient && !carePlan.openBundle ? (
          <div className="space-y-3" data-testid="care-plan-create-panel">
            <p className="text-sm text-[var(--muted-foreground)]">Nenhum plano ativo. Crie o plano inicial.</p>
            <input
              className="focus-ring h-10 w-full rounded-xl border px-3 text-sm"
              placeholder="Título do plano"
              value={carePlan.draftTitle}
              onChange={(event) => carePlan.setDraftTitle(event.target.value)}
              data-testid="care-plan-draft-title"
            />
            <textarea
              className="focus-ring min-h-20 w-full rounded-xl border p-2 text-sm"
              placeholder="Objetivo geral"
              value={carePlan.draftObjective}
              onChange={(event) => carePlan.setDraftObjective(event.target.value)}
              data-testid="care-plan-draft-objective"
            />
            <Button size="sm" disabled={carePlan.busy} onClick={() => void carePlan.createPlan()} data-testid="care-plan-create">
              Criar plano
            </Button>
          </div>
        ) : null}

        {carePlan.openBundle ? (
          <div className="space-y-3" data-testid="care-plan-active-panel">
            <div className="rounded-xl border p-3 text-sm space-y-2">
              <p className="font-semibold" data-testid="care-plan-active-title">
                {carePlan.openBundle.plan.title}
              </p>
              <p className="text-[var(--muted-foreground)]">{carePlan.openBundle.plan.generalObjective}</p>
              <p>
                Status: {carePlan.openBundle.plan.planStatus} • versão {carePlan.openBundle.plan.version}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Atualizado em {formatDateTime(carePlan.openBundle.plan.updatedAt)}
                {carePlan.openBundle.plan.updatedBy ? ` • por ${carePlan.openBundle.plan.updatedBy}` : ''}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="focus-ring h-10 rounded-xl border px-3 text-sm"
                  value={carePlan.editTitle}
                  onChange={(event) => carePlan.setEditTitle(event.target.value)}
                  aria-label="Editar título do plano"
                  data-testid="care-plan-edit-title"
                />
                <input
                  className="focus-ring h-10 rounded-xl border px-3 text-sm"
                  value={carePlan.editObjective}
                  onChange={(event) => carePlan.setEditObjective(event.target.value)}
                  aria-label="Editar objetivo geral"
                  data-testid="care-plan-edit-objective"
                />
              </div>
              <Button size="sm" variant="outline" disabled={carePlan.busy} onClick={() => void carePlan.savePlan()} data-testid="care-plan-save">
                Salvar alterações do plano
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Ações</p>
              {carePlan.openBundle.actions.map((action) => (
                <article key={action.id} className="rounded-xl border p-3 text-sm" data-testid={`care-plan-action-${action.id}`}>
                  <p className="font-semibold">{action.specificObjective}</p>
                  <p>{action.actionText}</p>
                  <p className="text-[var(--muted-foreground)]">
                    {action.frequency} • {action.actionStatus}
                    {action.dueDate ? ` • prazo ${action.dueDate}` : ''}
                    {action.completedAt ? ` • concluída em ${formatDateTime(action.completedAt)}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={carePlan.busy}
                      onClick={() => carePlan.beginEditAction(action)}
                      data-testid={`care-plan-action-edit-${action.id}`}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={carePlan.busy || action.actionStatus === 'concluida' || action.actionStatus === 'cancelada'}
                      onClick={() => void carePlan.advanceAction(action)}
                      data-testid={`care-plan-action-advance-${action.id}`}
                    >
                      Atualizar status
                    </Button>
                  </div>
                </article>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="focus-ring h-10 rounded-xl border px-3 text-sm"
                  placeholder="Objetivo da ação"
                  value={carePlan.actionObjective}
                  onChange={(event) => carePlan.setActionObjective(event.target.value)}
                  data-testid="care-plan-action-objective"
                />
                <input
                  className="focus-ring h-10 rounded-xl border px-3 text-sm"
                  placeholder="Descrição da ação"
                  value={carePlan.actionText}
                  onChange={(event) => carePlan.setActionText(event.target.value)}
                  data-testid="care-plan-action-text"
                />
                <input
                  className="focus-ring h-10 rounded-xl border px-3 text-sm"
                  placeholder="Frequência"
                  value={carePlan.actionFrequency}
                  onChange={(event) => carePlan.setActionFrequency(event.target.value)}
                  data-testid="care-plan-action-frequency"
                />
                <Button size="sm" disabled={carePlan.busy} onClick={() => void carePlan.addAction()} data-testid="care-plan-action-add">
                  {carePlan.editingActionId ? 'Salvar ação' : 'Adicionar ação'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                className="focus-ring min-h-16 w-full rounded-xl border p-2 text-sm"
                placeholder="Registrar evolução clínica"
                value={carePlan.noteText}
                onChange={(event) => carePlan.setNoteText(event.target.value)}
                data-testid="care-plan-note-text"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={carePlan.busy} onClick={() => void carePlan.addNote('evolution')} data-testid="care-plan-add-evolution">
                  Registrar evolução
                </Button>
                <Button size="sm" variant="outline" disabled={carePlan.busy} onClick={() => void carePlan.addNote('reassessment')} data-testid="care-plan-add-reassessment">
                  Registrar reavaliação
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={carePlan.busy} onClick={() => void carePlan.closePlan('conclude')} data-testid="care-plan-conclude">
                Concluir plano
              </Button>
              <input
                className="focus-ring h-9 min-w-56 rounded-xl border px-3 text-sm"
                placeholder="Motivo da suspensão"
                value={carePlan.suspendReason}
                onChange={(event) => carePlan.setSuspendReason(event.target.value)}
                data-testid="care-plan-suspend-reason"
              />
              <Button size="sm" variant="secondary" disabled={carePlan.busy} onClick={() => void carePlan.closePlan('suspend')} data-testid="care-plan-suspend">
                Suspender plano
              </Button>
            </div>

            <div className="space-y-1" data-testid="care-plan-history">
              <p className="text-sm font-semibold">Histórico</p>
              {carePlan.openBundle.events.slice(0, 10).map((event) => (
                <p key={event.id} className="text-sm text-[var(--muted-foreground)]" data-testid={`care-plan-history-item-${event.id}`}>
                  {formatDateTime(event.createdAt)} • {event.eventKind}
                  {event.authoredBy ? ` • ${event.authoredBy}` : ''}
                  {event.note ? ` • ${event.note}` : ''}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {carePlan.historyPlans.length > 0 ? (
          <div className="space-y-1" data-testid="care-plan-history-plans">
            <p className="text-sm font-semibold">Planos anteriores</p>
            {carePlan.historyPlans.map((plan) => (
              <p key={plan.id} className="text-sm text-[var(--muted-foreground)]">
                {plan.title} • {plan.planStatus} • v{plan.version}
              </p>
            ))}
          </div>
        ) : null}

        {carePlan.message ? (
          <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm" data-testid="care-plan-message">
            {carePlan.message}
          </p>
        ) : null}
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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
}

function useClinicalAuditSink() {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user?.organizationId) return createNoopClinicalAuditSink();
    return createPersistingClinicalAuditSink({
      actorEmail: user.email,
      actorRole: user.role,
      organizationId: user.organizationId,
    });
  }, [user]);
}

function useCarePlan(patientId: string | null) {
  const { user } = useAuth();
  const auditSink = useClinicalAuditSink();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [openBundle, setOpenBundle] = useState<CarePlanBundle | null>(null);
  const [historyPlans, setHistoryPlans] = useState<CarePlan[]>([]);
  const [draftTitle, setDraftTitle] = useState('Plano de acompanhamento');
  const [draftObjective, setDraftObjective] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editObjective, setEditObjective] = useState('');
  const [actionObjective, setActionObjective] = useState('');
  const [actionText, setActionText] = useState('');
  const [actionFrequency, setActionFrequency] = useState('diaria');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editingActionVersion, setEditingActionVersion] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const requestIdRef = useRef(0);

  const repositoryConfig = useMemo(() => {
    try {
      const mode = resolveCarePlanRepositoryMode(import.meta.env);
      if (mode === 'supabase') {
        return {
          repository: createCarePlanRepositoryFactory({
            mode: 'supabase',
            supabaseClient: getSupabaseClient() as unknown as SupabaseCarePlanClient,
          }),
        };
      }
      return { repository: createCarePlanRepositoryFactory({ mode: 'mock' }) };
    } catch {
      return { repository: null };
    }
  }, []);

  const context: CarePlanContext | null = user
    ? {
        sessionUserId: user.id,
        professionalUserId: user.id,
        organizationId: user.organizationId,
      }
    : null;

  async function refresh(currentPatientId: string) {
    if (!repositoryConfig.repository || !context) return;
    const [open, list] = await Promise.all([
      loadOpenCarePlan(repositoryConfig.repository, context, currentPatientId),
      listLinkedCarePlans(repositoryConfig.repository, context, currentPatientId),
    ]);
    if (!open.ok) {
      setOpenBundle(null);
      setError(
        open.error.code === 'CLINICAL_ACCESS_DENIED'
          ? 'Acesso clinico nao autorizado para o plano.'
          : open.error.code === 'PATIENT_NOT_IN_PORTFOLIO'
            ? 'Paciente fora da carteira clinica autorizada.'
            : 'Nao foi possivel carregar o plano de cuidado.'
      );
      return;
    }
    setOpenBundle(open.data);
    if (open.data) {
      setEditTitle(open.data.plan.title);
      setEditObjective(open.data.plan.generalObjective);
    } else {
      setEditTitle('');
      setEditObjective('');
    }
    if (list.ok) {
      setHistoryPlans(list.data.filter((item) => item.planStatus === 'concluido' || item.planStatus === 'suspenso'));
    } else {
      setHistoryPlans([]);
    }
    setError(null);
  }

  useEffect(() => {
    let disposed = false;
    if (!user || !repositoryConfig.repository || !context || !patientId) {
      setLoading(false);
      setOpenBundle(null);
      setHistoryPlans([]);
      setError(patientId ? 'Nao foi possivel carregar o plano de cuidado neste momento.' : null);
      return;
    }
    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setMessage('');
    setOpenBundle(null);
    void refresh(patientId).then(() => {
      if (disposed || currentRequest !== requestIdRef.current) return;
      setLoading(false);
    });
    return () => {
      disposed = true;
    };
  }, [user, repositoryConfig, patientId, context?.organizationId, context?.professionalUserId, context?.sessionUserId]);

  async function createPlan() {
    if (!repositoryConfig.repository || !context || !patientId) return;
    setBusy(true);
    setMessage('');
    const result = await createLinkedCarePlan(repositoryConfig.repository, context, {
      patientId,
      title: draftTitle,
      generalObjective: draftObjective,
      startsOn: new Date().toISOString().slice(0, 10),
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.code === 'OPEN_PLAN_EXISTS'
          ? 'Ja existe plano ativo para este paciente.'
          : result.error.code === 'VALIDATION_REQUIRED_FIELDS'
            ? 'Informe titulo e objetivo geral.'
            : 'Nao foi possivel criar o plano.'
      );
      return;
    }
    setMessage('Plano criado com rastreio historico.');
    await refresh(patientId);
  }

  async function savePlan() {
    if (!repositoryConfig.repository || !context || !openBundle || !patientId) return;
    setBusy(true);
    setMessage('');
    const result = await updateLinkedCarePlan(repositoryConfig.repository, context, {
      planId: openBundle.plan.id,
      expectedVersion: openBundle.plan.version,
      title: editTitle,
      generalObjective: editObjective,
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.code === 'VERSION_CONFLICT'
          ? 'Conflito de versao: recarregue o plano e tente novamente.'
          : result.error.code === 'PLAN_CLOSED'
            ? 'Plano encerrado nao pode ser editado.'
            : 'Nao foi possivel salvar o plano.'
      );
      return;
    }
    setMessage('Plano atualizado.');
    await refresh(patientId);
  }

  function beginEditAction(action: CarePlanAction) {
    setEditingActionId(action.id);
    setEditingActionVersion(action.version);
    setActionObjective(action.specificObjective);
    setActionText(action.actionText);
    setActionFrequency(action.frequency);
    setMessage('Edite a acao e salve.');
  }

  async function addAction() {
    if (!repositoryConfig.repository || !context || !openBundle || !patientId) return;
    setBusy(true);
    setMessage('');
    if (editingActionId && editingActionVersion != null) {
      const result = await updateLinkedCarePlanAction(repositoryConfig.repository, context, {
        actionId: editingActionId,
        expectedVersion: editingActionVersion,
        specificObjective: actionObjective,
        actionText,
        frequency: actionFrequency,
      }, auditSink);
      setBusy(false);
      if (!result.ok) {
        setMessage(
          result.error.code === 'VERSION_CONFLICT'
            ? 'Conflito de versao: recarregue o plano e tente novamente.'
            : result.error.code === 'PLAN_CLOSED'
              ? 'Plano encerrado nao pode receber acoes.'
              : 'Nao foi possivel salvar a acao.'
        );
        return;
      }
      setEditingActionId(null);
      setEditingActionVersion(null);
      setActionObjective('');
      setActionText('');
      setMessage('Acao atualizada.');
      await refresh(patientId);
      return;
    }

    const result = await createLinkedCarePlanAction(repositoryConfig.repository, context, {
      planId: openBundle.plan.id,
      specificObjective: actionObjective,
      actionText,
      frequency: actionFrequency,
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.code === 'PLAN_CLOSED'
          ? 'Plano encerrado nao pode receber acoes.'
          : 'Nao foi possivel adicionar a acao.'
      );
      return;
    }
    setActionObjective('');
    setActionText('');
    setMessage('Acao adicionada ao plano.');
    await refresh(patientId);
  }

  async function advanceAction(action: CarePlanAction) {
    if (!repositoryConfig.repository || !context || !patientId) return;
    const next =
      action.actionStatus === 'pendente'
        ? 'em_andamento'
        : action.actionStatus === 'em_andamento'
          ? 'concluida'
          : action.actionStatus;
    setBusy(true);
    setMessage('');
    const result = await updateLinkedCarePlanAction(repositoryConfig.repository, context, {
      actionId: action.id,
      expectedVersion: action.version,
      actionStatus: next,
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.code === 'VERSION_CONFLICT'
          ? 'Conflito de versao: recarregue o plano e tente novamente.'
          : 'Nao foi possivel atualizar o status da acao.'
      );
      return;
    }
    setMessage('Status da acao atualizado.');
    await refresh(patientId);
  }

  async function addNote(kind: 'evolution' | 'reassessment') {
    if (!repositoryConfig.repository || !context || !openBundle || !patientId) return;
    setBusy(true);
    setMessage('');
    const result = await addLinkedCarePlanNote(repositoryConfig.repository, context, {
      planId: openBundle.plan.id,
      note: noteText,
      kind,
      expectedPlanVersion: openBundle.plan.version,
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.code === 'VERSION_CONFLICT'
          ? 'Conflito de versao: recarregue o plano e tente novamente.'
          : 'Nao foi possivel registrar a anotacao clinica.'
      );
      return;
    }
    setNoteText('');
    setMessage(kind === 'evolution' ? 'Evolucao registrada.' : 'Reavaliacao registrada.');
    await refresh(patientId);
  }

  async function closePlan(mode: 'conclude' | 'suspend') {
    if (!repositoryConfig.repository || !context || !openBundle || !patientId) return;
    if (mode === 'suspend' && !suspendReason.trim()) {
      setMessage('Informe o motivo da suspensao.');
      return;
    }
    const confirmed = window.confirm(
      mode === 'conclude'
        ? 'Confirma a conclusao deste plano de cuidado? A operacao e historica e nao reabre o plano atual.'
        : 'Confirma a suspensao deste plano de cuidado? Informe o motivo e continue apenas se estiver certo.'
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage('');
    const result = await closeLinkedCarePlan(repositoryConfig.repository, context, {
      planId: openBundle.plan.id,
      expectedVersion: openBundle.plan.version,
      mode,
      suspensionReason: mode === 'suspend' ? suspendReason : undefined,
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.code === 'VALIDATION_REQUIRED_FIELDS'
          ? 'Informe o motivo da suspensao.'
          : result.error.code === 'VERSION_CONFLICT'
            ? 'Conflito de versao: recarregue o plano e tente novamente.'
            : 'Nao foi possivel encerrar o plano.'
      );
      return;
    }
    setSuspendReason('');
    setMessage(mode === 'conclude' ? 'Plano concluido.' : 'Plano suspenso.');
    await refresh(patientId);
  }

  return {
    loading,
    busy,
    error,
    message,
    openBundle,
    historyPlans,
    draftTitle,
    setDraftTitle,
    draftObjective,
    setDraftObjective,
    editTitle,
    setEditTitle,
    editObjective,
    setEditObjective,
    actionObjective,
    setActionObjective,
    actionText,
    setActionText,
    actionFrequency,
    setActionFrequency,
    editingActionId,
    noteText,
    setNoteText,
    suspendReason,
    setSuspendReason,
    createPlan,
    savePlan,
    beginEditAction,
    addAction,
    advanceAction,
    addNote,
    closePlan,
  };
}

function useClinicalRecord(patientId: string | null) {
  const { user } = useAuth();
  const auditSink = useClinicalAuditSink();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [record, setRecord] = useState<ClinicalRecord | null>(null);
  const [versions, setVersions] = useState<ClinicalRecordVersion[]>([]);
  const [sections, setSections] = useState<ClinicalRecordSections>(emptyClinicalRecordSections());
  const requestIdRef = useRef(0);

  const repositoryConfig = useMemo(() => {
    try {
      const mode = resolveClinicalRecordRepositoryMode(import.meta.env);
      if (mode === 'supabase') {
        return {
          mode,
          repository: createClinicalRecordRepositoryFactory({
            mode: 'supabase',
            supabaseClient: getSupabaseClient() as unknown as SupabaseClinicalRecordClient,
          }),
        };
      }
      return {
        mode,
        repository: createClinicalRecordRepositoryFactory({ mode: 'mock' }),
      };
    } catch {
      return { mode: 'mock' as const, repository: null };
    }
  }, []);

  const context: ClinicalRecordContext | null = user
    ? {
        sessionUserId: user.id,
        professionalUserId: user.id,
        organizationId: user.organizationId,
      }
    : null;

  useEffect(() => {
    let disposed = false;
    if (!user || !repositoryConfig.repository || !context || !patientId) {
      setLoading(false);
      setRecord(null);
      setVersions([]);
      setSections(emptyClinicalRecordSections());
      setError(patientId ? 'Nao foi possivel carregar a ficha clinica neste momento.' : null);
      return;
    }

    const currentRequest = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setMessage('');
    void loadLinkedClinicalRecord(repositoryConfig.repository, context, patientId).then(async (result) => {
      if (disposed || currentRequest !== requestIdRef.current) return;
      if (!result.ok) {
        setLoading(false);
        setRecord(null);
        setVersions([]);
        setSections(emptyClinicalRecordSections());
        if (result.error.code === 'CLINICAL_ACCESS_DENIED' || result.error.code === 'CROSS_TENANT_DATA') {
          setError('Acesso clinico nao autorizado para a ficha.');
          return;
        }
        if (result.error.code === 'PATIENT_NOT_IN_PORTFOLIO') {
          setError('Paciente fora da carteira clinica autorizada.');
          return;
        }
        if (result.error.code === 'NO_SESSION' || result.error.code === 'IDENTITY_MISMATCH') {
          setError('Sessao clinica ausente ou invalida.');
          return;
        }
        setError('Nao foi possivel carregar a ficha clinica neste momento.');
        return;
      }

      const loaded = result.data;
      setRecord(loaded);
      setSections(mergeClinicalRecordSections(loaded?.sections));
      setEditing(false);

      if (loaded) {
        const repository = repositoryConfig.repository;
        const history = await loadClinicalRecordHistory(repository, context, loaded.id);
        if (disposed || currentRequest !== requestIdRef.current) return;
        if (history.ok) setVersions(history.data);
        else setVersions([]);
      } else {
        setVersions([]);
      }
      setLoading(false);
      setError(null);
    });

    return () => {
      disposed = true;
    };
  }, [user, repositoryConfig, patientId, context?.organizationId, context?.professionalUserId, context?.sessionUserId]);

  async function saveDraft() {
    if (!repositoryConfig.repository || !context || !patientId) return;
    setBusy(true);
    setMessage('');
    const result = await saveLinkedClinicalRecordDraft(repositoryConfig.repository, context, {
      patientId,
      recordId: record?.id,
      sections,
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.code === 'RECORD_CONCLUDED'
          ? 'Ficha concluida nao pode ser editada.'
          : 'Nao foi possivel salvar o rascunho da ficha.'
      );
      return;
    }
    setRecord(result.data);
    setSections(mergeClinicalRecordSections(result.data.sections));
    setEditing(false);
    const history = await loadClinicalRecordHistory(repositoryConfig.repository, context, result.data.id);
    if (history.ok) setVersions(history.data);
    setMessage('Rascunho salvo com rastreio de versao.');
  }

  async function conclude() {
    if (!repositoryConfig.repository || !context || !record) return;
    setBusy(true);
    setMessage('');
    const result = await concludeLinkedClinicalRecord(repositoryConfig.repository, context, {
      recordId: record.id,
      sections,
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.code === 'VALIDATION_REQUIRED_FIELDS'
          ? 'Preencha os campos obrigatorios antes de concluir.'
          : 'Nao foi possivel concluir a ficha clinica.'
      );
      return;
    }
    setRecord(result.data);
    setSections(mergeClinicalRecordSections(result.data.sections));
    setEditing(false);
    const history = await loadClinicalRecordHistory(repositoryConfig.repository, context, result.data.id);
    if (history.ok) setVersions(history.data);
    setMessage('Ficha concluida com autoria e timestamp.');
  }

  async function reopen() {
    if (!repositoryConfig.repository || !context || !record) return;
    setBusy(true);
    setMessage('');
    const result = await reopenLinkedClinicalRecord(repositoryConfig.repository, context, {
      recordId: record.id,
    }, auditSink);
    setBusy(false);
    if (!result.ok) {
      setMessage('Nao foi possivel abrir nova versao da ficha.');
      return;
    }
    setRecord(result.data);
    setSections(mergeClinicalRecordSections(result.data.sections));
    setEditing(true);
    const history = await loadClinicalRecordHistory(repositoryConfig.repository, context, result.data.id);
    if (history.ok) setVersions(history.data);
    setMessage(`Nova revisao ${result.data.revisionNumber} aberta sem sobrescrita do historico.`);
  }

  return {
    record,
    versions,
    sections,
    setSections,
    loading,
    error,
    message,
    editing,
    setEditing,
    saveDraft,
    conclude,
    reopen,
    busy,
  };
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
