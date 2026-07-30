import { fail, ok } from '@/services/repositories/consent/errors';
import type { AcceptConsentInput, ConsentRepository, RevokeConsentInput } from '@/services/repositories/consent/contracts';
import type {
  ConsentContext,
  ConsentDocument,
  ConsentHistoryItem,
  ConsentResult,
  UserConsent,
} from '@/services/repositories/consent/types';

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

export interface SupabaseConsentClient {
  auth: { getUser(): Promise<SupabaseAuthResponse> };
  from(table: string): {
    select(columns: string): SupabaseSelectBuilder;
    insert(values: Record<string, unknown>): SupabaseInsertBuilder;
    update(values: Record<string, unknown>): SupabaseUpdateBuilder;
  };
}

type ConsentDocumentRow = {
  id: string;
  organization_id: string;
  code: string;
  title: string;
  purpose: string;
  legal_basis: string;
  document_version: string;
  content_hash: string;
  status: string;
  effective_at: string;
  expires_at: string | null;
};

type UserConsentRow = {
  id: string;
  organization_id: string;
  user_id: string;
  consent_document_id: string;
  source: string;
  accepted_at: string;
  revoked_at: string | null;
  revoked_source: string | null;
  revoked_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  consent_documents?: ConsentDocumentRow | ConsentDocumentRow[] | null;
};

type SupabaseConsentRepositoryOptions = {
  client: SupabaseConsentClient;
  now?: () => Date;
};

export class SupabaseConsentRepository implements ConsentRepository {
  private readonly client: SupabaseConsentClient;
  private readonly now: () => Date;

  constructor(options: SupabaseConsentRepositoryOptions) {
    this.client = options.client;
    this.now = options.now ?? (() => new Date());
  }

  async listEligibleDocuments(context: ConsentContext): Promise<ConsentResult<ConsentDocument[]>> {
    const validation = await this.validateContext(context);
    if (!validation.ok) return validation;

    const currentIso = this.now().toISOString();
    const query = this.client
      .from('consent_documents')
      .select(
        'id, organization_id, code, title, purpose, legal_basis, document_version, content_hash, status, effective_at, expires_at'
      )
      .eq('organization_id', context.organizationId)
      .eq('status', 'ativo')
      .order('effective_at', { ascending: false });

    let response: SupabaseQueryResponse<ConsentDocumentRow[]>;
    try {
      response = (await query) as SupabaseQueryResponse<ConsentDocumentRow[]>;
    } catch (error: unknown) {
      response = { data: null, error: normalizeThrownError(error) };
    }
    if (response.error) return mapBackendError(response.error);

    const eligible = (response.data ?? [])
      .filter((row) => isDocumentEligibleAt(row, currentIso))
      .map(mapConsentDocumentRow);
    return ok(eligible);
  }

  async listConsentHistory(context: ConsentContext): Promise<ConsentResult<ConsentHistoryItem[]>> {
    const validation = await this.validateContext(context);
    if (!validation.ok) return validation;

    const query = this.client
      .from('user_consents')
      .select(
        'id, organization_id, user_id, consent_document_id, source, accepted_at, revoked_at, revoked_source, revoked_reason, version, created_at, updated_at, consent_documents(id, organization_id, code, title, purpose, legal_basis, document_version, content_hash, status, effective_at, expires_at)'
      )
      .eq('organization_id', context.organizationId)
      .eq('user_id', context.userId)
      .order('accepted_at', { ascending: false });

    let response: SupabaseQueryResponse<UserConsentRow[]>;
    try {
      response = (await query) as SupabaseQueryResponse<UserConsentRow[]>;
    } catch (error: unknown) {
      response = { data: null, error: normalizeThrownError(error) };
    }
    if (response.error) return mapBackendError(response.error);

    const output: ConsentHistoryItem[] = [];
    for (const row of response.data ?? []) {
      if (row.organization_id !== context.organizationId || row.user_id !== context.userId) {
        return fail('CROSS_TENANT_DATA');
      }
      const document = extractDocument(row.consent_documents);
      if (!document) continue;
      output.push({
        consent: mapUserConsentRow(row),
        document: mapConsentDocumentRow(document),
      });
    }
    return ok(output);
  }

