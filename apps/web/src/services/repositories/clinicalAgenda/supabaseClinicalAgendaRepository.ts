import { fail, ok } from '@/services/repositories/clinicalAgenda/errors';
import type { ClinicalAgendaRepository } from '@/services/repositories/clinicalAgenda/contracts';
import type {
  ClinicalAgendaResult,
  ClinicalAppointment,
  ClinicalAppointmentStatus,
  ClinicalAppointmentType,
} from '@/services/repositories/clinicalAgenda/types';

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

type SupabaseAuthResponse = {
  data: { user: { id?: string } | null };
  error: SupabaseLikeError | null;
};

type SupabaseQueryResponse<T> = { data: T | null; error: SupabaseLikeError | null };

interface SupabaseSelectBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  eq(column: string, value: unknown): SupabaseSelectBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseSelectBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

interface SupabaseInsertBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  select(columns: string): SupabaseSelectBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

interface SupabaseUpdateBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  eq(column: string, value: unknown): SupabaseUpdateBuilder;
  select(columns: string): SupabaseSelectBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

export interface SupabaseClinicalAgendaClient {
  auth: { getUser(): Promise<SupabaseAuthResponse> };
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<SupabaseQueryResponse<unknown>>;
  from(table: string): {
    select(columns: string): SupabaseSelectBuilder;
    insert(values: Record<string, unknown>): SupabaseInsertBuilder;
    update(values: Record<string, unknown>): SupabaseUpdateBuilder;
  };
}

type AppointmentRow = {
  id: string;
  organization_id: string;
  user_id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
  appointment_status: string;
  appointment_type: string;
  status: string;
};

const STATUS_SET = new Set([
  'solicitado',
  'confirmado',
  'concluido',
  'cancelado',
  'ausencia',
]);
const TYPE_SET = new Set(['preventiva', 'reavaliacao', 'acompanhamento']);

function normalizeThrownError(error: unknown): SupabaseLikeError {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      message: typeof record['message'] === 'string' ? record['message'] : 'unknown',
      code: typeof record['code'] === 'string' ? record['code'] : undefined,
    };
  }
  return { message: 'unknown' };
}

function mapBackendError(error: SupabaseLikeError): ClinicalAgendaResult<never> {
  const code = (error.code ?? '').toUpperCase();
  const cause = {
    source: 'repository' as const,
    code: error.code,
    message: error.message,
  };
  if (code === '42501') return fail('CROSS_TENANT_DATA', { cause, transient: false });
  if (code === '23505') return fail('CONFLICT', { cause, transient: false });
  if (code === '23514') return fail('INVALID_INPUT', { cause, transient: false });
  return fail('TECHNICAL_ERROR', { cause });
}

function mapRow(row: AppointmentRow): ClinicalAppointment | null {
  if (
    !STATUS_SET.has(row.appointment_status) ||
    !TYPE_SET.has(row.appointment_type) ||
    (row.status !== 'ativo' && row.status !== 'inativo')
  ) {
    return null;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.user_id,
    professionalId: row.professional_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    appointmentStatus: row.appointment_status as ClinicalAppointmentStatus,
    appointmentType: row.appointment_type as ClinicalAppointmentType,
    status: row.status,
  };
}

export function createSupabaseClinicalAgendaRepository(input: {
  client: SupabaseClinicalAgendaClient;
}): ClinicalAgendaRepository {
  const client = input.client;

  async function assertSession(context: {
    sessionUserId: string;
    professionalUserId: string;
    organizationId: string;
  }): Promise<ClinicalAgendaResult<true>> {
    if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
    if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
    if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');

    let authResponse: SupabaseAuthResponse;
    try {
      authResponse = await client.auth.getUser();
    } catch (error: unknown) {
      authResponse = { data: { user: null }, error: normalizeThrownError(error) };
    }
    if (authResponse.error) return mapBackendError(authResponse.error);
    if (!authResponse.data.user?.id) return fail('NO_SESSION');
    if (authResponse.data.user.id !== context.professionalUserId) return fail('IDENTITY_MISMATCH');

    let canManage: SupabaseQueryResponse<unknown>;
    try {
      canManage = await client.rpc('can_manage_clinical_agenda', {
        p_organization_id: context.organizationId,
      });
    } catch (error: unknown) {
      return mapBackendError(normalizeThrownError(error));
    }
    if (canManage.error) return mapBackendError(canManage.error);
    if (canManage.data !== true) return fail('CLINICAL_ACCESS_DENIED');
    return ok(true);
  }

  return {
    async listLinkedClinicalAppointments({ context }) {
      const access = await assertSession(context);
      if (!access.ok) return access;

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('appointments')
          .select(
            'id, organization_id, user_id, professional_id, starts_at, ends_at, appointment_status, appointment_type, status'
          )
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .eq('status', 'ativo')
          .order('starts_at', { ascending: true });
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);

      const rows = Array.isArray(response.data) ? (response.data as AppointmentRow[]) : [];
      const appointments = rows
        .map(mapRow)
        .filter((item): item is ClinicalAppointment => item !== null)
        .filter(
          (item) =>
            item.organizationId === context.organizationId &&
            item.professionalId === context.professionalUserId
        );

      return ok(appointments);
    },

    async createClinicalAppointment({ context, appointment }) {
      const access = await assertSession(context);
      if (!access.ok) return access;

      let linked: SupabaseQueryResponse<unknown>;
      try {
        linked = await client.rpc('can_access_linked_patient_journey', {
          p_organization_id: context.organizationId,
          p_patient_user_id: appointment.patientId,
        });
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (linked.error) return mapBackendError(linked.error);
      if (linked.data !== true) return fail('PATIENT_NOT_IN_PORTFOLIO');

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('appointments')
          .insert({
            organization_id: context.organizationId,
            user_id: appointment.patientId,
            professional_id: context.professionalUserId,
            starts_at: appointment.startsAt,
            ends_at: appointment.endsAt,
            appointment_status: appointment.appointmentStatus,
            appointment_type: appointment.appointmentType,
            status: 'ativo',
            version: 1,
          })
          .select(
            'id, organization_id, user_id, professional_id, starts_at, ends_at, appointment_status, appointment_type, status'
          )
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data || Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapRow(response.data as AppointmentRow);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async updateClinicalAppointment({ context, appointment }) {
      const access = await assertSession(context);
      if (!access.ok) return access;

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (appointment.startsAt !== undefined) patch['starts_at'] = appointment.startsAt;
      if (appointment.endsAt !== undefined) patch['ends_at'] = appointment.endsAt;
      if (appointment.appointmentStatus !== undefined) {
        patch['appointment_status'] = appointment.appointmentStatus;
      }
      if (appointment.appointmentType !== undefined) {
        patch['appointment_type'] = appointment.appointmentType;
      }

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('appointments')
          .update(patch)
          .eq('id', appointment.appointmentId)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .select(
            'id, organization_id, user_id, professional_id, starts_at, ends_at, appointment_status, appointment_type, status'
          )
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return fail('NOT_FOUND');
      if (Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapRow(response.data as AppointmentRow);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },
  };
}
