import { fail, ok } from '@/services/repositories/clinicalPortfolio/errors';
import type { ClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/contracts';
import type {
  ClinicalPortfolioPatient,
  ClinicalPortfolioResult,
} from '@/services/repositories/clinicalPortfolio/types';
import {
  classifyPostgresInsufficientPrivilege,
  isPostgresInsufficientPrivilege,
} from '@/services/repositories/clinical/postgresInsufficientPrivilege';

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

export interface SupabaseClinicalPortfolioClient {
  auth: { getUser(): Promise<SupabaseAuthResponse> };
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<SupabaseQueryResponse<unknown>>;
}

type PortfolioRow = {
  patient_user_id: string;
  organization_id: string;
  unit_id: string;
  assignment_status: string;
  assignment_reason: string | null;
  display_name: string | null;
};

function sortPatients(items: ClinicalPortfolioPatient[]): ClinicalPortfolioPatient[] {
  return [...items].sort((a, b) => {
    const byName = a.displayName.localeCompare(b.displayName);
    if (byName !== 0) return byName;
    return a.patientId.localeCompare(b.patientId);
  });
}

function mapBackendError(error: SupabaseLikeError): ClinicalPortfolioResult<never> {
  const cause = {
    source: 'repository' as const,
    code: error.code,
    message: error.message,
  };
  if (isPostgresInsufficientPrivilege(error.code)) {
    const classification = classifyPostgresInsufficientPrivilege();
    return fail(classification.code, {
      kind: classification.kind,
      transient: classification.transient,
      cause,
    });
  }
  return fail('TECHNICAL_ERROR', { cause });
}

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

export function createSupabaseClinicalPortfolioRepository(input: {
  client: SupabaseClinicalPortfolioClient;
}): ClinicalPortfolioRepository {
  const client = input.client;

  return {
    async listLinkedClinicalPatients({ context }) {
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

      const orgArgs = { p_organization_id: context.organizationId };

      let canListResponse: SupabaseQueryResponse<unknown>;
      try {
        canListResponse = await client.rpc('can_list_linked_clinical_portfolio', orgArgs);
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (canListResponse.error) return mapBackendError(canListResponse.error);
      if (canListResponse.data !== true) return fail('CLINICAL_ACCESS_DENIED');

      let listResponse: SupabaseQueryResponse<unknown>;
      try {
        listResponse = await client.rpc('list_linked_clinical_patients', orgArgs);
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (listResponse.error) return mapBackendError(listResponse.error);

      const rows = Array.isArray(listResponse.data) ? (listResponse.data as PortfolioRow[]) : [];
      // Defesa em profundidade: a RPC ja restringe a p_organization_id autorizado.
      const patients = sortPatients(
        rows
          .filter(
            (row) =>
              typeof row.patient_user_id === 'string' &&
              typeof row.organization_id === 'string' &&
              typeof row.unit_id === 'string' &&
              row.organization_id === context.organizationId &&
              row.unit_id === context.unitId &&
              row.assignment_status === 'ativo'
          )
          .map((row) => ({
            patientId: row.patient_user_id,
            displayName: row.display_name?.trim() || 'Paciente',
            organizationId: row.organization_id,
            unitId: row.unit_id,
            assignmentStatus: 'ativo' as const,
            assignmentReason: row.assignment_reason,
          }))
      );

      return ok(patients);
    },
  };
}