  async acceptConsent(input: AcceptConsentInput): Promise<ConsentResult<UserConsent>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const payload = {
      organization_id: input.context.organizationId,
      user_id: input.context.userId,
      consent_document_id: input.consentDocumentId,
      source: input.source,
    };

    const query = this.client
      .from('user_consents')
      .insert(payload)
      .select(
        'id, organization_id, user_id, consent_document_id, source, accepted_at, revoked_at, revoked_source, revoked_reason, version, created_at, updated_at'
      )
      .maybeSingle();

    let response: SupabaseQueryResponse<UserConsentRow>;
    try {
      response = (await query) as SupabaseQueryResponse<UserConsentRow>;
    } catch (error: unknown) {
      response = { data: null, error: normalizeThrownError(error) };
    }
    if (response.error) return mapBackendError(response.error);
    if (!response.data) return fail('TECHNICAL_ERROR');
    if (
      response.data.organization_id !== input.context.organizationId ||
      response.data.user_id !== input.context.userId
    ) {
      return fail('CROSS_TENANT_DATA');
    }
    return ok(mapUserConsentRow(response.data));
  }

  async revokeConsent(input: RevokeConsentInput): Promise<ConsentResult<UserConsent>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const existingQuery = this.client
      .from('user_consents')
      .select(
        'id, organization_id, user_id, consent_document_id, source, accepted_at, revoked_at, revoked_source, revoked_reason, version, created_at, updated_at'
      )
      .eq('id', input.consentId)
      .eq('organization_id', input.context.organizationId)
      .eq('user_id', input.context.userId)
      .maybeSingle();

    let existingResponse: SupabaseQueryResponse<UserConsentRow>;
    try {
      existingResponse = (await existingQuery) as SupabaseQueryResponse<UserConsentRow>;
    } catch (error: unknown) {
      existingResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (existingResponse.error) return mapBackendError(existingResponse.error);
    if (!existingResponse.data) return fail('CONSENT_NOT_FOUND');
    if (existingResponse.data.revoked_at !== null) return fail('CONSENT_ALREADY_REVOKED');

    const revokedAt = this.now().toISOString();
    const updateQuery = this.client
      .from('user_consents')
      .update({
        revoked_at: revokedAt,
        revoked_source: input.revokedSource,
        revoked_reason: input.revokedReason ?? null,
        version: existingResponse.data.version + 1,
        updated_at: revokedAt,
      })
      .eq('id', input.consentId)
      .eq('organization_id', input.context.organizationId)
      .eq('user_id', input.context.userId)
      .select(
        'id, organization_id, user_id, consent_document_id, source, accepted_at, revoked_at, revoked_source, revoked_reason, version, created_at, updated_at'
      )
      .maybeSingle();

    let updateResponse: SupabaseQueryResponse<UserConsentRow>;
    try {
      updateResponse = (await updateQuery) as SupabaseQueryResponse<UserConsentRow>;
    } catch (error: unknown) {
      updateResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (updateResponse.error) return mapBackendError(updateResponse.error);
    if (!updateResponse.data) return fail('CONSENT_NOT_FOUND');
    if (
      updateResponse.data.organization_id !== input.context.organizationId ||
      updateResponse.data.user_id !== input.context.userId
    ) {
      return fail('CROSS_TENANT_DATA');
    }
    return ok(mapUserConsentRow(updateResponse.data));
  }

  private async validateContext(context: ConsentContext): Promise<ConsentResult<true>> {
    if (!context.sessionUserId || !context.userId) return fail('NO_SESSION');
    if (context.sessionUserId !== context.userId) return fail('IDENTITY_MISMATCH');

    let authResponse: SupabaseAuthResponse;
    try {
      authResponse = await this.client.auth.getUser();
    } catch (error: unknown) {
      authResponse = { data: { user: null }, error: normalizeThrownError(error) };
    }

    if (authResponse.error) return mapBackendError(authResponse.error);
    if (!authResponse.data.user?.id) return fail('NO_SESSION');
    if (authResponse.data.user.id !== context.userId) return fail('IDENTITY_MISMATCH');
    return ok(true);
  }
}

