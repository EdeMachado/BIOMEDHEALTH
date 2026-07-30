import { describe, expect, it } from 'vitest';
import {
  createAccessContextRepositoryFactory,
  isFallbackContextCompatible,
  resolveAccessRepositoryMode,
  shouldAttemptFallback,
} from '@/services/repositories/access/factory';
import type { AccessContext, AccessIdentity } from '@/services/repositories/access/types';
import type { SupabaseAccessClient } from '@/services/repositories/access/supabaseAccessRepository';

type FakeError = {
  message?: string;
  code?: string;
  status?: number;
};

type UserOrganizationRow = {
  id: string;
  user_id: string;
  organization_id: string;
  status: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  status: string;
};

type UserRoleRow = {
  user_organization_id: string;
  organization_id: string;
  role_id: string;
  unit_id: string | null;
  status: string;
  roles?: { code?: string; status?: string };
};

type UserProfileRow = {
  user_organization_id: string;
  organization_id: string;
  unit_id: string | null;
  status: string;
};

type UnitRow = {
  id: string;
  organization_id: string;
  status: string;
};

function identity(overrides: Partial<AccessIdentity> = {}): AccessIdentity {
  return {
    sessionUserId: 'usr-1',
    userId: 'usr-1',
    organizationId: 'org-1',
    selectedUnitId: null,
    ...overrides,
  };
}

function baseContext(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    identity: identity(),
    organization: {
      id: 'org-1',
      nome: 'Org 1',
      status: 'active',
    },
    membership: {
      id: 'm-1',
      userId: 'usr-1',
      organizationId: 'org-1',
      status: 'active',
    },
    roleBindings: [
      { membershipId: 'm-1', role: 'usuario', unitId: null, status: 'active' },
    ],
    roles: ['usuario'],
    effectiveRole: 'usuario',
    unitScopes: [],
    ...overrides,
  };
}

class FakeQuery {
  private filters: Array<{ column: string; value: unknown }> = [];
  private selected = '';

  constructor(
    private readonly client: FakeSupabaseClient,
    private readonly table: string
  ) {}

  select(columns: string): FakeQuery {
    this.selected = columns;
    return this;
  }

  eq(column: string, value: unknown): FakeQuery {
    this.filters.push({ column, value });
    return this;
  }

