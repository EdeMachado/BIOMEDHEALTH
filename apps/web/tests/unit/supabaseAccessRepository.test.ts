import { describe, expect, it } from 'vitest';
import { createMockAccessRepository } from '@/services/repositories/access/mockAccessRepository';
import { ok } from '@/services/repositories/access/errors';
import { createSupabaseAccessRepository, type SupabaseAccessClient } from '@/services/repositories/access/supabaseAccessRepository';
import type { AccessIdentity, AccessResult } from '@/services/repositories/access/types';

type TableName = 'organizations' | 'user_organizations' | 'roles' | 'user_roles' | 'organization_units' | 'user_profiles';

type QueryOperation = {
  table: string;
  select: string;
  filters: Array<{ column: string; value: unknown }>;
  mode: 'many' | 'maybeSingle';
};

type FakeError = { message?: string; code?: string; status?: number };

type Fixtures = {
  organizations: Array<{ id: string; name: string; status: string }>;
  user_organizations: Array<{ id: string; user_id: string; organization_id: string; status: string }>;
  roles: Array<{ id: string; code: string; status: string }>;
  user_roles: Array<{
    id: string;
    user_organization_id: string;
    organization_id: string;
    role_id: string;
    unit_id: string | null;
    status: string;
  }>;
  organization_units: Array<{ id: string; organization_id: string; status: string }>;
  user_profiles: Array<{
    id: string;
    user_organization_id: string;
    organization_id: string;
    unit_id: string | null;
    status: string;
  }>;
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

function baseFixtures(): Fixtures {
  return {
    organizations: [
      { id: 'org-1', name: 'Org 1', status: 'ativo' },
      { id: 'org-2', name: 'Org 2', status: 'ativo' },
    ],
    user_organizations: [
      { id: 'm-usr1-org1', user_id: 'usr-1', organization_id: 'org-1', status: 'ativo' },
      { id: 'm-usr2-org2', user_id: 'usr-2', organization_id: 'org-2', status: 'ativo' },
    ],
    roles: [
      { id: 'r-usuario', code: 'usuario', status: 'ativo' },
      { id: 'r-medico', code: 'medico', status: 'ativo' },
      { id: 'r-auditor', code: 'auditor', status: 'ativo' },
      { id: 'r-admin-cliente', code: 'admin_cliente', status: 'ativo' },
      { id: 'r-inativo', code: 'profissional_saude', status: 'inativo' },
    ],
    user_roles: [{ id: 'ur-1', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-usuario', unit_id: null, status: 'ativo' }],
    organization_units: [
      { id: 'unit-a', organization_id: 'org-1', status: 'ativo' },
      { id: 'unit-b', organization_id: 'org-1', status: 'ativo' },
      { id: 'unit-c', organization_id: 'org-2', status: 'ativo' },
      { id: 'unit-inactive', organization_id: 'org-1', status: 'inativo' },
    ],
    user_profiles: [],
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
    this.client.operations.push({
      table: this.table,
      select: this.selected,
      filters: [...this.filters],
      mode: 'maybeSingle',
    });
    const many = await this.executeMany();
    if (many.error) return { data: null, error: many.error };
    return { data: many.data[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown[]; error: FakeError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    this.client.operations.push({
      table: this.table,
      select: this.selected,
      filters: [...this.filters],
      mode: 'many',
    });
    return this.executeMany().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private executeMany(): Promise<{ data: unknown[]; error: FakeError | null }> {
    const forcedError = this.client.tableErrors[this.table];
    if (forcedError) return Promise.resolve({ data: [], error: forcedError });
    const forcedData = this.client.tableDataOverrides[this.table];
    if (forcedData) return Promise.resolve({ data: forcedData, error: null });

    const rows = this.client.readTable(this.table);
    const filtered = rows.filter((row) => {
      return this.filters.every((filter) => (row as Record<string, unknown>)[filter.column] === filter.value);
    });

    if (this.table === 'user_roles' && this.selected.includes('roles(')) {
      const joined = filtered.map((row) => {
        const rowData = row as Record<string, unknown>;
        const roleId = rowData['role_id'];
        if (typeof roleId !== 'string') return { ...rowData, roles: null };
        const role = this.client.fixtures.roles.find((item) => item.id === roleId) ?? null;
        return { ...rowData, roles: role ? { code: role.code, status: role.status } : null };
      });
      return Promise.resolve({ data: joined, error: null });
    }

    return Promise.resolve({ data: filtered, error: null });
  }
}

class FakeSupabaseClient implements SupabaseAccessClient {
  operations: QueryOperation[] = [];
  writeCalls: string[] = [];
  tableErrors: Record<string, FakeError | undefined> = {};
  tableDataOverrides: Record<string, unknown[] | undefined> = {};
  authError: FakeError | null = null;
  authUserId: string | null = 'usr-1';

  constructor(public fixtures: Fixtures) {}

  auth = {
    getUser: () => {
      if (this.authError) return Promise.resolve({ data: { user: null }, error: this.authError });
      return Promise.resolve({ data: { user: this.authUserId ? { id: this.authUserId } : null }, error: null });
    },
  };

  from(table: string) {
    return {
      select: (columns: string) => {
        const query = new FakeQuery(this, table);
        return query.select(columns);
      },
      insert: () => {
        this.writeCalls.push(`insert:${table}`);
        throw new Error('write not allowed');
      },
      update: () => {
        this.writeCalls.push(`update:${table}`);
        throw new Error('write not allowed');
      },
      delete: () => {
        this.writeCalls.push(`delete:${table}`);
        throw new Error('write not allowed');
      },
    };
  }

  readTable(table: string): unknown[] {
    if (!isTableName(table)) return [];
    return this.fixtures[table];
  }
}

function isTableName(value: string): value is TableName {
  return (
    value === 'organizations' ||
    value === 'user_organizations' ||
    value === 'roles' ||
    value === 'user_roles' ||
    value === 'organization_units' ||
    value === 'user_profiles'
  );
}

function createSut(overrides?: {
  fixtures?: Fixtures;
  authUserId?: string | null;
  authError?: FakeError | null;
  tableErrors?: Record<string, FakeError | undefined>;
  tableDataOverrides?: Record<string, unknown[] | undefined>;
  resolveUserExists?: (input: { userId: string }) => Promise<AccessResult<boolean>>;
}) {
  const client = new FakeSupabaseClient(overrides?.fixtures ?? baseFixtures());
  client.authUserId = Object.prototype.hasOwnProperty.call(overrides ?? {}, 'authUserId')
    ? (overrides?.authUserId ?? null)
    : 'usr-1';
  client.authError = overrides?.authError ?? null;
  client.tableErrors = overrides?.tableErrors ?? {};
  client.tableDataOverrides = overrides?.tableDataOverrides ?? {};

  const repo = createSupabaseAccessRepository({
    client,
    resolveUserExists: overrides?.resolveUserExists,
  });
  return { client, repo };
}

async function expectErrorCode(
  run: () => Promise<AccessResult<unknown>>,
  code: string
) {
  const result = await run();
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
}

describe('SupabaseAccessRepository', () => {
  it('1) resolve sessão válida com contexto completo e consulta em ordem correta', async () => {
    const { repo, client } = createSut();
    const result = await repo.resolveAccessContext(identity());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.organization.id).toBe('org-1');
    expect(result.data.membership.id).toBe('m-usr1-org1');
    expect(result.data.roles).toEqual(['usuario']);
    expect(result.data.effectiveRole).toBe('usuario');
    expect(client.operations.map((op) => op.table)).toEqual(['organizations', 'user_organizations', 'user_roles', 'user_profiles']);
    expect(client.operations[0]?.select).toBe('id, name, status');
    expect(client.operations[1]?.filters).toEqual([
      { column: 'user_id', value: 'usr-1' },
      { column: 'organization_id', value: 'org-1' },
    ]);
  });

  it('2) retorna NO_SESSION para sessão ausente', async () => {
    const { repo } = createSut({ authUserId: null });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'NO_SESSION');
  });

  it('3) retorna IDENTITY_MISMATCH para identidade divergente', async () => {
    const { repo } = createSut({ authUserId: 'usr-9' });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'IDENTITY_MISMATCH');
  });

  it('4) retorna USER_NOT_FOUND quando diretório de usuários nega existência', async () => {
    const { repo } = createSut({
      resolveUserExists: () => Promise.resolve(ok(false)),
    });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'USER_NOT_FOUND');
  });

  it('5) retorna NO_ACTIVE_MEMBERSHIP para usuário existente sem vínculo', async () => {
    const fixtures = baseFixtures();
    fixtures.user_organizations = [];
    const { repo } = createSut({
      fixtures,
      resolveUserExists: () => Promise.resolve(ok(true)),
    });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'NO_ACTIVE_MEMBERSHIP');
  });

  it('6) retorna ORGANIZATION_NOT_FOUND para organização inexistente', async () => {
    const { repo } = createSut();
    await expectErrorCode(() => repo.resolveAccessContext(identity({ organizationId: 'org-x' })), 'ORGANIZATION_NOT_FOUND');
  });

  it('7) retorna ORGANIZATION_INACTIVE para organização inativa', async () => {
    const fixtures = baseFixtures();
    fixtures.organizations[0] = { ...fixtures.organizations[0], status: 'inativo' };
    const { repo } = createSut({ fixtures });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'ORGANIZATION_INACTIVE');
  });

  it('8) retorna NO_ACTIVE_MEMBERSHIP sem vínculo na organização solicitada', async () => {
    const fixtures = baseFixtures();
    fixtures.user_organizations = [{ id: 'm-usr1-org2', user_id: 'usr-1', organization_id: 'org-2', status: 'ativo' }];
    const { repo } = createSut({ fixtures, resolveUserExists: () => Promise.resolve(ok(true)) });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'NO_ACTIVE_MEMBERSHIP');
  });

  it('9) retorna MEMBERSHIP_INACTIVE para vínculo inativo', async () => {
    const fixtures = baseFixtures();
    fixtures.user_organizations[0] = { ...fixtures.user_organizations[0], status: 'inativo' };
    const { repo } = createSut({ fixtures });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'MEMBERSHIP_INACTIVE');
  });

  it('10) bloqueia vínculo apenas em outro tenant', async () => {
    const fixtures = baseFixtures();
    fixtures.user_organizations = [{ id: 'm-usr1-org2', user_id: 'usr-1', organization_id: 'org-2', status: 'ativo' }];
    const { repo } = createSut({ fixtures });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'NO_ACTIVE_MEMBERSHIP');
  });

  it('11) retorna NO_ACTIVE_ROLES sem papéis ativos', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [{ ...fixtures.user_roles[0], status: 'inativo' }];
    const { repo } = createSut({ fixtures });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'NO_ACTIVE_ROLES');
  });

  it('12) preserva múltiplos papéis cumulativos', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [
      { id: 'ur-1', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-usuario', unit_id: null, status: 'ativo' },
      { id: 'ur-2', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-medico', unit_id: null, status: 'ativo' },
      { id: 'ur-3', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-auditor', unit_id: null, status: 'ativo' },
    ];
    const { repo } = createSut({ fixtures });
    const result = await repo.resolveAccessContext(identity());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.roles).toEqual(['usuario', 'medico', 'auditor']);
  });

  it('13) aplica prioridade correta para effectiveRole', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [
      { id: 'ur-1', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-auditor', unit_id: null, status: 'ativo' },
      { id: 'ur-2', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-medico', unit_id: null, status: 'ativo' },
    ];
    const { repo } = createSut({ fixtures });
    const result = await repo.resolveAccessContext(identity());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.effectiveRole).toBe('medico');
  });

  it('14) mantém roles[] sem redução para papel único', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [
      { id: 'ur-1', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-medico', unit_id: null, status: 'ativo' },
      { id: 'ur-2', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-usuario', unit_id: null, status: 'ativo' },
    ];
    const { repo } = createSut({ fixtures });
    const result = await repo.resolveAccessContext(identity());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.roles).toEqual(['medico', 'usuario']);
  });

  it('15) aceita unidade válida da mesma organização', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles[0] = { ...fixtures.user_roles[0], role_id: 'r-medico' };
    const { repo } = createSut({ fixtures });
    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-a' }));
    expect(result.ok).toBe(true);
  });

  it('16) bloqueia unidade inexistente', async () => {
    const { repo } = createSut();
    await expectErrorCode(() => repo.resolveAccessContext(identity({ selectedUnitId: 'unit-x' })), 'UNIT_SCOPE_INCOMPATIBLE');
  });

  it('17) bloqueia unidade inativa', async () => {
    const { repo } = createSut();
    await expectErrorCode(() => repo.resolveAccessContext(identity({ selectedUnitId: 'unit-inactive' })), 'UNIT_SCOPE_INCOMPATIBLE');
  });

  it('18) bloqueia unidade de outro tenant', async () => {
    const { repo } = createSut();
    await expectErrorCode(() => repo.resolveAccessContext(identity({ selectedUnitId: 'unit-c' })), 'CROSS_TENANT_DATA');
  });

  it('19) papel global permite unidade válida após validação de tenant/status', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [{ id: 'ur-admin', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-admin-cliente', unit_id: null, status: 'ativo' }];
    const { repo } = createSut({ fixtures });
    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-a' }));
    expect(result.ok).toBe(true);
  });

  it('20) papel global não permite unidade incompatível', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [{ id: 'ur-admin', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-admin-cliente', unit_id: null, status: 'ativo' }];
    const { repo } = createSut({ fixtures });
    await expectErrorCode(() => repo.resolveAccessContext(identity({ selectedUnitId: 'unit-c' })), 'CROSS_TENANT_DATA');
  });

  it('21) papel unit-scoped com unidade autorizada', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [{ id: 'ur-u', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-medico', unit_id: 'unit-a', status: 'ativo' }];
    const { repo } = createSut({ fixtures });
    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-a' }));
    expect(result.ok).toBe(true);
  });

  it('22) papel unit-scoped com unidade diferente é bloqueado', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [{ id: 'ur-u', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-medico', unit_id: 'unit-a', status: 'ativo' }];
    const { repo } = createSut({ fixtures });
    await expectErrorCode(() => repo.resolveAccessContext(identity({ selectedUnitId: 'unit-b' })), 'UNIT_SCOPE_INCOMPATIBLE');
  });

  it('23) escopo adicional válido em user_profiles', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [{ id: 'ur-u', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-medico', unit_id: 'unit-a', status: 'ativo' }];
    fixtures.user_profiles = [{ id: 'up-1', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', unit_id: 'unit-b', status: 'ativo' }];
    const { repo } = createSut({ fixtures });
    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-b' }));
    expect(result.ok).toBe(true);
  });

  it('24) escopo adicional cross-tenant é bloqueado', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [{ id: 'ur-u', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-medico', unit_id: 'unit-a', status: 'ativo' }];
    fixtures.user_profiles = [{ id: 'up-1', user_organization_id: 'm-usr1-org1', organization_id: 'org-2', unit_id: 'unit-c', status: 'ativo' }];
    const { repo } = createSut({ fixtures });
    await expectErrorCode(() => repo.resolveAccessContext(identity({ selectedUnitId: 'unit-c' })), 'CROSS_TENANT_DATA');
  });

  it('25) bloqueia resposta inconsistente com role de outro tenant', async () => {
    const fixtures = baseFixtures();
    const { repo } = createSut({
      fixtures,
      tableDataOverrides: {
        user_roles: [
          {
            id: 'ur-x',
            user_organization_id: 'm-usr1-org1',
            organization_id: 'org-2',
            role_id: 'r-medico',
            unit_id: null,
            status: 'ativo',
            roles: { code: 'medico', status: 'ativo' },
          },
        ],
      },
    });
    await expectErrorCode(() => repo.resolveAccessContext(identity()), 'CROSS_TENANT_DATA');
  });

  it('26) classifica erro técnico transitório', async () => {
    const { repo } = createSut({
      tableErrors: {
        organizations: { code: 'ETIMEDOUT', message: 'network timeout', status: 503 },
      },
    });
    const result = await repo.resolveAccessContext(identity());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TRANSIENT_BACKEND_ERROR');
    expect(result.error.cause?.message).toContain('network timeout');
  });

  it('27) classifica erro técnico inesperado', async () => {
    const { repo } = createSut({
      tableErrors: {
        organizations: { code: 'XX001', message: 'internal parser failure', status: 400 },
      },
    });
    const result = await repo.resolveAccessContext(identity());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNEXPECTED_BACKEND_ERROR');
  });

  it('28) descarta resolução integral após falha intermediária', async () => {
    const { repo, client } = createSut({
      tableErrors: { user_organizations: { code: 'XX404', message: 'failed membership lookup', status: 500 } },
    });
    const result = await repo.resolveAccessContext(identity());

    expect(result.ok).toBe(false);
    expect(client.operations.map((op) => op.table)).toEqual(['organizations', 'user_organizations']);
  });

  it('29) não executa operações de escrita', async () => {
    const { repo, client } = createSut();
    await repo.resolveAccessContext(identity());
    expect(client.writeCalls).toEqual([]);
  });

  it('30) não realiza fallback para mock quando Supabase falha', async () => {
    const { repo } = createSut({
      tableErrors: { organizations: { code: 'XX500', message: 'db failure', status: 500 } },
    });
    const result = await repo.resolveAccessContext(identity());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TRANSIENT_BACKEND_ERROR');
    expect(result.error.kind).toBe('technical');
  });

  it('31) mantém equivalência semântica com adapter mock em fixture válida equivalente', async () => {
    const fixtures = baseFixtures();
    fixtures.user_roles = [{ id: 'ur-1', user_organization_id: 'm-usr1-org1', organization_id: 'org-1', role_id: 'r-usuario', unit_id: null, status: 'ativo' }];

    const { repo: supabaseRepo } = createSut({ fixtures });
    const mockRepo = createMockAccessRepository({
      organizations: [{ id: 'org-1', nome: 'Org 1', status: 'active' }],
      userIds: ['usr-1'],
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'usuario', unitId: null, status: 'active' }],
      unitScopes: [],
      units: [{ id: 'unit-a', organizationId: 'org-1', status: 'active' }],
    });

    const requestedIdentity = identity({ selectedUnitId: null });
    const supabaseResult = await supabaseRepo.resolveAccessContext(requestedIdentity);
    const mockResult = await mockRepo.resolveAccessContext(requestedIdentity);

    expect(supabaseResult.ok).toBe(true);
    expect(mockResult.ok).toBe(true);
    if (!supabaseResult.ok || !mockResult.ok) return;

    expect(supabaseResult.data.organization.id).toBe(mockResult.data.organization.id);
    expect(supabaseResult.data.membership.userId).toBe(mockResult.data.membership.userId);
    expect(supabaseResult.data.roles).toEqual(mockResult.data.roles);
    expect(supabaseResult.data.effectiveRole).toBe(mockResult.data.effectiveRole);
  });

  it('sanitiza causa técnica sem payload sensível', async () => {
    const { repo } = createSut({
      tableErrors: {
        organizations: {
          code: 'PGRST301',
          message: 'token=abc123 secret=xyz temporariamente indisponível',
          status: 503,
        },
      },
    });
    const result = await repo.resolveAccessContext(identity());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.cause?.code).toBe('PGRST301');
    expect(result.error.cause?.message).not.toContain('\n');
  });
});
