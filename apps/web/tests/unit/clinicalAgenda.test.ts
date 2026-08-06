import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLinkedClinicalAppointment,
  loadLinkedClinicalAgenda,
  updateLinkedClinicalAppointment,
} from '@/domains/clinicalAgenda/clinicalAgendaService';
import { createMockClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/mockClinicalAgendaRepository';
import { createSupabaseClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/supabaseClinicalAgendaRepository';
import type { ClinicalAgendaContext } from '@/services/repositories/clinicalAgenda/types';

function context(overrides: Partial<ClinicalAgendaContext> = {}): ClinicalAgendaContext {
  return {
    sessionUserId: 'pro-1',
    professionalUserId: 'pro-1',
    organizationId: 'org-1',
    unitId: 'unit-org-1',
    ...overrides,
  };
}

describe('agenda clinica vinculada', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('lista compromissos ativos do profissional na organizacao ordenados por starts_at', async () => {
    const repository = createMockClinicalAgendaRepository();
    const loaded = await loadLinkedClinicalAgenda(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.length).toBeGreaterThan(0);
    expect(loaded.data.every((item) => item.organizationId === 'org-1')).toBe(true);
    expect(loaded.data.every((item) => item.professionalId === 'pro-1')).toBe(true);
    const starts = loaded.data.map((item) => item.startsAt);
    expect(starts).toEqual([...starts].sort((a, b) => a.localeCompare(b)));
  });

  it('nega profissional desconhecido e bloqueia paciente fora da carteira', async () => {
    const repository = createMockClinicalAgendaRepository();
    const denied = await loadLinkedClinicalAgenda(
      repository,
      context({ sessionUserId: 'pro-unknown', professionalUserId: 'pro-unknown' })
    );
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('CLINICAL_ACCESS_DENIED');

    const created = await createLinkedClinicalAppointment(repository, context(), {
      patientId: 'usr-999',
      startsAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 5400_000).toISOString(),
      appointmentStatus: 'solicitado',
      appointmentType: 'preventiva',
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe('PATIENT_NOT_IN_PORTFOLIO');
  });

  it('cria e atualiza compromisso autorizado; detecta conflito de horario', async () => {
    const repository = createMockClinicalAgendaRepository({ seed: { appointments: [] } });
    const startsAt = new Date(Date.now() + 7200_000).toISOString();
    const endsAt = new Date(Date.now() + 9000_000).toISOString();

    const created = await createLinkedClinicalAppointment(repository, context(), {
      patientId: 'usr-1',
      startsAt,
      endsAt,
      appointmentStatus: 'solicitado',
      appointmentType: 'acompanhamento',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateLinkedClinicalAppointment(repository, context(), {
      appointmentId: created.data.id,
      appointmentStatus: 'confirmado',
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.appointmentStatus).toBe('confirmado');

    const conflict = await createLinkedClinicalAppointment(repository, context(), {
      patientId: 'usr-1',
      startsAt,
      endsAt,
      appointmentStatus: 'solicitado',
      appointmentType: 'acompanhamento',
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.error.code).toBe('CONFLICT');
  });

  it('supabase: identidade auth.uid, org e paciente vinculados; sem professional_id arbitrario', async () => {
    const calls: Array<{ fn?: string; table?: string; args?: unknown }> = [];
    const client = {
      auth: {
        getUser() {
          return Promise.resolve({ data: { user: { id: 'pro-1' } }, error: null });
        },
      },
      rpc(fn: string, args?: Record<string, unknown>) {
        calls.push({ fn, args });
        if (fn === 'can_manage_clinical_agenda') {
          return Promise.resolve({ data: true, error: null });
        }
        if (fn === 'can_access_linked_patient_journey') {
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'unexpected' } });
      },
      from(table: string) {
        calls.push({ table });
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          order() {
            return builder;
          },
          insert(values: Record<string, unknown>) {
            calls.push({ table: 'insert', args: values });
            return {
              select() {
                return {
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: 'appt-1',
                        organization_id: 'org-1',
                        user_id: 'usr-1',
                        professional_id: 'pro-1',
                        starts_at: values['starts_at'],
                        ends_at: values['ends_at'],
                        appointment_status: values['appointment_status'],
                        appointment_type: values['appointment_type'],
                        status: 'ativo',
                      },
                      error: null,
                    }),
                };
              },
            };
          },
          update() {
            return builder;
          },
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          then(resolve: (value: { data: unknown[]; error: null }) => void) {
            resolve({ data: [], error: null });
            return Promise.resolve({ data: [], error: null });
          },
        };
        return builder;
      },
    };

    const repository = createSupabaseClinicalAgendaRepository({
      client: client as unknown as Parameters<typeof createSupabaseClinicalAgendaRepository>[0]['client'],
    });
    const listed = await loadLinkedClinicalAgenda(repository, context());
    expect(listed.ok).toBe(true);
    expect(calls.some((item) => item.fn === 'can_manage_clinical_agenda')).toBe(true);

    const created = await createLinkedClinicalAppointment(repository, context(), {
      patientId: 'usr-1',
      startsAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 5400_000).toISOString(),
      appointmentStatus: 'solicitado',
      appointmentType: 'preventiva',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.professionalId).toBe('pro-1');
    const insertCall = calls.find((item) => item.table === 'insert');
    expect(insertCall?.args).toMatchObject({
      organization_id: 'org-1',
      user_id: 'usr-1',
      professional_id: 'pro-1',
    });
  });
});