  async maybeSingle() {
    this.client.operations.push({ table: this.table, mode: 'maybeSingle', filters: [...this.filters], select: this.selected });
    const many = await this.executeMany();
    if (many.error) return { data: null, error: many.error };
    return { data: many.data[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown[]; error: FakeError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    this.client.operations.push({ table: this.table, mode: 'many', filters: [...this.filters], select: this.selected });
    return this.executeMany().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private executeMany(): Promise<{ data: unknown[]; error: FakeError | null }> {
    if (this.client.forcedError) return Promise.resolve({ data: [], error: this.client.forcedError });
    const rows = this.client.readTable(this.table);
    const filtered = rows.filter((row) =>
      this.filters.every((filter) => (row as Record<string, unknown>)[filter.column] === filter.value)
    );
    return Promise.resolve({ data: filtered, error: null });
  }
}

class FakeSupabaseClient implements SupabaseAccessClient {
  authGetUserCalls = 0;
  authUserId = 'usr-1';
  operations: Array<{
    table: string;
    mode: 'many' | 'maybeSingle';
    filters: Array<{ column: string; value: unknown }>;
    select: string;
  }> = [];
  forcedError: FakeError | null = null;

  constructor(
    private readonly data: {
      organizations: OrganizationRow[];
      user_organizations: UserOrganizationRow[];
      user_roles: UserRoleRow[];
      user_profiles: UserProfileRow[];
      organization_units: UnitRow[];
    } = {
      organizations: [{ id: 'org-1', name: 'Org 1', status: 'ativo' }],
      user_organizations: [{ id: 'm-1', user_id: 'usr-1', organization_id: 'org-1', status: 'ativo' }],
      user_roles: [{ user_organization_id: 'm-1', organization_id: 'org-1', role_id: 'r-1', unit_id: null, status: 'ativo', roles: { code: 'usuario', status: 'ativo' } }],
      user_profiles: [],
      organization_units: [{ id: 'unit-a', organization_id: 'org-1', status: 'ativo' }],
    }
  ) {}

  auth = {
    getUser: () => {
      this.authGetUserCalls += 1;
      return Promise.resolve({
        data: { user: { id: this.authUserId } },
        error: null,
      });
    },
  };

  from(table: string) {
    return {
      select: (columns: string) => {
        const query = new FakeQuery(this, table);
        return query.select(columns);
      },
    };
  }

  readTable(table: string): unknown[] {
    const record = this.data as Record<string, unknown[]>;
    return record[table] ?? [];
  }
}

describe('accessRepositoryFactory', () => {
  it('1) seleciona explicitamente modo mock', async () => {
    const repository = createAccessContextRepositoryFactory({ mode: 'mock' });
    const result = await repository.resolveAccessContext(identity());
    expect(result.ok).toBe(true);
  });

  it('2) seleciona explicitamente modo Supabase', async () => {
    const client = new FakeSupabaseClient();
    const repository = createAccessContextRepositoryFactory({ mode: 'supabase', supabaseClient: client });
    const result = await repository.resolveAccessContext(identity());
    expect(result.ok).toBe(true);
  });

  it('3) rejeita modo inválido na resolução tipada', () => {
    expect(() => resolveAccessRepositoryMode({ VITE_ENABLE_SUPABASE_AUTH: 'banana' })).toThrow(
      'Valor inválido'
    );
  });

  it('4) modo mock não instancia nem consulta Supabase', async () => {
    const client = new FakeSupabaseClient();
    const repository = createAccessContextRepositoryFactory({ mode: 'mock' });
    await repository.resolveAccessContext(identity());
    expect(client.authGetUserCalls).toBe(0);
    expect(client.operations).toHaveLength(0);
  });

  it('5) modo Supabase recebe client por injeção', async () => {
    const client = new FakeSupabaseClient();
    const repository = createAccessContextRepositoryFactory({ mode: 'supabase', supabaseClient: client });
    await repository.resolveAccessContext(identity());
    expect(client.authGetUserCalls).toBeGreaterThan(0);
  });

  it('6) não cria singleton adicional e usa apenas client injetado', async () => {
    const clientA = new FakeSupabaseClient();
    const clientB = new FakeSupabaseClient();
    const repository = createAccessContextRepositoryFactory({ mode: 'supabase', supabaseClient: clientA });
    await repository.resolveAccessContext(identity());
    expect(clientA.authGetUserCalls).toBeGreaterThan(0);
    expect(clientB.authGetUserCalls).toBe(0);
  });

  it('7) ausência de fallback automático por padrão', async () => {
    const client = new FakeSupabaseClient();
    client.forcedError = { code: 'ETIMEDOUT', message: 'timeout', status: 503 };
    const repository = createAccessContextRepositoryFactory({ mode: 'supabase', supabaseClient: client });
    const result = await repository.resolveAccessContext(identity());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TRANSIENT_BACKEND_ERROR');
  });

  it('8-11) bloqueia fallback para erros funcionais e de isolamento', () => {
    const blocked = [
      'NO_SESSION',
      'USER_NOT_FOUND',
      'ORGANIZATION_NOT_FOUND',
      'ORGANIZATION_INACTIVE',
      'NO_ACTIVE_MEMBERSHIP',
      'MEMBERSHIP_INACTIVE',
      'NO_ACTIVE_ROLES',
      'UNIT_SCOPE_INCOMPATIBLE',
      'CROSS_TENANT_DATA',
      'IDENTITY_MISMATCH',
      'UNEXPECTED_BACKEND_ERROR',
    ] as const;
    for (const code of blocked) {
      expect(shouldAttemptFallback(code, { enableTransientFallback: true, runtime: 'non-production' })).toBe(false);
    }
  });

  it('12) TRANSIENT_BACKEND_ERROR sem configuração permanece fail-closed', () => {
    expect(shouldAttemptFallback('TRANSIENT_BACKEND_ERROR', { enableTransientFallback: false, runtime: 'non-production' })).toBe(false);
  });

  it('13) produção nunca utiliza fallback', () => {
    expect(shouldAttemptFallback('TRANSIENT_BACKEND_ERROR', { enableTransientFallback: true, runtime: 'production' })).toBe(false);
  });

  it('14) incompatibilidade de identidade bloqueia fallback', () => {
    const requested = identity();
    const context = baseContext({
      identity: identity({ userId: 'usr-2', sessionUserId: 'usr-2' }),
      membership: { id: 'm-2', userId: 'usr-2', organizationId: 'org-1', status: 'active' },
    });
    expect(isFallbackContextCompatible(requested, context)).toBe(false);
  });

  it('15) incompatibilidade de organização bloqueia fallback', () => {
    const requested = identity({ organizationId: 'org-1' });
    const context = baseContext({
      identity: identity({ organizationId: 'org-2' }),
      organization: { id: 'org-2', nome: 'Org 2', status: 'active' },
      membership: { id: 'm-1', userId: 'usr-1', organizationId: 'org-2', status: 'active' },
    });
    expect(isFallbackContextCompatible(requested, context)).toBe(false);
  });

  it('16) incompatibilidade de unidade bloqueia fallback', () => {
    const requested = identity({ selectedUnitId: 'unit-a' });
    const context = baseContext({
      identity: identity({ selectedUnitId: 'unit-b' }),
    });
    expect(isFallbackContextCompatible(requested, context)).toBe(false);
  });

  it('17) incompatibilidade de papéis ou escopos bloqueia fallback', () => {
    const requested = identity();
    const context = baseContext({
      roles: ['usuario'],
      effectiveRole: 'medico',
    });
    expect(isFallbackContextCompatible(requested, context)).toBe(false);
  });

  it('18-21) fallback transitório só seria elegível em não-produção e com contexto estritamente compatível', () => {
    expect(shouldAttemptFallback('TRANSIENT_BACKEND_ERROR', { enableTransientFallback: true, runtime: 'non-production' })).toBe(true);
    expect(isFallbackContextCompatible(identity(), baseContext())).toBe(true);
  });

  it('22) fallback falha fechado quando não há fixture mock equivalente', async () => {
    const client = new FakeSupabaseClient();
    client.authUserId = 'usr-404';
    client.forcedError = { code: 'ETIMEDOUT', message: 'timeout', status: 503 };
    const repository = createAccessContextRepositoryFactory({
      mode: 'supabase',
      supabaseClient: client,
      fallbackPolicy: {
        enableTransientFallback: true,
        runtime: 'non-production',
      },
    });

    const result = await repository.resolveAccessContext(
      identity({
        userId: 'usr-404',
        sessionUserId: 'usr-404',
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TRANSIENT_BACKEND_ERROR');
  });
});
