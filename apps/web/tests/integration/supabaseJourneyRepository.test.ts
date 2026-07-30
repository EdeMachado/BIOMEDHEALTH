import { describe, expect, it } from 'vitest';
import {
  createSupabaseJourneyRepository,
  type SupabaseJourneyClient,
} from '@/services/repositories/journey/supabaseJourneyRepository';
import type { JourneyContext } from '@/services/repositories/journey/types';

type FakeError = { message?: string; code?: string; status?: number };

type Fixtures = {
  health_journeys: Array<Record<string, unknown>>;
  journey_versions: Array<Record<string, unknown>>;
  journey_steps: Array<Record<string, unknown>>;
  journey_activities: Array<Record<string, unknown>>;
  user_journeys: Array<Record<string, unknown>>;
  user_activity_progress: Array<Record<string, unknown>>;
};

function context(overrides: Partial<JourneyContext> = {}): JourneyContext {
  return {
    sessionUserId: 'usr-1',
    userId: 'usr-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

class FakeSupabaseJourneyClient implements SupabaseJourneyClient {
  authUserId: string | null = 'usr-1';
  forcedUpsertError: FakeError | null = null;

  constructor(public fixtures: Fixtures, private readonly nowIso: string) {}

  auth = {
    getUser: () =>
      Promise.resolve({
        data: { user: this.authUserId ? { id: this.authUserId } : null },
        error: null,
      }),
  };

  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<{ data: Record<string, unknown> | null; error: FakeError | null }> {
    if (fn !== 'create_or_get_active_user_journey') {
      return Promise.resolve({
        data: null,
        error: { code: '42883', message: `function ${fn} not found` },
      });
    }
    if (!this.authUserId) {
      return Promise.resolve({ data: null, error: { code: '42501', message: 'session required' } });
    }
    const orgId = stringArg(args, 'p_organization_id');
    const versionId = stringArg(args, 'p_journey_version_id');
    if (orgId !== 'org-1') {
      return Promise.resolve({ data: null, error: { code: '42501', message: 'cross tenant' } });
    }
    const version = this.fixtures.journey_versions.find(
      (item) =>
        item['id'] === versionId &&
        item['organization_id'] === orgId &&
        item['status'] === 'ativo'
    );
    if (!version) {
      return Promise.resolve({ data: null, error: { code: 'P0001', message: 'versao ineligivel' } });
    }
    const existing = this.fixtures.user_journeys.find(
      (item) =>
        item['organization_id'] === orgId &&
        item['user_id'] === this.authUserId &&
        item['status'] === 'ativo' &&
        item['completed_at'] === null
    );
    if (existing) return Promise.resolve({ data: existing, error: null });
    const row = {
      id: `uj-${this.fixtures.user_journeys.length + 1}`,
      organization_id: orgId,
      user_id: this.authUserId,
      journey_version_id: versionId,
      started_at: this.nowIso,
      completed_at: null,
      status: 'ativo',
      version: 1,
      created_at: this.nowIso,
      updated_at: this.nowIso,
    };
    this.fixtures.user_journeys.push(row);
    return Promise.resolve({ data: row, error: null });
  }

  from(table: string) {
    return {
      select: () => new SelectQuery(this, table),
      upsert: (
        values: Record<string, unknown>,
        options?: { onConflict?: string }
      ) => new UpsertQuery(this, table, values, options),
      update: (values: Record<string, unknown>) => new UpdateQuery(this, table, values),
    };
  }
}

class SelectQuery {
  private filters: Array<{ column: string; value: unknown }> = [];
  constructor(
    private readonly client: FakeSupabaseJourneyClient,
    private readonly table: string
  ) {}
  eq(column: string, value: unknown): SelectQuery {
    this.filters.push({ column, value });
    return this;
  }
  order(): SelectQuery {
    return this;
  }
  async maybeSingle() {
    const data = await this.run();
    return { data: data.data[0] ?? null, error: data.error };
  }
  then<TResult1 = { data: Record<string, unknown>[]; error: FakeError | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Record<string, unknown>[]; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
  private run() {
    const rows = this.client.fixtures[this.table as keyof Fixtures] ?? [];
    const filtered = rows.filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value)
    );
    return Promise.resolve({ data: filtered, error: null });
  }
}

class UpsertQuery {
  constructor(
    private readonly client: FakeSupabaseJourneyClient,
    private readonly table: string,
    private readonly values: Record<string, unknown>,
    private readonly options?: { onConflict?: string }
  ) {}
  select(): MutationSelectQuery {
    return new MutationSelectQuery(() => this.maybeSingle());
  }
  maybeSingle() {
    if (this.client.forcedUpsertError) {
      return Promise.resolve({ data: null, error: this.client.forcedUpsertError });
    }
    if (this.table !== 'user_activity_progress') {
      return Promise.resolve({ data: null, error: { code: '42809', message: 'upsert forbidden' } });
    }
    if (this.options?.onConflict !== 'user_journey_id,journey_activity_id') {
      return Promise.resolve({
        data: null,
        error: { code: '42P10', message: 'invalid conflict target' },
      });
    }
    // Simulacao local de imutabilidade pos-conclusao (NAO prova RLS real do Postgres).
    const journey = this.client.fixtures.user_journeys.find(
      (item) => item['id'] === this.values['user_journey_id']
    );
    if (!journey) {
      return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'journey missing' } });
    }
    if (journey['completed_at'] !== null || journey['status'] !== 'ativo') {
      return Promise.resolve({
        data: null,
        error: { code: '42501', message: 'progress write denied on completed journey' },
      });
    }
    const rows = this.client.fixtures.user_activity_progress;
    const index = rows.findIndex(
      (item) =>
        item['user_journey_id'] === this.values['user_journey_id'] &&
        item['journey_activity_id'] === this.values['journey_activity_id']
    );
    if (index >= 0) {
      rows[index] = { ...rows[index], ...this.values };
      return Promise.resolve({ data: rows[index], error: null });
    }
    const row = {
      id: `uap-${rows.length + 1}`,
      organization_id: this.values['organization_id'],
      user_journey_id: this.values['user_journey_id'],
      journey_activity_id: this.values['journey_activity_id'],
      progress_percent: this.values['progress_percent'],
      status: this.values['status'] ?? 'em_andamento',
      version: Number(this.values['version'] ?? 1),
      created_at: '2026-08-01T10:00:00.000Z',
      updated_at: this.values['updated_at'] ?? '2026-08-01T10:00:00.000Z',
    };
    rows.push(row);
    return Promise.resolve({ data: row, error: null });
  }
  then<TResult1 = { data: Record<string, unknown> | null; error: FakeError | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Record<string, unknown> | null; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.maybeSingle().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

class UpdateQuery {
  private filters: Array<{ column: string; value: unknown }> = [];
  constructor(
    private readonly client: FakeSupabaseJourneyClient,
    private readonly table: string,
    private readonly values: Record<string, unknown>
  ) {}
  eq(column: string, value: unknown): UpdateQuery {
    this.filters.push({ column, value });
    return this;
  }
  select(): MutationSelectQuery {
    return new MutationSelectQuery(() => this.maybeSingle());
  }
  maybeSingle() {
    const rows = this.client.fixtures[this.table as keyof Fixtures] ?? [];
    const index = rows.findIndex((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value)
    );
    if (index < 0) return Promise.resolve({ data: null, error: null });
    // Simulacao local de bloqueio de reabertura (NAO prova RLS real do Postgres).
    if (this.table === 'user_journeys') {
      const current = rows[index];
      if (current['completed_at'] !== null) {
        return Promise.resolve({ data: null, error: null });
      }
      const nextCompletedAt = this.values['completed_at'];
      const nextStatus = this.values['status'];
      const completedAt = nextCompletedAt === undefined ? current['completed_at'] : nextCompletedAt;
      const status = nextStatus === undefined ? current['status'] : nextStatus;
      const coherent =
        (completedAt === null && status === 'ativo') ||
        (completedAt !== null && status === 'concluida');
      if (!coherent) {
        return Promise.resolve({
          data: null,
          error: { code: '42501', message: 'incoherent journey terminal state' },
        });
      }
    }
    if (this.table === 'user_activity_progress') {
      const journeyId = rows[index]['user_journey_id'];
      const journey = this.client.fixtures.user_journeys.find((item) => item['id'] === journeyId);
      if (!journey || journey['completed_at'] !== null || journey['status'] !== 'ativo') {
        return Promise.resolve({ data: null, error: null });
      }
    }
    rows[index] = { ...rows[index], ...this.values };
    return Promise.resolve({ data: rows[index], error: null });
  }
  then<TResult1 = { data: Record<string, unknown> | null; error: FakeError | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Record<string, unknown> | null; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.maybeSingle().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

class MutationSelectQuery {
  constructor(
    private readonly resolver: () => Promise<{ data: Record<string, unknown> | null; error: FakeError | null }>
  ) {}
  eq(): MutationSelectQuery {
    return this;
  }
  order(): MutationSelectQuery {
    return this;
  }
  maybeSingle() {
    return this.resolver();
  }
  then<TResult1 = { data: Record<string, unknown> | null; error: FakeError | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Record<string, unknown> | null; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.maybeSingle().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

function stringArg(args: Record<string, unknown> | undefined, key: string): string {
  const value = args?.[key];
  return typeof value === 'string' ? value : '';
}

function createFixtures(): Fixtures {
  return {
    health_journeys: [
      {
        id: 'hj-1',
        organization_id: 'org-1',
        name: 'Journey',
        description: 'd',
        target_audience: 'a',
        duration_weeks: 8,
        technical_owner: 'team',
        status: 'ativo',
        version: 1,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
    ],
    journey_versions: [
      {
        id: 'ver-1',
        organization_id: 'org-1',
        journey_id: 'hj-1',
        code: 'preventive',
        status: 'ativo',
        version: 1,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'ver-2',
        organization_id: 'org-1',
        journey_id: 'hj-1',
        code: 'preventive-v2',
        status: 'inativo',
        version: 2,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ],
    journey_steps: [
      {
        id: 'step-1',
        organization_id: 'org-1',
        journey_version_id: 'ver-1',
        title: 'Semana 1',
        step_order: 1,
        status: 'ativo',
        version: 1,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'step-2',
        organization_id: 'org-1',
        journey_version_id: 'ver-2',
        title: 'Semana 1 v2',
        step_order: 1,
        status: 'ativo',
        version: 1,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ],
    journey_activities: [
      {
        id: 'act-1',
        organization_id: 'org-1',
        journey_step_id: 'step-1',
        title: 'Atividade',
        periodicity: 'Diaria',
        status: 'ativo',
        version: 1,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'act-1b',
        organization_id: 'org-1',
        journey_step_id: 'step-1',
        title: 'Atividade B',
        periodicity: 'Diaria',
        status: 'ativo',
        version: 1,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'act-2',
        organization_id: 'org-1',
        journey_step_id: 'step-2',
        title: 'Atividade v2',
        periodicity: 'Diaria',
        status: 'ativo',
        version: 1,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ],
    user_journeys: [],
    user_activity_progress: [],
  };
}

function createSut() {
  const client = new FakeSupabaseJourneyClient(
    createFixtures(),
    '2026-08-01T10:00:00.000Z'
  );
  return {
    client,
    repository: createSupabaseJourneyRepository({ client }),
  };
}

describe('supabaseJourneyRepository integration (fake Supabase client; nao prova RLS Postgres)', () => {
  it('resolve versao historica inativa sem bloquear retomada', async () => {
    const { repository } = createSut();
    const historical = await repository.resolveJourneyCatalogByVersion({
      context: context(),
      journeyVersionId: 'ver-2',
    });
    expect(historical.ok).toBe(true);
    if (!historical.ok) return;
    expect(historical.data.version.id).toBe('ver-2');
    expect(historical.data.version.status).toBe('inativo');
    expect(historical.data.steps).toHaveLength(1);
    expect(historical.data.activities).toHaveLength(1);
  });

  it('retorna a mesma jornada ativa em chamadas concorrentes', async () => {
    const { repository } = createSut();
    const [first, second] = await Promise.all([
      repository.createOrGetActiveUserJourney({
        context: context(),
        journeyVersionId: 'ver-1',
        status: 'ativo',
      }),
      repository.createOrGetActiveUserJourney({
        context: context(),
        journeyVersionId: 'ver-1',
        status: 'ativo',
      }),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.id).toBe(second.data.id);
  });

  it('upsert de progresso atualiza o mesmo registro', async () => {
    const { repository, client } = createSut();
    const created = await repository.createOrGetActiveUserJourney({
      context: context(),
      journeyVersionId: 'ver-1',
      status: 'ativo',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const first = await repository.upsertUserActivityProgress({
      context: context(),
      userJourneyId: created.data.id,
      journeyVersionId: 'ver-1',
      journeyActivityId: 'act-1',
      progressPercent: 20,
      status: 'em_andamento',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await repository.upsertUserActivityProgress({
      context: context(),
      userJourneyId: created.data.id,
      journeyVersionId: 'ver-1',
      journeyActivityId: 'act-1',
      progressPercent: 100,
      status: 'concluida',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.version).toBeGreaterThan(first.data.version);
    expect(client.fixtures.user_activity_progress).toHaveLength(1);
  });

  it('nega tentativa cross-user e mapeia erro cross-tenant', async () => {
    const { repository, client } = createSut();
    const crossUser = await repository.resolveOperationalJourneyCatalog({
      context: context({ userId: 'usr-2' }),
    });
    expect(crossUser.ok).toBe(false);
    if (crossUser.ok) return;
    expect(crossUser.error.code).toBe('IDENTITY_MISMATCH');

    client.authUserId = null;
    const noSession = await repository.resolveOperationalJourneyCatalog({
      context: context(),
    });
    expect(noSession.ok).toBe(false);
    if (noSession.ok) return;
    expect(noSession.error.code).toBe('NO_SESSION');
  });

  it('permite conclusao legitima e bloqueia progresso/reabertura apos terminal', async () => {
    const { repository, client } = createSut();
    const created = await repository.createOrGetActiveUserJourney({
      context: context(),
      journeyVersionId: 'ver-1',
      status: 'ativo',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const progress = await repository.upsertUserActivityProgress({
      context: context(),
      userJourneyId: created.data.id,
      journeyVersionId: 'ver-1',
      journeyActivityId: 'act-1',
      progressPercent: 100,
      status: 'concluida',
    });
    expect(progress.ok).toBe(true);
    if (!progress.ok) return;

    const completed = await repository.markUserJourneyCompletion({
      context: context(),
      userJourneyId: created.data.id,
      completedAt: '2026-08-01T12:00:00.000Z',
      status: 'concluida',
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.data.completedAt).toBe('2026-08-01T12:00:00.000Z');

    const insertAfter = await repository.upsertUserActivityProgress({
      context: context(),
      userJourneyId: created.data.id,
      journeyVersionId: 'ver-1',
      journeyActivityId: 'act-1b',
      progressPercent: 10,
      status: 'em_andamento',
    });
    expect(insertAfter.ok).toBe(false);
    if (insertAfter.ok) return;
    expect(insertAfter.error.code).toBe('CROSS_TENANT_DATA');

    const updateAfter = await repository.upsertUserActivityProgress({
      context: context(),
      userJourneyId: created.data.id,
      journeyVersionId: 'ver-1',
      journeyActivityId: 'act-1',
      progressPercent: 50,
      status: 'em_andamento',
    });
    expect(updateAfter.ok).toBe(false);

    const reopen = await repository.markUserJourneyCompletion({
      context: context(),
      userJourneyId: created.data.id,
      completedAt: '2026-08-01T11:00:00.000Z',
      status: 'ativo',
    });
    expect(reopen.ok).toBe(false);
    expect(client.fixtures.user_journeys[0]?.['completed_at']).toBe('2026-08-01T12:00:00.000Z');
    expect(client.fixtures.user_activity_progress).toHaveLength(1);
  });
});
