import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicalAgendaPage, ClinicalOverviewPage } from '@/features/biomed-clinica/ClinicalPages';
import { AuthProvider } from '@/services/auth/AuthContext';
import type { ClinicalAppointment } from '@/services/repositories/clinicalAgenda/types';

function localSlot(hours: number, minutes: number) {
  const start = new Date();
  start.setHours(hours, minutes, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

const slot1 = localSlot(9, 0);
const slot2 = localSlot(11, 0);
const slot3 = localSlot(14, 30);

let agendaResult:
  | { ok: true; data: ClinicalAppointment[] }
  | { ok: false; error: { code: string } } = {
  ok: true,
  data: [
    {
      id: 'appt-demo-1',
      organizationId: 'org-1',
      unitId: 'unit-org-1',
      patientId: 'usr-1',
      professionalId: 'pro-1',
      startsAt: slot1.startsAt,
      endsAt: slot1.endsAt,
      appointmentStatus: 'confirmado',
      appointmentType: 'reavaliacao',
      status: 'ativo',
    },
    {
      id: 'appt-demo-2',
      organizationId: 'org-1',
      unitId: 'unit-org-1',
      patientId: 'usr-3',
      professionalId: 'pro-1',
      startsAt: slot2.startsAt,
      endsAt: slot2.endsAt,
      appointmentStatus: 'solicitado',
      appointmentType: 'reavaliacao',
      status: 'ativo',
    },
    {
      id: 'appt-demo-3',
      organizationId: 'org-1',
      unitId: 'unit-org-1',
      patientId: 'usr-4',
      professionalId: 'pro-1',
      startsAt: slot3.startsAt,
      endsAt: slot3.endsAt,
      appointmentStatus: 'concluido',
      appointmentType: 'acompanhamento',
      status: 'ativo',
    },
  ],
};

const listLinkedClinicalAppointmentsMock = vi.fn(() => Promise.resolve(agendaResult));
const updateClinicalAppointmentMock = vi.fn(({ appointment }: { appointment: { appointmentId: string } }) => {
  const current = agendaResult.ok
    ? agendaResult.data.find((item) => item.id === appointment.appointmentId)
    : undefined;
  if (!current) return Promise.resolve({ ok: false as const, error: { code: 'NOT_FOUND' } });
  const updated = { ...current, appointmentStatus: 'confirmado' as const };
  if (agendaResult.ok) {
    agendaResult = {
      ok: true,
      data: agendaResult.data.map((item) => (item.id === updated.id ? updated : item)),
    };
  }
  return Promise.resolve({ ok: true as const, data: updated });
});

vi.mock('@/services/repositories/clinicalAgenda/factory', () => ({
  resolveClinicalAgendaRepositoryMode: () => 'mock',
  createClinicalAgendaRepositoryFactory: () => ({
    listLinkedClinicalAppointments: () => listLinkedClinicalAppointmentsMock(),
    createClinicalAppointment: () => Promise.resolve({ ok: false, error: { code: 'TECHNICAL_ERROR' } }),
    updateClinicalAppointment: (input: { appointment: { appointmentId: string } }) =>
      updateClinicalAppointmentMock(input),
  }),
}));

vi.mock('@/services/repositories/clinicalPortfolio/factory', () => ({
  resolveClinicalPortfolioRepositoryMode: () => 'mock',
  createClinicalPortfolioRepositoryFactory: () => ({
    listLinkedClinicalPatients: () =>
      Promise.resolve({
      ok: true,
      data: [
        {
          patientId: 'usr-1',
          displayName: 'Ana Demo',
          organizationId: 'org-1',
          unitId: 'unit-org-1',
      assignmentStatus: 'ativo',
          assignmentReason: 'acompanhamento',
        },
        {
          patientId: 'usr-3',
          displayName: 'Carlos Exemplo',
          organizationId: 'org-1',
          unitId: 'unit-org-1',
      assignmentStatus: 'ativo',
          assignmentReason: 'acompanhamento',
        },
        {
          patientId: 'usr-4',
          displayName: 'Elisa Fictícia',
          organizationId: 'org-1',
          unitId: 'unit-org-1',
      assignmentStatus: 'ativo',
          assignmentReason: 'acompanhamento',
        },
      ],
    }),
  }),
}));

vi.mock('@/services/repositories/journey/factory', () => ({
  resolveJourneyRepositoryMode: () => 'mock',
  createJourneyRepositoryFactory: () => ({
    listLinkedPatientJourneys: () => Promise.resolve({ ok: true, data: [] }),
  }),
}));

vi.mock('@/services/api/supabaseClient', () => ({
  getSupabaseClient: () => ({}),
  validateSupabaseConfiguration: () => null,
}));

function setClinicalSession() {
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: 'pro-1',
      nome: 'Dr. Persistido',
      email: 'medico.demo@biomed.health',
      role: 'medico',
      roles: ['medico'],
      organizationId: 'org-1',
    })
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/clinica', element: <ClinicalOverviewPage /> },
      { path: '/clinica/agenda', element: <ClinicalAgendaPage /> },
    ],
    { initialEntries: [path] }
  );
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('ClinicalAgendaPage integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    listLinkedClinicalAppointmentsMock.mockClear();
    updateClinicalAppointmentMock.mockClear();
    agendaResult = {
      ok: true,
      data: [
        {
          id: 'appt-demo-1',
          organizationId: 'org-1',
          unitId: 'unit-org-1',
          patientId: 'usr-1',
          professionalId: 'pro-1',
          startsAt: slot1.startsAt,
          endsAt: slot1.endsAt,
          appointmentStatus: 'confirmado',
          appointmentType: 'reavaliacao',
          status: 'ativo',
        },
        {
          id: 'appt-demo-2',
          organizationId: 'org-1',
          unitId: 'unit-org-1',
          patientId: 'usr-3',
          professionalId: 'pro-1',
          startsAt: slot2.startsAt,
          endsAt: slot2.endsAt,
          appointmentStatus: 'solicitado',
          appointmentType: 'reavaliacao',
          status: 'ativo',
        },
        {
          id: 'appt-demo-3',
          organizationId: 'org-1',
          unitId: 'unit-org-1',
          patientId: 'usr-4',
          professionalId: 'pro-1',
          startsAt: slot3.startsAt,
          endsAt: slot3.endsAt,
          appointmentStatus: 'concluido',
          appointmentType: 'acompanhamento',
          status: 'ativo',
        },
      ],
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('filtra por status concluido e confirma compromisso solicitado', async () => {
    setClinicalSession();
    const user = userEvent.setup();
    renderAt('/clinica/agenda');

    expect(await screen.findByTestId('clinical-agenda-row-appt-demo-1')).toBeInTheDocument();
    expect(screen.getByText(/Ana Demo/)).toBeInTheDocument();
    expect(screen.getByText(/Elisa Fictícia/)).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('clinical-agenda-status-filter'), 'concluído');
    await waitFor(() => {
      expect(screen.getByText(/Elisa Fictícia/)).toBeInTheDocument();
      expect(screen.queryByText(/Ana Demo/)).not.toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId('clinical-agenda-status-filter'), 'todos');
    const confirmButtons = screen.getAllByRole('button', { name: 'Confirmar' });
    // first enabled confirm should be Carlos (solicitado); Ana already confirmado is disabled
    const enabled = confirmButtons.find((button) => !(button as HTMLButtonElement).disabled);
    expect(enabled).toBeTruthy();
    await user.click(enabled!);
    await waitFor(() => {
      expect(updateClinicalAppointmentMock).toHaveBeenCalled();
      expect(screen.getByText(/atualizado para Confirmado/)).toBeInTheDocument();
    });
  });

  it('overview nao usa hardcode antigo Ana Demo • Reavaliação preventiva', async () => {
    setClinicalSession();
    renderAt('/clinica');
    expect(await screen.findByTestId('clinical-overview-upcoming')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('09:00 • Ana Demo • Reavaliação preventiva')).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId('clinical-overview-upcoming-appt-demo-1')).toBeInTheDocument();
  });

  it('mostra estado vazio autorizado', async () => {
    setClinicalSession();
    agendaResult = { ok: true, data: [] };
    renderAt('/clinica/agenda');
    expect(await screen.findByTestId('clinical-agenda-empty')).toHaveTextContent(
      'Nenhum compromisso na agenda autorizada.'
    );
  });
});