export function createSupabaseConsentRepository(options: SupabaseConsentRepositoryOptions): ConsentRepository {
  return new SupabaseConsentRepository(options);
}

export function isDocumentEligibleAt(row: Pick<ConsentDocumentRow, 'status' | 'effective_at' | 'expires_at'>, nowIso: string): boolean {
  if (row.status !== 'ativo') return false;
  const nowValue = Date.parse(nowIso);
  const effectiveValue = Date.parse(row.effective_at);
  if (!Number.isFinite(effectiveValue) || effectiveValue > nowValue) return false;
  if (row.expires_at === null) return true;
  const expiresValue = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresValue)) return false;
  return expiresValue > nowValue;
}

export function mapConsentDocumentRow(row: ConsentDocumentRow): ConsentDocument {
  return {
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    title: row.title,
    purpose: row.purpose,
    legalBasis: row.legal_basis,
    documentVersion: row.document_version,
    contentHash: row.content_hash,
    status: row.status,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at,
  };
}

function mapUserConsentRow(row: UserConsentRow): UserConsent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    consentDocumentId: row.consent_document_id,
    source: row.source,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    revokedSource: row.revoked_source,
    revokedReason: row.revoked_reason,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function extractDocument(value: UserConsentRow['consent_documents']): ConsentDocumentRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapBackendError(error: SupabaseLikeError): ConsentResult<never> {
  const code = (error.code ?? '').toUpperCase();
  const message = (error.message ?? '').toLowerCase();
  const cause = {
    source: 'repository' as const,
    code: sanitizeErrorCode(error.code, error.status),
    message: sanitizeErrorMessage(error.message),
  };

  if (code === '23505') return fail('CONSENT_ALREADY_ACTIVE', { cause, transient: false });
  if (code === '42501') return fail('CROSS_TENANT_DATA', { cause, transient: false });
  if (
    message.includes('nao e elegivel') ||
    message.includes('expirado') ||
    message.includes('nao vigente')
  ) {
    return fail('INELIGIBLE_DOCUMENT', { cause, transient: false });
  }

  return fail('TECHNICAL_ERROR', { cause, transient: isTransientError(error) });
}

function normalizeThrownError(error: unknown): SupabaseLikeError {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Record<string, unknown>;
    return {
      message: typeof candidate['message'] === 'string' ? candidate['message'] : 'Erro nao identificado.',
      code: typeof candidate['code'] === 'string' ? candidate['code'] : undefined,
      status: typeof candidate['status'] === 'number' ? candidate['status'] : undefined,
    };
  }
  return { message: 'Erro desconhecido durante consulta.', code: 'UNKNOWN_ERROR' };
}

function sanitizeErrorCode(code: string | undefined, status: number | undefined): string {
  if (typeof code === 'string' && code.trim().length > 0) return code.trim().slice(0, 64);
  if (typeof status === 'number') return `HTTP_${status}`;
  return 'SUPABASE_ERROR';
}

function sanitizeErrorMessage(message: string | undefined): string {
  if (!message) return 'Falha tecnica sem mensagem detalhada.';
  return message.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function isTransientError(error: SupabaseLikeError): boolean {
  const transientStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
  if (typeof error.status === 'number' && transientStatusCodes.has(error.status)) return true;
  const code = error.code?.toUpperCase() ?? '';
  if (code.startsWith('ETIMEDOUT') || code.startsWith('ECONNRESET') || code === 'PGRST301') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('timeout') || message.includes('temporar') || message.includes('network');
}
