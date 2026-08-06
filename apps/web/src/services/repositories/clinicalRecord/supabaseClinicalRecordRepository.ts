import { fail, ok } from '@/services/repositories/clinicalRecord/errors';
import type { ClinicalRecordRepository } from '@/services/repositories/clinicalRecord/contracts';
import {
  CLINICAL_RECORD_SCHEMA_VERSION,
  deriveClinicalRecordSummary,
  mergeClinicalRecordSections,
  missingRequiredConclusionFields,
  type ClinicalRecordStatus,
} from '@/services/repositories/clinicalRecord/schema';
import type {
  ClinicalRecord,
  ClinicalRecordChangeKind,
  ClinicalRecordResult,
  ClinicalRecordVersion,
} from '@/services/repositories/clinicalRecord/types';
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

export interface SupabaseClinicalRecordClient {
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

type RecordRow = {
  id: string;
  organization_id: string;
  user_id: string;
  professional_id: string;
  summary: string;
  record_status: string;
  schema_version: string;
  sections: unknown;
  revision_number: number;
  authored_by: string;
  concluded_at: string | null;
  concluded_by: string | null;
  updated_at: string;
  status: string;
};

type VersionRow = {
  id: string;
  clinical_record_id: string;
  organization_id: string;
  user_id: string;
  professional_id: string;
  schema_version: string;
  sections: unknown;
  summary: string;
  record_status: string;
  revision_number: number;
  change_kind: string;
  authored_by: string;
  created_at: string;
};

function asSections(value: unknown): ClinicalRecord['sections'] {
  if (value && typeof value === 'object') return value as ClinicalRecord['sections'];
  return {};
}

function asRecordStatus(value: string): ClinicalRecordStatus | null {
  if (value === 'rascunho' || value === 'concluido') return value;
  return null;
}

function asChangeKind(value: string): ClinicalRecordChangeKind | null {
  if (value === 'create' || value === 'draft_save' || value === 'conclude' || value === 'reopen') {
    return value;
  }
  return null;
}

const RECORD_SELECT =
  'id, organization_id, user_id, professional_id, summary, record_status, schema_version, sections, revision_number, authored_by, concluded_at, concluded_by, updated_at, status';

const VERSION_SELECT =
  'id, clinical_record_id, organization_id, user_id, professional_id, schema_version, sections, summary, record_status, revision_number, change_kind, authored_by, created_at';

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

function mapBackendError(error: SupabaseLikeError): ClinicalRecordResult<never> {
  const code = (error.code ?? '').toUpperCase();
  const message = (error.message ?? '').toLowerCase();
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
  if (message.includes('imutavel')) {
    return fail('RECORD_CONCLUDED', { cause, transient: false });
  }
  if (code === '23505') return fail('CONFLICT', { cause, transient: false });
  if (code === '23514') return fail('INVALID_INPUT', { cause, transient: false });
  return fail('TECHNICAL_ERROR', { cause });
}

function mapRecord(row: RecordRow): ClinicalRecord | null {
  const recordStatus = asRecordStatus(row.record_status);
  if (!recordStatus || (row.status !== 'ativo' && row.status !== 'inativo')) {
    return null;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.user_id,
    professionalId: row.professional_id,
    summary: row.summary,
    recordStatus,
    schemaVersion: row.schema_version,
    sections: mergeClinicalRecordSections(asSections(row.sections)),
    revisionNumber: row.revision_number,
    authoredBy: row.authored_by,
    concludedAt: row.concluded_at,
    concludedBy: row.concluded_by,
    updatedAt: row.updated_at,
    status: row.status,
  };
}

function mapVersion(row: VersionRow): ClinicalRecordVersion | null {
  const recordStatus = asRecordStatus(row.record_status);
  const changeKind = asChangeKind(row.change_kind);
  if (!recordStatus || !changeKind) {
    return null;
  }
  return {
    id: row.id,
    clinicalRecordId: row.clinical_record_id,
    organizationId: row.organization_id,
    patientId: row.user_id,
    professionalId: row.professional_id,
    schemaVersion: row.schema_version,
    sections: mergeClinicalRecordSections(asSections(row.sections)),
    summary: row.summary,
    recordStatus,
    revisionNumber: row.revision_number,
    changeKind,
    authoredBy: row.authored_by,
    createdAt: row.created_at,
  };
}

export function createSupabaseClinicalRecordRepository(input: {
  client: SupabaseClinicalRecordClient;
}): ClinicalRecordRepository {
  const client = input.client;

  async function assertSession(context: {
    sessionUserId: string;
    professionalUserId: string;
    organizationId: string;
  }): Promise<ClinicalRecordResult<true>> {
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
      canManage = await client.rpc('can_manage_clinical_record', {
        p_organization_id: context.organizationId,
      });
    } catch (error: unknown) {
      return mapBackendError(normalizeThrownError(error));
    }
    if (canManage.error) return mapBackendError(canManage.error);
    if (canManage.data !== true) return fail('CLINICAL_ACCESS_DENIED');
    return ok(true);
  }

  async function assertPatientLinked(
    context: { organizationId: string },
    patientId: string
  ): Promise<ClinicalRecordResult<true>> {
    let linked: SupabaseQueryResponse<unknown>;
    try {
      linked = await client.rpc('can_access_linked_patient_journey', {
        p_organization_id: context.organizationId,
        p_patient_user_id: patientId,
      });
    } catch (error: unknown) {
      return mapBackendError(normalizeThrownError(error));
    }
    if (linked.error) return mapBackendError(linked.error);
    if (linked.data !== true) return fail('PATIENT_NOT_IN_PORTFOLIO');
    return ok(true);
  }

