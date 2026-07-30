import { fail, ok } from '@/services/repositories/assessment/errors';
import type {
  AssessmentCatalog,
  AssessmentContext,
  AssessmentOption,
  AssessmentQuestion,
  AssessmentRecord,
  AssessmentResponseRecord,
  AssessmentResult,
  AssessmentState,
  AssessmentVersion,
  RiskResultRecord,
} from '@/services/repositories/assessment/types';
import type {
  AssessmentRepository,
  CreateAssessmentInput,
  MarkAssessmentStatusInput,
  ResolveAssessmentCatalogByVersionInput,
  ResolveAssessmentCatalogInput,
  UpsertAssessmentResponseInput,
  UpsertRiskResultInput,
} from '@/services/repositories/assessment/contracts';

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

interface SupabaseUpsertBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  select(columns: string): SupabaseSelectBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

interface SupabaseUpdateBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  eq(column: string, value: unknown): SupabaseUpdateBuilder;
  select(columns: string): SupabaseSelectBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

export interface SupabaseAssessmentClient {
  auth: { getUser(): Promise<SupabaseAuthResponse> };
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<SupabaseQueryResponse<unknown>>;
  from(table: string): {
    select(columns: string): SupabaseSelectBuilder;
    insert(values: Record<string, unknown>): SupabaseInsertBuilder;
    upsert(
      values: Record<string, unknown>,
      options?: { onConflict?: string }
    ): SupabaseUpsertBuilder;
    update(values: Record<string, unknown>): SupabaseUpdateBuilder;
  };
}

