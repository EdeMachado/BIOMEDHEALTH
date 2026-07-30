import { describe, expect, it } from 'vitest';
import { createSupabaseConsentRepository, type SupabaseConsentClient } from '@/services/repositories/consent/supabaseConsentRepository';
import type { ConsentContext } from '@/services/repositories/consent/types';

type FakeError = { message?: string; code?: string; status?: number };

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
};

type Fixtures = {
  consent_documents: ConsentDocumentRow[];
  user_consents: UserConsentRow[];
};

type ForcedErrors = {
  insert_user_consents?: FakeError;
};

function context(overrides: Partial<ConsentContext> = {}): ConsentContext {
  return {
    sessionUserId: 'usr-1',
    userId: 'usr-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

class FakeSupabaseConsentClient implements SupabaseConsentClient {
  authUserId: string | null = 'usr-1';
  forcedErrors: ForcedErrors = {};

  constructor(public fixtures: Fixtures, private readonly nowIso: string) {}

  auth = {
    getUser: () =>
      Promise.resolve({
      data: { user: this.authUserId ? { id: this.authUserId } : null },
      error: null,
    }),
  };

  from(table: string) {
    return {
      select: (columns: string) => new SelectQuery(this, table, columns),
      insert: (values: Record<string, unknown>) => new InsertQuery(this, table, values),
      update: (values: Record<string, unknown>) => new UpdateQuery(this, table, values),
    };
  }

  readTable(table: string): Array<Record<string, unknown>> {
    if (table === 'consent_documents') return this.fixtures.consent_documents;
    if (table === 'user_consents') return this.fixtures.user_consents;
    return [];
  }

  writeInsert(table: string, values: Record<string, unknown>): { data: Record<string, unknown> | null; error: FakeError | null } {
    if (table !== 'user_consents') return { data: null, error: { code: '42809', message: 'write forbidden' } };
    if (this.forcedErrors.insert_user_consents) {
      return { data: null, error: this.forcedErrors.insert_user_consents };
    }
    const organizationId = String(values['organization_id']);
    const userId = String(values['user_id']);
    const documentId = String(values['consent_document_id']);
    const sourceValue = values['source'];
    const source = typeof sourceValue === 'string' && sourceValue.length > 0 ? sourceValue : 'web';
    const document = this.fixtures.consent_documents.find(
      (item) => item.id === documentId && item.organization_id === organizationId
    );
    if (!document) {
      return { data: null, error: { code: 'P0001', message: 'SUP-B01.2: consent_document_id inexistente' } };
    }
    const now = Date.parse(this.nowIso);
    const effectiveAt = Date.parse(document.effective_at);
    const expiresAt = document.expires_at ? Date.parse(document.expires_at) : null;
    if (
      document.status !== 'ativo' ||
      effectiveAt > now ||
      (expiresAt !== null && expiresAt <= now)
    ) {
      return {
        data: null,
        error: { code: 'P0001', message: 'SUP-B01.2: documento de consentimento nao e elegivel para novo aceite.' },
      };
    }
    const hasActive = this.fixtures.user_consents.some(
      (item) =>
        item.organization_id === organizationId &&
        item.user_id === userId &&
        item.consent_document_id === documentId &&
        item.revoked_at === null
    );
    if (hasActive) return { data: null, error: { code: '23505', message: 'duplicate key value' } };
    const timestamp = this.nowIso;
    const row: UserConsentRow = {
      id: `cons-${this.fixtures.user_consents.length + 1}`,
      organization_id: organizationId,
      user_id: userId,
      consent_document_id: documentId,
      source,
      accepted_at: timestamp,
      revoked_at: null,
      revoked_source: null,
      revoked_reason: null,
      version: 1,
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.fixtures.user_consents.push(row);
    return { data: row, error: null };
  }

  writeUpdate(
    table: string,
    filters: Array<{ column: string; value: unknown }>,
    values: Record<string, unknown>
  ): { data: Record<string, unknown> | null; error: FakeError | null } {
    if (table !== 'user_consents') return { data: null, error: { code: '42809', message: 'write forbidden' } };
    const idFilter = filters.find((item) => item.column === 'id')?.value;
    const orgFilter = filters.find((item) => item.column === 'organization_id')?.value;
    const userFilter = filters.find((item) => item.column === 'user_id')?.value;
    const index = this.fixtures.user_consents.findIndex(
      (item) =>
        item.id === idFilter &&
        item.organization_id === orgFilter &&
        item.user_id === userFilter
    );
    if (index < 0) return { data: null, error: null };
    const current = this.fixtures.user_consents[index];
    const updated: UserConsentRow = {
      ...current,
      revoked_at: (values['revoked_at'] as string) ?? current.revoked_at,
      revoked_source: (values['revoked_source'] as string | null) ?? current.revoked_source,
      revoked_reason: (values['revoked_reason'] as string | null) ?? current.revoked_reason,
      version: Number(values['version'] ?? current.version),
      updated_at: (values['updated_at'] as string) ?? current.updated_at,
    };
    this.fixtures.user_consents[index] = updated;
    return { data: updated, error: null };
  }
}

class SelectQuery {
  private filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private readonly client: FakeSupabaseConsentClient,
    private readonly table: string,
    private readonly selectClause: string
  ) {}

  eq(column: string, value: unknown): SelectQuery {
    this.filters.push({ column, value });
    return this;
  }

  order(): SelectQuery {
    return this;
  }

  async maybeSingle() {
    const many = await this.run();
    if (many.error) return { data: null, error: many.error };
    return { data: many.data[0] ?? null, error: null };
  }

  then<TResult1 = { data: Record<string, unknown>[]; error: FakeError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Record<string, unknown>[]; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private run() {
    const source = this.client.readTable(this.table);
    const filtered = source.filter((row) =>
      this.filters.every((filter) => row[filter.column] === filter.value)
    );
    if (this.table === 'user_consents' && this.selectClause.includes('consent_documents(')) {
      const rowsWithJoin = filtered.map((row) => {
        const document = this.client.fixtures.consent_documents.find(
          (item) =>
            item.id === row['consent_document_id'] &&
            item.organization_id === row['organization_id']
        );
        return {
          ...row,
          consent_documents: document ?? null,
        };
      });
      return Promise.resolve({ data: rowsWithJoin, error: null });
    }
    return Promise.resolve({ data: filtered, error: null });
  }
}

class InsertQuery {
  constructor(
    private readonly client: FakeSupabaseConsentClient,
    private readonly table: string,
    private readonly values: Record<string, unknown>
  ) {}

  select() {
    return new MutationSelectQuery(() => this.maybeSingle());
  }

  maybeSingle() {
    const result = this.client.writeInsert(this.table, this.values);
    return Promise.resolve({ data: result.data, error: result.error });
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
    private readonly client: FakeSupabaseConsentClient,
    private readonly table: string,
    private readonly values: Record<string, unknown>
  ) {}

  eq(column: string, value: unknown): UpdateQuery {
    this.filters.push({ column, value });
    return this;
  }

  select() {
    return new MutationSelectQuery(() => this.maybeSingle());
  }

  maybeSingle() {
    const result = this.client.writeUpdate(this.table, this.filters, this.values);
    return Promise.resolve({ data: result.data, error: result.error });
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

function fixtures(): Fixtures {
  return {
    consent_documents: [
      {
        id: 'doc-active',
        organization_id: 'org-1',
        code: 'lgpd',
        title: 'Consentimento LGPD',
        purpose: 'Finalidade preventiva',
        legal_basis: 'consentimento',
        document_version: '1.0',
        content_hash: 'legacy-id:non-verifiable:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        status: 'ativo',
        effective_at: '2026-01-01T00:00:00.000Z',
        expires_at: null,
      },
      {
        id: 'doc-future',
        organization_id: 'org-1',
        code: 'lgpd',
        title: 'Consentimento futuro',
        purpose: 'Finalidade preventiva',
        legal_basis: 'consentimento',
        document_version: '2.0',
        content_hash: 'legacy-id:non-verifiable:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        status: 'ativo',
        effective_at: '2099-01-01T00:00:00.000Z',
        expires_at: null,
      },
      {
        id: 'doc-expired',
        organization_id: 'org-1',
        code: 'lgpd',
        title: 'Consentimento expirado',
        purpose: 'Finalidade preventiva',
        legal_basis: 'consentimento',
        document_version: '0.9',
        content_hash: 'legacy-id:non-verifiable:cccccccc-cccc-cccc-cccc-cccccccccccc',
        status: 'ativo',
        effective_at: '2025-01-01T00:00:00.000Z',
        expires_at: '2025-12-31T00:00:00.000Z',
      },
      {
        id: 'doc-inactive',
        organization_id: 'org-1',
        code: 'lgpd',
        title: 'Consentimento inativo',
        purpose: 'Finalidade preventiva',
        legal_basis: 'consentimento',
        document_version: '0.8',
        content_hash: 'legacy-id:non-verifiable:dddddddd-dddd-dddd-dddd-dddddddddddd',
        status: 'inativo',
        effective_at: '2024-01-01T00:00:00.000Z',
        expires_at: null,
      },
    ],
    user_consents: [],
  };
}

function createSut() {
  const nowIso = '2026-08-01T10:30:00.000Z';
  const client = new FakeSupabaseConsentClient(fixtures(), nowIso);
  const repository = createSupabaseConsentRepository({
    client,
    now: () => new Date(nowIso),
  });
  return { client, repository };
}

describe('supabase consent repository integration', () => {
  it('titular consulta, aceita, revoga e preserva historico proprio', async () => {
    const { repository } = createSut();
    const before = await repository.listConsentHistory(context());
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data).toHaveLength(0);

    const accepted = await repository.acceptConsent({
      context: context(),
      consentDocumentId: 'doc-active',
      source: 'web',
    });
    expect(accepted.ok).toBe(true);

    const revoked = await repository.revokeConsent({
      context: context(),
      consentId: accepted.ok ? accepted.data.id : 'invalid',
      revokedSource: 'web',
      revokedReason: 'Titular solicitou revogacao',
    });
    expect(revoked.ok).toBe(true);

    const after = await repository.listConsentHistory(context());
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.data).toHaveLength(1);
    expect(after.data[0]?.consent.revokedAt).not.toBeNull();
  });

  it('nega tentativa cross-user por mismatch de identidade', async () => {
    const { repository } = createSut();
    const result = await repository.acceptConsent({
      context: context({ userId: 'usr-2' }),
      consentDocumentId: 'doc-active',
      source: 'web',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('IDENTITY_MISMATCH');
  });

  it('nega tentativa cross-tenant quando backend retorna permissoes insuficientes', async () => {
    const { repository, client } = createSut();
    client.forcedErrors.insert_user_consents = { code: '42501', message: 'permission denied' };
    const result = await repository.acceptConsent({
      context: context({ organizationId: 'org-2' }),
      consentDocumentId: 'doc-active',
      source: 'web',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CROSS_TENANT_DATA');
  });

  it('bloqueia aceite de documento futuro', async () => {
    const { repository } = createSut();
    const result = await repository.acceptConsent({
      context: context(),
      consentDocumentId: 'doc-future',
      source: 'web',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INELIGIBLE_DOCUMENT');
  });

  it('bloqueia aceite de documento expirado', async () => {
    const { repository } = createSut();
    const result = await repository.acceptConsent({
      context: context(),
      consentDocumentId: 'doc-expired',
      source: 'web',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INELIGIBLE_DOCUMENT');
  });

  it('bloqueia aceite de documento inativo', async () => {
    const { repository } = createSut();
    const result = await repository.acceptConsent({
      context: context(),
      consentDocumentId: 'doc-inactive',
      source: 'web',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INELIGIBLE_DOCUMENT');
  });
});