  return {
    async getLinkedClinicalRecord({ context, patientId }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      if (!patientId) return fail('INVALID_INPUT');
      const linked = await assertPatientLinked(context, patientId);
      if (!linked.ok) return linked;

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('clinical_records')
          .select(RECORD_SELECT)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .eq('user_id', patientId)
          .eq('status', 'ativo')
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return ok(null);
      if (Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapRecord(response.data as RecordRow);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async listClinicalRecordVersions({ context, recordId }) {
      const access = await assertSession(context);
      if (!access.ok) return access;

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('clinical_record_versions')
          .select(VERSION_SELECT)
          .eq('clinical_record_id', recordId)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .order('created_at', { ascending: false });
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      const rows = Array.isArray(response.data) ? (response.data as VersionRow[]) : [];
      return ok(rows.map(mapVersion).filter((item): item is ClinicalRecordVersion => item !== null));
    },

    async saveClinicalRecordDraft({ context, draft }) {
      const access = await assertSession(context);
      if (!access.ok) return access;
      if (!draft.patientId) return fail('INVALID_INPUT');
      const linked = await assertPatientLinked(context, draft.patientId);
      if (!linked.ok) return linked;

      const sections = mergeClinicalRecordSections(draft.sections);
      const summary = deriveClinicalRecordSummary(sections);
      const schemaVersion = draft.schemaVersion ?? CLINICAL_RECORD_SCHEMA_VERSION;
      const now = new Date().toISOString();

      if (draft.recordId) {
        let response: SupabaseQueryResponse<unknown>;
        try {
          response = await client
            .from('clinical_records')
            .update({
              sections,
              summary,
              schema_version: schemaVersion,
              authored_by: context.professionalUserId,
              updated_at: now,
            })
            .eq('id', draft.recordId)
            .eq('organization_id', context.organizationId)
            .eq('professional_id', context.professionalUserId)
            .eq('user_id', draft.patientId)
            .select(RECORD_SELECT)
            .maybeSingle();
        } catch (error: unknown) {
          return mapBackendError(normalizeThrownError(error));
        }
        if (response.error) return mapBackendError(response.error);
        if (!response.data) return fail('NOT_FOUND');
        if (Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
        const mapped = mapRecord(response.data as RecordRow);
        if (!mapped) return fail('TECHNICAL_ERROR');
        return ok(mapped);
      }

      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('clinical_records')
          .insert({
            organization_id: context.organizationId,
            unit_id: context.unitId,
            user_id: draft.patientId,
            professional_id: context.professionalUserId,
            summary,
            status: 'ativo',
            version: 1,
            record_status: 'rascunho',
            schema_version: schemaVersion,
            sections,
            revision_number: 1,
            authored_by: context.professionalUserId,
            concluded_at: null,
            concluded_by: null,
          })
          .select(RECORD_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data || Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapRecord(response.data as RecordRow);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async concludeClinicalRecord({ context, conclusion }) {
      const access = await assertSession(context);
      if (!access.ok) return access;

      const sections = mergeClinicalRecordSections(conclusion.sections);
      const missing = missingRequiredConclusionFields(sections);
      if (missing.length > 0) {
        return fail('VALIDATION_REQUIRED_FIELDS', { details: missing.join(',') });
      }

      const now = new Date().toISOString();
      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('clinical_records')
          .update({
            sections,
            summary: deriveClinicalRecordSummary(sections),
            record_status: 'concluido',
            authored_by: context.professionalUserId,
            concluded_at: now,
            concluded_by: context.professionalUserId,
            updated_at: now,
          })
          .eq('id', conclusion.recordId)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .select(RECORD_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return fail('NOT_FOUND');
      if (Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapRecord(response.data as RecordRow);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },

    async reopenClinicalRecord({ context, reopen }) {
      const access = await assertSession(context);
      if (!access.ok) return access;

      let currentResponse: SupabaseQueryResponse<unknown>;
      try {
        currentResponse = await client
          .from('clinical_records')
          .select(RECORD_SELECT)
          .eq('id', reopen.recordId)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (currentResponse.error) return mapBackendError(currentResponse.error);
      if (!currentResponse.data || Array.isArray(currentResponse.data)) return fail('NOT_FOUND');
      const current = mapRecord(currentResponse.data as RecordRow);
      if (!current) return fail('TECHNICAL_ERROR');
      if (current.recordStatus !== 'concluido') return fail('INVALID_INPUT');

      const now = new Date().toISOString();
      let response: SupabaseQueryResponse<unknown>;
      try {
        response = await client
          .from('clinical_records')
          .update({
            record_status: 'rascunho',
            revision_number: current.revisionNumber + 1,
            authored_by: context.professionalUserId,
            concluded_at: null,
            concluded_by: null,
            updated_at: now,
          })
          .eq('id', reopen.recordId)
          .eq('organization_id', context.organizationId)
          .eq('professional_id', context.professionalUserId)
          .select(RECORD_SELECT)
          .maybeSingle();
      } catch (error: unknown) {
        return mapBackendError(normalizeThrownError(error));
      }
      if (response.error) return mapBackendError(response.error);
      if (!response.data) return fail('NOT_FOUND');
      if (Array.isArray(response.data)) return fail('TECHNICAL_ERROR');
      const mapped = mapRecord(response.data as RecordRow);
      if (!mapped) return fail('TECHNICAL_ERROR');
      return ok(mapped);
    },
  };
}