type AssessmentVersionRow = {
  id: string;
  organization_id: string;
  code: string;
  title: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type AssessmentQuestionRow = {
  id: string;
  organization_id: string;
  assessment_version_id: string;
  domain: string;
  prompt: string;
  question_order: number;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type AssessmentOptionRow = {
  id: string;
  organization_id: string;
  assessment_question_id: string;
  label: string;
  value: string;
  score: number | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type AssessmentRow = {
  id: string;
  organization_id: string;
  user_id: string;
  assessment_version_id: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type AssessmentResponseRow = {
  id: string;
  organization_id: string;
  assessment_id: string;
  assessment_question_id: string;
  answer_text: string | null;
  answer_value: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type RiskResultRow = {
  id: string;
  organization_id: string;
  assessment_id: string;
  level: string;
  message: string;
  explainability: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type SupabaseAssessmentRepositoryOptions = {
  client: SupabaseAssessmentClient;
  now?: () => Date;
};

export class SupabaseAssessmentRepository implements AssessmentRepository {
  private readonly client: SupabaseAssessmentClient;
  private readonly now: () => Date;

  constructor(options: SupabaseAssessmentRepositoryOptions) {
    this.client = options.client;
    this.now = options.now ?? (() => new Date());
  }

  async resolveAssessmentCatalog(
    input: ResolveAssessmentCatalogInput
  ): Promise<AssessmentResult<AssessmentCatalog>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const versionsQuery = this.client
      .from('assessment_versions')
      .select('id, organization_id, code, title, status, version, created_at, updated_at')
      .eq('organization_id', input.context.organizationId)
      .eq('code', input.versionCode)
      .order('version', { ascending: false })
      .order('updated_at', { ascending: false });

    let versionsResponse: SupabaseQueryResponse<AssessmentVersionRow[]>;
    try {
      versionsResponse = (await versionsQuery) as SupabaseQueryResponse<AssessmentVersionRow[]>;
    } catch (error: unknown) {
      versionsResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (versionsResponse.error) return mapBackendError(versionsResponse.error);
    const versions = (versionsResponse.data ?? []).map(mapAssessmentVersionRow);
    if (versions.length === 0) return fail('VERSION_NOT_FOUND');
    const version = versions.find((candidate) => candidate.status === 'ativo');
    if (!version) return fail('VERSION_INELIGIBLE');

    const questionsQuery = this.client
      .from('assessment_questions')
      .select(
        'id, organization_id, assessment_version_id, domain, prompt, question_order, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('assessment_version_id', version.id)
      .order('question_order', { ascending: true });

    let questionsResponse: SupabaseQueryResponse<AssessmentQuestionRow[]>;
    try {
      questionsResponse = (await questionsQuery) as SupabaseQueryResponse<AssessmentQuestionRow[]>;
    } catch (error: unknown) {
      questionsResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (questionsResponse.error) return mapBackendError(questionsResponse.error);
    const questions = (questionsResponse.data ?? []).map(mapAssessmentQuestionRow);
    if (questions.length === 0) return fail('VERSION_INCOMPATIBLE');

    const optionsQuery = this.client
      .from('assessment_options')
      .select(
        'id, organization_id, assessment_question_id, label, value, score, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId);
    let optionsResponse: SupabaseQueryResponse<AssessmentOptionRow[]>;
    try {
      optionsResponse = (await optionsQuery) as SupabaseQueryResponse<AssessmentOptionRow[]>;
    } catch (error: unknown) {
      optionsResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (optionsResponse.error) return mapBackendError(optionsResponse.error);

    const questionIds = new Set(questions.map((item) => item.id));
    const options = (optionsResponse.data ?? [])
      .filter((option) => questionIds.has(option.assessment_question_id))
      .map(mapAssessmentOptionRow);

    return ok({ version, questions, options });
  }

  async resolveAssessmentCatalogByVersion(
    input: ResolveAssessmentCatalogByVersionInput
  ): Promise<AssessmentResult<AssessmentCatalog>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const versionQuery = this.client
      .from('assessment_versions')
      .select('id, organization_id, code, title, status, version, created_at, updated_at')
      .eq('organization_id', input.context.organizationId)
      .eq('id', input.assessmentVersionId)
      .maybeSingle();
    let versionResponse: SupabaseQueryResponse<AssessmentVersionRow>;
    try {
      versionResponse = (await versionQuery) as SupabaseQueryResponse<AssessmentVersionRow>;
    } catch (error: unknown) {
      versionResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (versionResponse.error) return mapBackendError(versionResponse.error);
    if (!versionResponse.data) return fail('VERSION_NOT_FOUND');
    const version = mapAssessmentVersionRow(versionResponse.data);

    const questionsQuery = this.client
      .from('assessment_questions')
      .select(
        'id, organization_id, assessment_version_id, domain, prompt, question_order, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('assessment_version_id', version.id)
      .eq('status', 'ativo')
      .order('question_order', { ascending: true });

    let questionsResponse: SupabaseQueryResponse<AssessmentQuestionRow[]>;
    try {
      questionsResponse = (await questionsQuery) as SupabaseQueryResponse<AssessmentQuestionRow[]>;
    } catch (error: unknown) {
      questionsResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (questionsResponse.error) return mapBackendError(questionsResponse.error);
    const questions = (questionsResponse.data ?? []).map(mapAssessmentQuestionRow);
    if (questions.length === 0) return fail('VERSION_INCOMPATIBLE');
    const questionIds = new Set(questions.map((item) => item.id));

    const optionsQuery = this.client
      .from('assessment_options')
      .select(
        'id, organization_id, assessment_question_id, label, value, score, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('status', 'ativo');
    let optionsResponse: SupabaseQueryResponse<AssessmentOptionRow[]>;
    try {
      optionsResponse = (await optionsQuery) as SupabaseQueryResponse<AssessmentOptionRow[]>;
    } catch (error: unknown) {
      optionsResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (optionsResponse.error) return mapBackendError(optionsResponse.error);
    const options = (optionsResponse.data ?? [])
      .filter((option) => questionIds.has(option.assessment_question_id))
      .map(mapAssessmentOptionRow);

    return ok({ version, questions, options });
  }

  async getLatestAssessmentState(
    context: AssessmentContext
  ): Promise<AssessmentResult<AssessmentState | null>> {
    const validation = await this.validateContext(context);
    if (!validation.ok) return validation;

    const assessmentQuery = this.client
      .from('assessments')
      .select(
        'id, organization_id, user_id, assessment_version_id, status, version, created_at, updated_at'
      )
      .eq('organization_id', context.organizationId)
      .eq('user_id', context.userId)
      .order('updated_at', { ascending: false });

    let assessmentResponse: SupabaseQueryResponse<AssessmentRow[]>;
    try {
      assessmentResponse = (await assessmentQuery) as SupabaseQueryResponse<AssessmentRow[]>;
    } catch (error: unknown) {
      assessmentResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (assessmentResponse.error) return mapBackendError(assessmentResponse.error);
    const assessment = (assessmentResponse.data ?? [])[0];
    if (!assessment) return ok(null);
    if (
      assessment.organization_id !== context.organizationId ||
      assessment.user_id !== context.userId
    ) {
      return fail('CROSS_TENANT_DATA');
    }

    const responsesQuery = this.client
      .from('assessment_responses')
      .select(
        'id, organization_id, assessment_id, assessment_question_id, answer_text, answer_value, status, version, created_at, updated_at'
      )
      .eq('organization_id', context.organizationId)
      .eq('assessment_id', assessment.id)
      .order('created_at', { ascending: true });

    let responsesResponse: SupabaseQueryResponse<AssessmentResponseRow[]>;
    try {
      responsesResponse = (await responsesQuery) as SupabaseQueryResponse<AssessmentResponseRow[]>;
    } catch (error: unknown) {
      responsesResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (responsesResponse.error) return mapBackendError(responsesResponse.error);

    const riskQuery = this.client
      .from('risk_results')
      .select(
        'id, organization_id, assessment_id, level, message, explainability, status, version, created_at, updated_at'
      )
      .eq('organization_id', context.organizationId)
      .eq('assessment_id', assessment.id)
      .order('updated_at', { ascending: false });
    let riskResponse: SupabaseQueryResponse<RiskResultRow[]>;
    try {
      riskResponse = (await riskQuery) as SupabaseQueryResponse<RiskResultRow[]>;
    } catch (error: unknown) {
      riskResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (riskResponse.error) return mapBackendError(riskResponse.error);

    return ok({
      assessment: mapAssessmentRow(assessment),
      responses: (responsesResponse.data ?? []).map(mapAssessmentResponseRow),
      riskResult: riskResponse.data?.[0] ? mapRiskResultRow(riskResponse.data[0]) : null,
    });
  }

  async createAssessment(
    input: CreateAssessmentInput
  ): Promise<AssessmentResult<AssessmentRecord>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    let response: SupabaseQueryResponse<AssessmentRow>;
    try {
      response = (await this.client.rpc('create_or_get_active_assessment', {
        p_organization_id: input.context.organizationId,
        p_assessment_version_id: input.assessmentVersionId,
        p_initial_status: input.status,
      })) as SupabaseQueryResponse<AssessmentRow>;
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
    return ok(mapAssessmentRow(response.data));
  }

  async upsertAssessmentResponse(
    input: UpsertAssessmentResponseInput
  ): Promise<AssessmentResult<AssessmentResponseRecord>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const existingQuery = this.client
      .from('assessment_responses')
      .select(
        'id, organization_id, assessment_id, assessment_question_id, answer_text, answer_value, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('assessment_id', input.assessmentId)
      .eq('assessment_question_id', input.assessmentQuestionId)
      .maybeSingle();
    let existingResponse: SupabaseQueryResponse<AssessmentResponseRow>;
    try {
      existingResponse = (await existingQuery) as SupabaseQueryResponse<AssessmentResponseRow>;
    } catch (error: unknown) {
      existingResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (existingResponse.error) return mapBackendError(existingResponse.error);
    const upsertQuery = this.client
      .from('assessment_responses')
      .upsert(
        {
          organization_id: input.context.organizationId,
          assessment_id: input.assessmentId,
          assessment_question_id: input.assessmentQuestionId,
          answer_text: input.answerText,
          answer_value: input.answerValue,
          updated_at: this.now().toISOString(),
          version: existingResponse.data ? existingResponse.data.version + 1 : 1,
        },
        { onConflict: 'assessment_id,assessment_question_id' }
      )
      .select(
        'id, organization_id, assessment_id, assessment_question_id, answer_text, answer_value, status, version, created_at, updated_at'
      )
      .maybeSingle();
    let upsertResponse: SupabaseQueryResponse<AssessmentResponseRow>;
    try {
      upsertResponse = (await upsertQuery) as SupabaseQueryResponse<AssessmentResponseRow>;
    } catch (error: unknown) {
      upsertResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (upsertResponse.error) return mapBackendError(upsertResponse.error);
    if (!upsertResponse.data) return fail('ASSESSMENT_NOT_FOUND');
    return ok(mapAssessmentResponseRow(upsertResponse.data));
  }

  async markAssessmentStatus(
    input: MarkAssessmentStatusInput
  ): Promise<AssessmentResult<AssessmentRecord>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const existingQuery = this.client
      .from('assessments')
      .select(
        'id, organization_id, user_id, assessment_version_id, status, version, created_at, updated_at'
      )
      .eq('id', input.assessmentId)
      .eq('organization_id', input.context.organizationId)
      .eq('user_id', input.context.userId)
      .maybeSingle();
    let existingResponse: SupabaseQueryResponse<AssessmentRow>;
    try {
      existingResponse = (await existingQuery) as SupabaseQueryResponse<AssessmentRow>;
    } catch (error: unknown) {
      existingResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (existingResponse.error) return mapBackendError(existingResponse.error);
    if (!existingResponse.data) return fail('ASSESSMENT_NOT_FOUND');

    const updateQuery = this.client
      .from('assessments')
      .update({
        status: input.status,
        updated_at: this.now().toISOString(),
        version: existingResponse.data.version + 1,
      })
      .eq('id', input.assessmentId)
      .eq('organization_id', input.context.organizationId)
      .eq('user_id', input.context.userId)
      .select(
        'id, organization_id, user_id, assessment_version_id, status, version, created_at, updated_at'
      )
      .maybeSingle();
    let updateResponse: SupabaseQueryResponse<AssessmentRow>;
    try {
      updateResponse = (await updateQuery) as SupabaseQueryResponse<AssessmentRow>;
    } catch (error: unknown) {
      updateResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (updateResponse.error) return mapBackendError(updateResponse.error);
    if (!updateResponse.data) return fail('ASSESSMENT_NOT_FOUND');
    return ok(mapAssessmentRow(updateResponse.data));
  }

  async upsertRiskResult(
    input: UpsertRiskResultInput
  ): Promise<AssessmentResult<RiskResultRecord>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const existingQuery = this.client
      .from('risk_results')
      .select(
        'id, organization_id, assessment_id, level, message, explainability, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('assessment_id', input.assessmentId)
      .order('updated_at', { ascending: false })
      .maybeSingle();
    let existingResponse: SupabaseQueryResponse<RiskResultRow>;
    try {
      existingResponse = (await existingQuery) as SupabaseQueryResponse<RiskResultRow>;
    } catch (error: unknown) {
      existingResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (existingResponse.error) return mapBackendError(existingResponse.error);
    const upsertQuery = this.client
      .from('risk_results')
      .upsert(
        {
          organization_id: input.context.organizationId,
          assessment_id: input.assessmentId,
          level: input.level,
          message: input.message,
          explainability: input.explainability,
          updated_at: this.now().toISOString(),
          version: existingResponse.data ? existingResponse.data.version + 1 : 1,
        },
        { onConflict: 'assessment_id' }
      )
      .select(
        'id, organization_id, assessment_id, level, message, explainability, status, version, created_at, updated_at'
      )
      .maybeSingle();
    let upsertResponse: SupabaseQueryResponse<RiskResultRow>;
    try {
      upsertResponse = (await upsertQuery) as SupabaseQueryResponse<RiskResultRow>;
    } catch (error: unknown) {
      upsertResponse = { data: null, error: normalizeThrownError(error) };
    }
    if (upsertResponse.error) return mapBackendError(upsertResponse.error);
    if (!upsertResponse.data) return fail('ASSESSMENT_NOT_FOUND');
    return ok(mapRiskResultRow(upsertResponse.data));
  }

  private async validateContext(
    context: AssessmentContext
  ): Promise<AssessmentResult<true>> {
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

export function createSupabaseAssessmentRepository(
  options: SupabaseAssessmentRepositoryOptions
): AssessmentRepository {
  return new SupabaseAssessmentRepository(options);
}

function mapAssessmentVersionRow(row: AssessmentVersionRow): AssessmentVersion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    title: row.title,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssessmentQuestionRow(row: AssessmentQuestionRow): AssessmentQuestion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentVersionId: row.assessment_version_id,
    domain: row.domain,
    prompt: row.prompt,
    questionOrder: row.question_order,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssessmentOptionRow(row: AssessmentOptionRow): AssessmentOption {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentQuestionId: row.assessment_question_id,
    label: row.label,
    value: row.value,
    score: row.score,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssessmentRow(row: AssessmentRow): AssessmentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    assessmentVersionId: row.assessment_version_id,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssessmentResponseRow(
  row: AssessmentResponseRow
): AssessmentResponseRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentId: row.assessment_id,
    assessmentQuestionId: row.assessment_question_id,
    answerText: row.answer_text,
    answerValue: row.answer_value,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRiskResultRow(row: RiskResultRow): RiskResultRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentId: row.assessment_id,
    level: row.level,
    message: row.message,
    explainability: row.explainability,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBackendError(error: SupabaseLikeError): AssessmentResult<never> {
  const code = (error.code ?? '').toUpperCase();
  const cause = {
    source: 'repository' as const,
    code: sanitizeErrorCode(error.code, error.status),
    message: sanitizeErrorMessage(error.message),
  };

  if (code === '42501') return fail('CROSS_TENANT_DATA', { cause, transient: false });
  if (code === '23503') return fail('QUESTION_NOT_IN_VERSION', { cause, transient: false });
  if (code === '23505') return fail('TECHNICAL_ERROR', { cause, transient: false });
  const lowerMessage = (cause.message ?? '').toLowerCase();
  if (
    code === 'P0001' &&
    (lowerMessage.includes('nao esta elegivel') || lowerMessage.includes('inexistente'))
  ) {
    return fail('VERSION_INELIGIBLE', { cause, transient: false });
  }
  return fail('TECHNICAL_ERROR', { cause, transient: isTransientError(error) });
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

function normalizeThrownError(error: unknown): SupabaseLikeError {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Record<string, unknown>;
    return {
      message:
        typeof candidate['message'] === 'string'
          ? candidate['message']
          : 'Erro nao identificado.',
      code: typeof candidate['code'] === 'string' ? candidate['code'] : undefined,
      status: typeof candidate['status'] === 'number' ? candidate['status'] : undefined,
    };
  }
  return { message: 'Erro desconhecido durante consulta.', code: 'UNKNOWN_ERROR' };
}

function isTransientError(error: SupabaseLikeError): boolean {
  const transientStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
  if (typeof error.status === 'number' && transientStatusCodes.has(error.status)) return true;
  const code = error.code?.toUpperCase() ?? '';
  if (code.startsWith('ETIMEDOUT') || code.startsWith('ECONNRESET') || code === 'PGRST301') {
    return true;
  }
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('temporar') ||
    message.includes('network')
  );
}
