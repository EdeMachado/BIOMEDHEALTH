import { fail, ok } from '@/services/repositories/journey/errors';
import type {
  CreateOrGetActiveUserJourneyInput,
  JourneyRepository,
  ListLinkedPatientJourneysInput,
  MarkUserJourneyCompletionInput,
  ResolveJourneyCatalogByVersionInput,
  ResolveOperationalJourneyCatalogInput,
  UpsertUserActivityProgressInput,
} from '@/services/repositories/journey/contracts';
import type {
  ClinicalPatientJourneyView,
  JourneyActivity,
  JourneyCatalog,
  JourneyContext,
  JourneyResult,
  JourneyStep,
  JourneyVersion,
  UserActivityProgressRecord,
  UserJourneyRecord,
} from '@/services/repositories/journey/types';

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

interface SupabaseUpsertBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  select(columns: string): SupabaseSelectBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

interface SupabaseUpdateBuilder extends PromiseLike<SupabaseQueryResponse<unknown>> {
  eq(column: string, value: unknown): SupabaseUpdateBuilder;
  select(columns: string): SupabaseSelectBuilder;
  maybeSingle(): PromiseLike<SupabaseQueryResponse<unknown>>;
}

export interface SupabaseJourneyClient {
  auth: { getUser(): Promise<SupabaseAuthResponse> };
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<SupabaseQueryResponse<unknown>>;
  from(table: string): {
    select(columns: string): SupabaseSelectBuilder;
    upsert(
      values: Record<string, unknown>,
      options?: { onConflict?: string }
    ): SupabaseUpsertBuilder;
    update(values: Record<string, unknown>): SupabaseUpdateBuilder;
  };
}

type HealthJourneyRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  target_audience: string;
  duration_weeks: number;
  technical_owner: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type JourneyVersionRow = {
  id: string;
  organization_id: string;
  journey_id: string;
  code: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type JourneyStepRow = {
  id: string;
  organization_id: string;
  journey_version_id: string;
  title: string;
  step_order: number;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type JourneyActivityRow = {
  id: string;
  organization_id: string;
  journey_step_id: string;
  title: string;
  periodicity: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type UserJourneyRow = {
  id: string;
  organization_id: string;
  user_id: string;
  journey_version_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type UserActivityProgressRow = {
  id: string;
  organization_id: string;
  user_journey_id: string;
  journey_activity_id: string;
  progress_percent: number;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type SupabaseJourneyRepositoryOptions = {
  client: SupabaseJourneyClient;
  now?: () => Date;
};

export class SupabaseJourneyRepository implements JourneyRepository {
  private readonly client: SupabaseJourneyClient;
  private readonly now: () => Date;

  constructor(options: SupabaseJourneyRepositoryOptions) {
    this.client = options.client;
    this.now = options.now ?? (() => new Date());
  }

  async resolveOperationalJourneyCatalog(
    input: ResolveOperationalJourneyCatalogInput
  ): Promise<JourneyResult<JourneyCatalog>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const versionsQuery = this.client
      .from('journey_versions')
      .select('id, organization_id, journey_id, code, status, version, created_at, updated_at')
      .eq('organization_id', input.context.organizationId)
      .eq('status', 'ativo')
      .order('version', { ascending: false })
      .order('updated_at', { ascending: false });

    const versionsResponse = await safeQuery<JourneyVersionRow[]>(versionsQuery);
    if (versionsResponse.error) return mapBackendError(versionsResponse.error);
    const versions = versionsResponse.data ?? [];
    if (versions.length === 0) return fail('JOURNEY_VERSION_NOT_FOUND');
    if (versions.length > 1) return fail('JOURNEY_VERSION_AMBIGUOUS');

    return this.resolveJourneyCatalogByVersion({
      context: input.context,
      journeyVersionId: versions[0].id,
    });
  }

  async resolveJourneyCatalogByVersion(
    input: ResolveJourneyCatalogByVersionInput
  ): Promise<JourneyResult<JourneyCatalog>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const versionQuery = this.client
      .from('journey_versions')
      .select('id, organization_id, journey_id, code, status, version, created_at, updated_at')
      .eq('organization_id', input.context.organizationId)
      .eq('id', input.journeyVersionId)
      .maybeSingle();
    const versionResponse = await safeQuery<JourneyVersionRow>(versionQuery);
    if (versionResponse.error) return mapBackendError(versionResponse.error);
    if (!versionResponse.data) return fail('JOURNEY_VERSION_NOT_FOUND');

    const journeyQuery = this.client
      .from('health_journeys')
      .select(
        'id, organization_id, name, description, target_audience, duration_weeks, technical_owner, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('id', versionResponse.data.journey_id)
      .maybeSingle();
    const journeyResponse = await safeQuery<HealthJourneyRow>(journeyQuery);
    if (journeyResponse.error) return mapBackendError(journeyResponse.error);
    if (!journeyResponse.data || journeyResponse.data.status !== 'ativo') {
      return fail('JOURNEY_VERSION_INELIGIBLE');
    }

    const stepsQuery = this.client
      .from('journey_steps')
      .select(
        'id, organization_id, journey_version_id, title, step_order, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('journey_version_id', input.journeyVersionId)
      .eq('status', 'ativo')
      .order('step_order', { ascending: true })
      .order('created_at', { ascending: true });
    const stepsResponse = await safeQuery<JourneyStepRow[]>(stepsQuery);
    if (stepsResponse.error) return mapBackendError(stepsResponse.error);
    const steps = (stepsResponse.data ?? []).map(mapJourneyStepRow);
    if (steps.length === 0) return fail('JOURNEY_VERSION_INCOMPATIBLE');
    const stepIds = new Set(steps.map((item) => item.id));

    const activitiesQuery = this.client
      .from('journey_activities')
      .select(
        'id, organization_id, journey_step_id, title, periodicity, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('status', 'ativo')
      .order('created_at', { ascending: true })
      .order('title', { ascending: true });
    const activitiesResponse = await safeQuery<JourneyActivityRow[]>(activitiesQuery);
    if (activitiesResponse.error) return mapBackendError(activitiesResponse.error);
    const activities = (activitiesResponse.data ?? [])
      .filter((item) => stepIds.has(item.journey_step_id))
      .map(mapJourneyActivityRow);

    return ok({
      journey: mapHealthJourneyRow(journeyResponse.data),
      version: mapJourneyVersionRow(versionResponse.data),
      steps,
      activities,
    });
  }

  async getLatestUserJourneyState(
    context: JourneyContext
  ): Promise<JourneyResult<{ userJourney: UserJourneyRecord; progress: UserActivityProgressRecord[] } | null>> {
    const validation = await this.validateContext(context);
    if (!validation.ok) return validation;

    const userJourneyQuery = this.client
      .from('user_journeys')
      .select(
        'id, organization_id, user_id, journey_version_id, started_at, completed_at, status, version, created_at, updated_at'
      )
      .eq('organization_id', context.organizationId)
      .eq('user_id', context.userId);
    const userJourneyResponse = await safeQuery<UserJourneyRow[]>(userJourneyQuery);
    if (userJourneyResponse.error) return mapBackendError(userJourneyResponse.error);
    const selected = sortUserJourneyRows(userJourneyResponse.data ?? [])[0];
    if (!selected) return ok(null);
    if (selected.organization_id !== context.organizationId || selected.user_id !== context.userId) {
      return fail('CROSS_TENANT_DATA');
    }

    const progressQuery = this.client
      .from('user_activity_progress')
      .select(
        'id, organization_id, user_journey_id, journey_activity_id, progress_percent, status, version, created_at, updated_at'
      )
      .eq('organization_id', context.organizationId)
      .eq('user_journey_id', selected.id)
      .order('created_at', { ascending: true });
    const progressResponse = await safeQuery<UserActivityProgressRow[]>(progressQuery);
    if (progressResponse.error) return mapBackendError(progressResponse.error);

    return ok({
      userJourney: mapUserJourneyRow(selected),
      progress: (progressResponse.data ?? []).map(mapUserActivityProgressRow),
    });
  }

  async createOrGetActiveUserJourney(
    input: CreateOrGetActiveUserJourneyInput
  ): Promise<JourneyResult<UserJourneyRecord>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const response = await safeRpc<UserJourneyRow>(this.client, 'create_or_get_active_user_journey', {
      p_organization_id: input.context.organizationId,
      p_journey_version_id: input.journeyVersionId,
      p_initial_status: input.status,
    });
    if (response.error) return mapBackendError(response.error);
    if (!response.data) return fail('TECHNICAL_ERROR');
    if (response.data.organization_id !== input.context.organizationId || response.data.user_id !== input.context.userId) {
      return fail('CROSS_TENANT_DATA');
    }
    return ok(mapUserJourneyRow(response.data));
  }

  async upsertUserActivityProgress(
    input: UpsertUserActivityProgressInput
  ): Promise<JourneyResult<UserActivityProgressRecord>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const existingQuery = this.client
      .from('user_activity_progress')
      .select(
        'id, organization_id, user_journey_id, journey_activity_id, progress_percent, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('user_journey_id', input.userJourneyId)
      .eq('journey_activity_id', input.journeyActivityId)
      .maybeSingle();
    const existingResponse = await safeQuery<UserActivityProgressRow>(existingQuery);
    if (existingResponse.error) return mapBackendError(existingResponse.error);

    const upsertQuery = this.client
      .from('user_activity_progress')
      .upsert(
        {
          organization_id: input.context.organizationId,
          user_journey_id: input.userJourneyId,
          journey_activity_id: input.journeyActivityId,
          progress_percent: input.progressPercent,
          status: input.status,
          updated_at: this.now().toISOString(),
          version: existingResponse.data ? existingResponse.data.version + 1 : 1,
        },
        { onConflict: 'user_journey_id,journey_activity_id' }
      )
      .select(
        'id, organization_id, user_journey_id, journey_activity_id, progress_percent, status, version, created_at, updated_at'
      )
      .maybeSingle();
    const upsertResponse = await safeQuery<UserActivityProgressRow>(upsertQuery);
    if (upsertResponse.error) return mapBackendError(upsertResponse.error);
    if (!upsertResponse.data) return fail('USER_JOURNEY_NOT_FOUND');
    return ok(mapUserActivityProgressRow(upsertResponse.data));
  }

  async markUserJourneyCompletion(
    input: MarkUserJourneyCompletionInput
  ): Promise<JourneyResult<UserJourneyRecord>> {
    const validation = await this.validateContext(input.context);
    if (!validation.ok) return validation;

    const existingQuery = this.client
      .from('user_journeys')
      .select(
        'id, organization_id, user_id, journey_version_id, started_at, completed_at, status, version, created_at, updated_at'
      )
      .eq('id', input.userJourneyId)
      .eq('organization_id', input.context.organizationId)
      .eq('user_id', input.context.userId)
      .maybeSingle();
    const existingResponse = await safeQuery<UserJourneyRow>(existingQuery);
    if (existingResponse.error) return mapBackendError(existingResponse.error);
    if (!existingResponse.data) return fail('USER_JOURNEY_NOT_FOUND');

    const updateQuery = this.client
      .from('user_journeys')
      .update({
        status: input.status,
        completed_at: input.completedAt,
        updated_at: this.now().toISOString(),
        version: existingResponse.data.version + 1,
      })
      .eq('id', input.userJourneyId)
      .eq('organization_id', input.context.organizationId)
      .eq('user_id', input.context.userId)
      .select(
        'id, organization_id, user_id, journey_version_id, started_at, completed_at, status, version, created_at, updated_at'
      )
      .maybeSingle();
    const updateResponse = await safeQuery<UserJourneyRow>(updateQuery);
    if (updateResponse.error) return mapBackendError(updateResponse.error);
    if (!updateResponse.data) return fail('USER_JOURNEY_NOT_FOUND');
    return ok(mapUserJourneyRow(updateResponse.data));
  }

  async listLinkedPatientJourneys(
    input: ListLinkedPatientJourneysInput
  ): Promise<JourneyResult<ClinicalPatientJourneyView[]>> {
    const validation = await this.validateClinicalContext(input.context);
    if (!validation.ok) return validation;

    const accessResponse = await safeRpc<boolean>(this.client, 'can_access_linked_patient_journey', {
      p_organization_id: input.context.organizationId,
      p_patient_user_id: input.context.patientUserId,
    });
    if (accessResponse.error) return mapBackendError(accessResponse.error);
    if (accessResponse.data !== true) return fail('CLINICAL_ACCESS_DENIED');

    const journeysQuery = this.client
      .from('user_journeys')
      .select(
        'id, organization_id, user_id, journey_version_id, started_at, completed_at, status, version, created_at, updated_at'
      )
      .eq('organization_id', input.context.organizationId)
      .eq('user_id', input.context.patientUserId);
    const journeysResponse = await safeQuery<UserJourneyRow[]>(journeysQuery);
    if (journeysResponse.error) return mapBackendError(journeysResponse.error);

    const ordered = sortUserJourneyRows(journeysResponse.data ?? []).filter(
      (row) =>
        row.organization_id === input.context.organizationId &&
        row.user_id === input.context.patientUserId
    );

    const views: ClinicalPatientJourneyView[] = [];
    for (const row of ordered) {
      const progressQuery = this.client
        .from('user_activity_progress')
        .select(
          'id, organization_id, user_journey_id, journey_activity_id, progress_percent, status, version, created_at, updated_at'
        )
        .eq('organization_id', input.context.organizationId)
        .eq('user_journey_id', row.id)
        .order('created_at', { ascending: true });
      const progressResponse = await safeQuery<UserActivityProgressRow[]>(progressQuery);
      if (progressResponse.error) return mapBackendError(progressResponse.error);
      const progress = (progressResponse.data ?? []).map(mapUserActivityProgressRow);

      let catalogName: string | null = null;
      const versionQuery = this.client
        .from('journey_versions')
        .select(
          'id, organization_id, journey_id, code, status, version, created_at, updated_at'
        )
        .eq('id', row.journey_version_id)
        .eq('organization_id', input.context.organizationId)
        .maybeSingle();
      const versionResponse = await safeQuery<JourneyVersionRow>(versionQuery);
      if (!versionResponse.error && versionResponse.data) {
        const journeyQuery = this.client
          .from('health_journeys')
          .select(
            'id, organization_id, name, description, target_audience, duration_weeks, technical_owner, status, version, created_at, updated_at'
          )
          .eq('id', versionResponse.data.journey_id)
          .eq('organization_id', input.context.organizationId)
          .maybeSingle();
        const journeyResponse = await safeQuery<HealthJourneyRow>(journeyQuery);
        if (!journeyResponse.error && journeyResponse.data) {
          catalogName = journeyResponse.data.name;
        }
      }

      views.push({
        userJourney: mapUserJourneyRow(row),
        progress,
        catalogName,
        completedActivityCount: progress.filter((item) => item.progressPercent >= 100).length,
        totalTrackedActivities: progress.length,
      });
    }

    return ok(views);
  }

  private async validateContext(context: JourneyContext): Promise<JourneyResult<true>> {
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

  private async validateClinicalContext(
    context: ListLinkedPatientJourneysInput['context']
  ): Promise<JourneyResult<true>> {
    if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
    if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
    if (!context.organizationId || !context.patientUserId) return fail('CLINICAL_ACCESS_DENIED');
    if (context.patientUserId === context.professionalUserId) return fail('CLINICAL_ACCESS_DENIED');
    let authResponse: SupabaseAuthResponse;
    try {
      authResponse = await this.client.auth.getUser();
    } catch (error: unknown) {
      authResponse = { data: { user: null }, error: normalizeThrownError(error) };
    }
    if (authResponse.error) return mapBackendError(authResponse.error);
    if (!authResponse.data.user?.id) return fail('NO_SESSION');
    if (authResponse.data.user.id !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
    return ok(true);
  }
}

function sortUserJourneyRows(rows: UserJourneyRow[]): UserJourneyRow[] {
  return [...rows].sort((a, b) => {
    const aActive = a.completed_at === null && a.status === 'ativo' ? 0 : 1;
    const bActive = b.completed_at === null && b.status === 'ativo' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const aCompleted = a.completed_at ?? '';
    const bCompleted = b.completed_at ?? '';
    if (aCompleted !== bCompleted) return bCompleted.localeCompare(aCompleted);
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function createSupabaseJourneyRepository(
  options: SupabaseJourneyRepositoryOptions
): JourneyRepository {
  return new SupabaseJourneyRepository(options);
}

function mapHealthJourneyRow(row: HealthJourneyRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    targetAudience: row.target_audience,
    durationWeeks: row.duration_weeks,
    technicalOwner: row.technical_owner,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJourneyVersionRow(row: JourneyVersionRow): JourneyVersion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    journeyId: row.journey_id,
    code: row.code,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJourneyStepRow(row: JourneyStepRow): JourneyStep {
  return {
    id: row.id,
    organizationId: row.organization_id,
    journeyVersionId: row.journey_version_id,
    title: row.title,
    stepOrder: row.step_order,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJourneyActivityRow(row: JourneyActivityRow): JourneyActivity {
  return {
    id: row.id,
    organizationId: row.organization_id,
    journeyStepId: row.journey_step_id,
    title: row.title,
    periodicity: row.periodicity,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserJourneyRow(row: UserJourneyRow): UserJourneyRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    journeyVersionId: row.journey_version_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserActivityProgressRow(row: UserActivityProgressRow): UserActivityProgressRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userJourneyId: row.user_journey_id,
    journeyActivityId: row.journey_activity_id,
    progressPercent: row.progress_percent,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBackendError(error: SupabaseLikeError): JourneyResult<never> {
  const code = (error.code ?? '').toUpperCase();
  const cause = {
    source: 'repository' as const,
    code: sanitizeErrorCode(error.code, error.status),
    message: sanitizeErrorMessage(error.message),
  };
  if (code === '42501') return fail('CROSS_TENANT_DATA', { cause, transient: false });
  if (code === '23503') return fail('ACTIVITY_NOT_FOUND', { cause, transient: false });
  if (code === '23505') return fail('TECHNICAL_ERROR', { cause, transient: false });
  if (code === 'P0001') {
    const msg = (cause.message ?? '').toLowerCase();
    if (msg.includes('vinculo') || msg.includes('tenant')) {
      return fail('NO_ACTIVE_MEMBERSHIP', { cause, transient: false });
    }
    if (msg.includes('inexistente') || msg.includes('elegivel')) {
      return fail('JOURNEY_VERSION_INELIGIBLE', { cause, transient: false });
    }
  }
  return fail('TECHNICAL_ERROR', { cause, transient: isTransientError(error) });
}

async function safeQuery<T>(
  query: PromiseLike<SupabaseQueryResponse<unknown>>
): Promise<SupabaseQueryResponse<T>> {
  try {
    return (await query) as SupabaseQueryResponse<T>;
  } catch (error: unknown) {
    return { data: null, error: normalizeThrownError(error) };
  }
}

async function safeRpc<T>(
  client: SupabaseJourneyClient,
  fn: string,
  args: Record<string, unknown>
): Promise<SupabaseQueryResponse<T>> {
  try {
    return (await client.rpc(fn, args)) as SupabaseQueryResponse<T>;
  } catch (error: unknown) {
    return { data: null, error: normalizeThrownError(error) };
  }
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
  if (code.startsWith('ETIMEDOUT') || code.startsWith('ECONNRESET') || code === 'PGRST301') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('timeout') || message.includes('temporar') || message.includes('network');
}
