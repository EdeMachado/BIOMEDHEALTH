import { describe, expect, it } from 'vitest';
import { createSupabaseAssessmentRepository, type SupabaseAssessmentClient } from '@/services/repositories/assessment/supabaseAssessmentRepository';
import type { AssessmentContext } from '@/services/repositories/assessment/types';

type FakeError = { message?: string; code?: string; status?: number };

type Fixtures = {
  assessment_versions: Array<Record<string, unknown>>;
  assessment_questions: Array<Record<string, unknown>>;
  assessment_options: Array<Record<string, unknown>>;
  assessments: Array<Record<string, unknown>>;
  assessment_responses: Array<Record<string, unknown>>;
  risk_results: Array<Record<string, unknown>>;
};

function context(overrides: Partial<AssessmentContext> = {}): AssessmentContext {
  return {
    sessionUserId: 'usr-1',
    userId: 'usr-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

class FakeSupabaseAssessmentClient implements SupabaseAssessmentClient {
  authUserId: string | null = 'usr-1';
  forcedInsertError: FakeError | null = null;
  forcedUpdateError: FakeError | null = null;

  constructor(public fixtures: Fixtures, private readonly nowIso: string) {}

  now(): string {
    return this.nowIso;
  }

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
    if (fn !== 'create_or_get_active_assessment') {
      return Promise.resolve({
        data: null,
        error: { code: '42883', message: `function ${fn} not found` },
      });
    }

    const authUserId = this.authUserId;
    if (!authUserId) {
      return Promise.resolve({
        data: null,
        error: { code: '42501', message: 'session required' },
      });
    }

    const orgId = readStringArg(args, 'p_organization_id');
    const versionId = readStringArg(args, 'p_assessment_version_id');
    const status = readStringArg(args, 'p_initial_status') || 'em_andamento';
    if (orgId !== 'org-1') {
      return Promise.resolve({
        data: null,
        error: { code: '42501', message: 'organization link required' },
      });
    }
    const version = this.fixtures.assessment_versions.find(
      (item) => item['id'] === versionId && item['organization_id'] === orgId
    );
    if (!version || version['status'] !== 'ativo') {
      return Promise.resolve({
        data: null,
        error: { code: 'P0001', message: 'SUP-B02: versao nao elegivel.' },
      });
    }
    const existing = this.fixtures.assessments.find(
      (item) =>
        item['organization_id'] === orgId &&
        item['user_id'] === authUserId &&
        item['assessment_version_id'] === versionId &&
        item['status'] === 'em_andamento'
    );
    if (existing) {
      return Promise.resolve({ data: existing, error: null });
    }

    const now = this.now();
    const row = {
      id: `ass-${this.fixtures.assessments.length + 1}`,
      organization_id: orgId,
      user_id: authUserId,
      assessment_version_id: versionId,
      status,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    this.fixtures.assessments.push(row);
    return Promise.resolve({ data: row, error: null });
  }

  from(table: string) {
    return {
      select: (columns: string) => new SelectQuery(this, table, columns),
      insert: (values: Record<string, unknown>) => new InsertQuery(this, table, values),
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
    private readonly client: FakeSupabaseAssessmentClient,
    private readonly table: string,
    private readonly columns: string
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
    onfulfilled?: ((value: { data: Record<string, unknown>[]; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
  private run() {
    const rows = this.client.fixtures[this.table as keyof Fixtures] ?? [];
    const filtered = rows.filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value)
    );
    if (this.columns.includes('consent_documents(')) {
      return Promise.resolve({ data: filtered, error: null });
    }
    return Promise.resolve({ data: filtered, error: null });
  }
}

class InsertQuery {
  constructor(
    private readonly client: FakeSupabaseAssessmentClient,
    private readonly table: string,
    private readonly values: Record<string, unknown>
  ) {}
  select(): MutationSelectQuery {
    return new MutationSelectQuery(() => this.maybeSingle());
  }
  maybeSingle() {
    if (this.client.forcedInsertError) {
      return Promise.resolve({ data: null, error: this.client.forcedInsertError });
    }
    const now = this.client.now();
    if (this.table === 'assessments') {
      const row = {
        id: `ass-${this.client.fixtures.assessments.length + 1}`,
        organization_id: this.values['organization_id'],
        user_id: this.values['user_id'],
        assessment_version_id: this.values['assessment_version_id'],
        status: this.values['status'] ?? 'em_andamento',
        version: 1,
        created_at: now,
        updated_at: now,
      };
      this.client.fixtures.assessments.push(row);
      return Promise.resolve({ data: row, error: null });
    }
    if (this.table === 'assessment_responses') {
      const row = {
        id: `resp-${this.client.fixtures.assessment_responses.length + 1}`,
        organization_id: this.values['organization_id'],
        assessment_id: this.values['assessment_id'],
        assessment_question_id: this.values['assessment_question_id'],
        answer_text: this.values['answer_text'] ?? null,
        answer_value: this.values['answer_value'] ?? null,
        status: 'ativo',
        version: 1,
        created_at: now,
        updated_at: now,
      };
      this.client.fixtures.assessment_responses.push(row);
      return Promise.resolve({ data: row, error: null });
    }
    if (this.table === 'risk_results') {
      const row = {
        id: `risk-${this.client.fixtures.risk_results.length + 1}`,
        organization_id: this.values['organization_id'],
        assessment_id: this.values['assessment_id'],
        level: this.values['level'],
        message: this.values['message'],
        explainability: this.values['explainability'],
        status: 'ativo',
        version: 1,
        created_at: now,
        updated_at: now,
      };
      this.client.fixtures.risk_results.push(row);
      return Promise.resolve({ data: row, error: null });
    }
    return Promise.resolve({ data: null, error: { code: '42809', message: 'write forbidden' } });
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
    private readonly client: FakeSupabaseAssessmentClient,
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
    if (this.client.forcedUpdateError) {
      return Promise.resolve({ data: null, error: this.client.forcedUpdateError });
    }
    const rows = this.client.fixtures[this.table as keyof Fixtures] ?? [];
    const index = rows.findIndex((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value)
    );
    if (index < 0) return Promise.resolve({ data: null, error: null });
    const updated = {
      ...rows[index],
      ...this.values,
    };
    rows[index] = updated;
    return Promise.resolve({ data: updated, error: null });
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

class UpsertQuery {
  constructor(
    private readonly client: FakeSupabaseAssessmentClient,
    private readonly table: string,
    private readonly values: Record<string, unknown>,
    private readonly options?: { onConflict?: string }
  ) {}
  select(): MutationSelectQuery {
    return new MutationSelectQuery(() => this.maybeSingle());
  }
  maybeSingle() {
    if (this.table === 'assessment_responses') {
      const onConflict = this.options?.onConflict ?? '';
      if (onConflict !== 'assessment_id,assessment_question_id') {
        return Promise.resolve({
          data: null,
          error: { code: '42P10', message: 'invalid on conflict target' },
        });
      }
      const rows = this.client.fixtures.assessment_responses;
      const index = rows.findIndex(
        (item) =>
          item['assessment_id'] === this.values['assessment_id'] &&
          item['assessment_question_id'] === this.values['assessment_question_id']
      );
      if (index >= 0) {
        rows[index] = { ...rows[index], ...this.values };
        return Promise.resolve({ data: rows[index], error: null });
      }
      const now = this.client.now();
      const row = {
        id: `resp-${rows.length + 1}`,
        organization_id: this.values['organization_id'],
        assessment_id: this.values['assessment_id'],
        assessment_question_id: this.values['assessment_question_id'],
        answer_text: this.values['answer_text'] ?? null,
        answer_value: this.values['answer_value'] ?? null,
        status: 'ativo',
        version: Number(this.values['version'] ?? 1),
        created_at: now,
        updated_at: this.values['updated_at'] ?? now,
      };
      rows.push(row);
      return Promise.resolve({ data: row, error: null });
    }

    if (this.table === 'risk_results') {
      const onConflict = this.options?.onConflict ?? '';
      if (onConflict !== 'assessment_id') {
        return Promise.resolve({
          data: null,
          error: { code: '42P10', message: 'invalid on conflict target' },
        });
      }
      const rows = this.client.fixtures.risk_results;
      const index = rows.findIndex(
        (item) => item['assessment_id'] === this.values['assessment_id']
      );
      if (index >= 0) {
        rows[index] = { ...rows[index], ...this.values };
        return Promise.resolve({ data: rows[index], error: null });
      }
      const now = this.client.now();
      const row = {
        id: `risk-${rows.length + 1}`,
        organization_id: this.values['organization_id'],
        assessment_id: this.values['assessment_id'],
        level: this.values['level'],
        message: this.values['message'],
        explainability: this.values['explainability'],
        status: 'ativo',
        version: Number(this.values['version'] ?? 1),
        created_at: now,
        updated_at: this.values['updated_at'] ?? now,
      };
      rows.push(row);
      return Promise.resolve({ data: row, error: null });
    }
    return Promise.resolve({
      data: null,
      error: { code: '42809', message: 'upsert forbidden' },
    });
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

function readStringArg(
  args: Record<string, unknown> | undefined,
  key: string
): string {
  const value = args?.[key];
  return typeof value === 'string' ? value : '';
}

function createFixtures(): Fixtures {
  return {
    assessment_versions: [
      {
        id: 'ver-1',
        organization_id: 'org-1',
        code: 'initial_preventive_assessment',
        title: 'Avaliacao v1',
        status: 'ativo',
        version: 1,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'ver-2',
        organization_id: 'org-1',
        code: 'initial_preventive_assessment',
        title: 'Avaliacao v2',
        status: 'inativo',
        version: 2,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ],
    assessment_questions: [
      { id: 'q1', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'contexto', prompt: 'x', question_order: 1, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'q2', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'contexto', prompt: 'x', question_order: 2, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'q3', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'sono', prompt: 'x', question_order: 1, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'q4', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'sono', prompt: 'x', question_order: 2, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'q5', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'movimento', prompt: 'x', question_order: 1, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'q6', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'movimento', prompt: 'x', question_order: 2, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'q7', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'bem_estar', prompt: 'x', question_order: 1, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'q8', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'bem_estar', prompt: 'x', question_order: 2, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'q9', organization_id: 'org-1', assessment_version_id: 'ver-1', domain: 'consentimento', prompt: 'x', question_order: 1, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
    ],
    assessment_options: [
      { id: 'o1', organization_id: 'org-1', assessment_question_id: 'q1', label: 'Rotina', value: 'rotina', score: null, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'o2', organization_id: 'org-1', assessment_question_id: 'q1', label: 'Sono', value: 'sono', score: null, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'o3', organization_id: 'org-1', assessment_question_id: 'q4', label: 'Regular', value: 'regular', score: null, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'o4', organization_id: 'org-1', assessment_question_id: 'q6', label: 'Moderada', value: 'moderada', score: null, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      { id: 'o5', organization_id: 'org-1', assessment_question_id: 'q9', label: 'Aceito', value: 'true', score: null, status: 'ativo', version: 1, created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
    ],
    assessments: [],
    assessment_responses: [],
    risk_results: [],
  };
}

function createSut() {
  const client = new FakeSupabaseAssessmentClient(
    createFixtures(),
    '2026-08-01T10:00:00.000Z'
  );
  const repository = createSupabaseAssessmentRepository({ client });
  return { client, repository };
}

describe('supabaseAssessmentRepository integration', () => {
  it('concorrencia de criacao retorna a mesma avaliacao ativa', async () => {
    const { repository } = createSut();
    const [first, second] = await Promise.all([
      repository.createAssessment({
        context: context(),
        assessmentVersionId: 'ver-1',
        status: 'em_andamento',
      }),
      repository.createAssessment({
        context: context(),
        assessmentVersionId: 'ver-1',
        status: 'em_andamento',
      }),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.id).toBe(second.data.id);
  });

  it('titular cria avaliacao, atualiza resposta e conclui risco', async () => {
    const { repository, client } = createSut();
    const catalog = await repository.resolveAssessmentCatalog({
      context: context(),
      versionCode: 'initial_preventive_assessment',
    });
    expect(catalog.ok).toBe(true);
    if (!catalog.ok) return;

    const created = await repository.createAssessment({
      context: context(),
      assessmentVersionId: catalog.data.version.id,
      status: 'em_andamento',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const firstResponse = await repository.upsertAssessmentResponse({
      context: context(),
      assessmentId: created.data.id,
      assessmentVersionId: catalog.data.version.id,
      assessmentQuestionId: 'q1',
      answerText: null,
      answerValue: 'sono',
    });
    expect(firstResponse.ok).toBe(true);
    if (!firstResponse.ok) return;

    const updatedResponse = await repository.upsertAssessmentResponse({
      context: context(),
      assessmentId: created.data.id,
      assessmentVersionId: catalog.data.version.id,
      assessmentQuestionId: 'q1',
      answerText: null,
      answerValue: 'rotina',
    });
    expect(updatedResponse.ok).toBe(true);
    if (!updatedResponse.ok) return;
    expect(updatedResponse.data.version).toBeGreaterThan(firstResponse.data.version);
    expect(client.fixtures.assessment_responses).toHaveLength(1);

    const risk = await repository.upsertRiskResult({
      context: context(),
      assessmentId: created.data.id,
      level: 'moderado',
      message: 'Orientativo',
      explainability: '{"rationale":["demo"]}',
    });
    expect(risk.ok).toBe(true);
    const riskRepeat = await repository.upsertRiskResult({
      context: context(),
      assessmentId: created.data.id,
      level: 'atencao',
      message: 'Orientativo atualizado',
      explainability: '{"rationale":["demo2"]}',
    });
    expect(riskRepeat.ok).toBe(true);
    expect(client.fixtures.risk_results).toHaveLength(1);

    const completed = await repository.markAssessmentStatus({
      context: context(),
      assessmentId: created.data.id,
      status: 'concluida',
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.data.status).toBe('concluida');
  });

  it('nega tentativas cross-user e cross-tenant', async () => {
    const { repository, client } = createSut();
    const crossUser = await repository.resolveAssessmentCatalog({
      context: context({ userId: 'usr-2' }),
      versionCode: 'initial_preventive_assessment',
    });
    expect(crossUser.ok).toBe(false);
    if (crossUser.ok) return;
    expect(crossUser.error.code).toBe('IDENTITY_MISMATCH');

    client.forcedInsertError = { code: '42501', message: 'permission denied' };
    const created = await repository.createAssessment({
      context: context({ organizationId: 'org-2' }),
      assessmentVersionId: 'ver-1',
      status: 'em_andamento',
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe('CROSS_TENANT_DATA');
  });

  it('rejeita versao ineligivel quando nenhuma ativa existe', async () => {
    const { repository, client } = createSut();
    client.fixtures.assessment_versions = [
      {
        id: 'ver-2',
        organization_id: 'org-1',
        code: 'initial_preventive_assessment',
        title: 'Avaliacao v2',
        status: 'futuro',
        version: 2,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ];
    const catalog = await repository.resolveAssessmentCatalog({
      context: context(),
      versionCode: 'initial_preventive_assessment',
    });
    expect(catalog.ok).toBe(false);
    if (catalog.ok) return;
    expect(catalog.error.code).toBe('VERSION_INELIGIBLE');
  });
});
