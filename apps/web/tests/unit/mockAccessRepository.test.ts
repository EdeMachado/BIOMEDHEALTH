import { describe, expect, it } from 'vitest';
import { createMockAccessRepository } from '@/services/repositories/access/mockAccessRepository';
import type { AccessIdentity, AccessMembership, AccessOrganization, AccessRoleBinding, AccessUnit } from '@/services/repositories/access/types';

function identity(overrides: Partial<AccessIdentity> = {}): AccessIdentity {
  return {
    sessionUserId: 'usr-1',
    userId: 'usr-1',
    organizationId: 'org-1',
    selectedUnitId: null,
    ...overrides,
  };
}

function organizationsFixture(overrides: AccessOrganization[] = []): AccessOrganization[] {
  return [
    { id: 'org-1', nome: 'Org 1', status: 'active' },
    { id: 'org-2', nome: 'Org 2', status: 'active' },
    ...overrides,
  ];
}

function baseMembershipsFixture(): AccessMembership[] {
  return [
    { id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' },
    { id: 'm-usr2-org2', userId: 'usr-2', organizationId: 'org-2', status: 'active' },
  ];
}

function baseRoleBindingsFixture(): AccessRoleBinding[] {
  return [{ membershipId: 'm-usr1-org1', role: 'usuario', unitId: null, status: 'active' }];
}

function unitsFixture(): AccessUnit[] {
  return [
    { id: 'unit-a', organizationId: 'org-1', status: 'active' },
    { id: 'unit-b', organizationId: 'org-1', status: 'active' },
    { id: 'unit-c', organizationId: 'org-2', status: 'active' },
    { id: 'unit-inactive', organizationId: 'org-1', status: 'inactive' },
  ];
}

describe('MockAccessRepository', () => {
  it('resolve contexto completo para usuario válido com vínculo ativo', async () => {
    const repo = createMockAccessRepository();
    const result = await repo.resolveAccessContext(identity());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.membership.userId).toBe('usr-1');
    expect(result.data.organization.id).toBe('org-1');
    expect(result.data.roles).toEqual(['usuario']);
    expect(result.data.effectiveRole).toBe('usuario');
  });

  it('retorna NO_SESSION quando sessão/identidade ausente', async () => {
    const repo = createMockAccessRepository();
    const result = await repo.resolveAccessContext(identity({ sessionUserId: null, userId: null }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_SESSION');
  });

  it('retorna IDENTITY_MISMATCH quando sessionUserId diverge de userId', async () => {
    const repo = createMockAccessRepository();
    const result = await repo.resolveAccessContext(identity({ sessionUserId: 'usr-2' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('IDENTITY_MISMATCH');
  });

  it('retorna USER_NOT_FOUND para usuário inexistente', async () => {
    const repo = createMockAccessRepository({
      userIds: ['usr-1', 'usr-2'],
      memberships: baseMembershipsFixture(),
      roleBindings: baseRoleBindingsFixture(),
    });
    const result = await repo.resolveAccessContext(identity({ userId: 'usr-999', sessionUserId: 'usr-999' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('USER_NOT_FOUND');
  });

  it('retorna ORGANIZATION_NOT_FOUND para organização inexistente', async () => {
    const repo = createMockAccessRepository();
    const result = await repo.resolveAccessContext(identity({ organizationId: 'org-x' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ORGANIZATION_NOT_FOUND');
  });

  it('retorna ORGANIZATION_INACTIVE para organização inativa', async () => {
    const repo = createMockAccessRepository({
      organizations: [{ id: 'org-1', nome: 'Org Inativa', status: 'inactive' }],
      memberships: baseMembershipsFixture(),
      roleBindings: baseRoleBindingsFixture(),
    });

    const result = await repo.resolveAccessContext(identity());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ORGANIZATION_INACTIVE');
  });

  it('retorna NO_ACTIVE_MEMBERSHIP para usuário existente sem qualquer vínculo', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      userIds: ['usr-1', 'usr-3'],
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'usuario', unitId: null, status: 'active' }],
    });
    const result = await repo.resolveAccessContext(identity({ userId: 'usr-3', sessionUserId: 'usr-3', organizationId: 'org-1' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_ACTIVE_MEMBERSHIP');
  });

  it('retorna NO_ACTIVE_MEMBERSHIP para usuário existente com vínculo apenas em outro tenant', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      userIds: ['usr-1'],
      memberships: [{ id: 'm-usr1-org2', userId: 'usr-1', organizationId: 'org-2', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org2', role: 'usuario', unitId: null, status: 'active' }],
    });
    const result = await repo.resolveAccessContext(identity({ organizationId: 'org-1' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_ACTIVE_MEMBERSHIP');
  });

  it('retorna MEMBERSHIP_INACTIVE para vínculo inativo', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'inactive' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'usuario', unitId: null, status: 'active' }],
    });

    const result = await repo.resolveAccessContext(identity());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MEMBERSHIP_INACTIVE');
  });

  it('retorna NO_ACTIVE_ROLES quando não há papéis ativos', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'usuario', unitId: null, status: 'inactive' }],
    });

    const result = await repo.resolveAccessContext(identity());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_ACTIVE_ROLES');
  });

  it('preserva papéis cumulativos e calcula effectiveRole por prioridade', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [
        { membershipId: 'm-usr1-org1', role: 'usuario', unitId: null, status: 'active' },
        { membershipId: 'm-usr1-org1', role: 'medico', unitId: null, status: 'active' },
        { membershipId: 'm-usr1-org1', role: 'auditor', unitId: null, status: 'active' },
      ],
    });
    const result = await repo.resolveAccessContext(identity());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.roles).toEqual(['usuario', 'medico', 'auditor']);
    expect(result.data.effectiveRole).toBe('medico');
  });

  it('permite papel global com unidade válida na mesma organização', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'medico', unitId: null, status: 'active' }],
      units: unitsFixture(),
    });

    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-a' }));
    expect(result.ok).toBe(true);
  });

  it('bloqueia papel global com unidade inexistente', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'medico', unitId: null, status: 'active' }],
      units: unitsFixture(),
    });

    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-x' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNIT_SCOPE_INCOMPATIBLE');
  });

  it('bloqueia papel global com unidade de outra organização', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'medico', unitId: null, status: 'active' }],
      units: unitsFixture(),
    });

    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-c' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CROSS_TENANT_DATA');
  });

  it('bloqueia papel global com unidade inativa', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'medico', unitId: null, status: 'active' }],
      units: unitsFixture(),
    });

    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-inactive' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNIT_SCOPE_INCOMPATIBLE');
  });

  it('permite papel unit-scoped com unidade válida', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'medico', unitId: 'unit-a', status: 'active' }],
      units: unitsFixture(),
    });

    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-a' }));
    expect(result.ok).toBe(true);
  });

  it('bloqueia papel unit-scoped com unidade diferente', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'medico', unitId: 'unit-a', status: 'active' }],
      units: unitsFixture(),
    });

    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-b' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNIT_SCOPE_INCOMPATIBLE');
  });

  it('detecta escopo de unidade de outro tenant', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: [{ id: 'm-usr1-org1', userId: 'usr-1', organizationId: 'org-1', status: 'active' }],
      roleBindings: [{ membershipId: 'm-usr1-org1', role: 'medico', unitId: 'unit-a', status: 'active' }],
      units: unitsFixture(),
      unitScopes: [
        {
          membershipId: 'm-usr1-org1',
          unitId: 'unit-c',
          organizationId: 'org-2',
          status: 'active',
        },
      ],
    });

    const result = await repo.resolveAccessContext(identity({ selectedUnitId: 'unit-c' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CROSS_TENANT_DATA');
  });

  it('não mistura contextos entre identidades diferentes', async () => {
    const repo = createMockAccessRepository({
      organizations: organizationsFixture(),
      memberships: baseMembershipsFixture(),
      roleBindings: [
        { membershipId: 'm-usr1-org1', role: 'usuario', unitId: null, status: 'active' },
        { membershipId: 'm-usr2-org2', role: 'medico', unitId: null, status: 'active' },
      ],
    });

    const resultUser1 = await repo.resolveAccessContext(identity({ sessionUserId: 'usr-1', userId: 'usr-1', organizationId: 'org-1' }));
    const resultUser2 = await repo.resolveAccessContext(identity({ sessionUserId: 'usr-2', userId: 'usr-2', organizationId: 'org-2' }));

    expect(resultUser1.ok).toBe(true);
    expect(resultUser2.ok).toBe(true);
    if (!resultUser1.ok || !resultUser2.ok) return;

    expect(resultUser1.data.membership.id).toBe('m-usr1-org1');
    expect(resultUser2.data.membership.id).toBe('m-usr2-org2');
    expect(resultUser1.data.roles).toEqual(['usuario']);
    expect(resultUser2.data.roles).toEqual(['medico']);
  });

  it('mantém equivalência semântica com cenário legado válido (usr-1/org-1)', async () => {
    const repo = createMockAccessRepository();
    const result = await repo.resolveAccessContext(identity());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.organization.id).toBe('org-1');
    expect(result.data.membership.userId).toBe('usr-1');
    expect(result.data.roles).toEqual(['usuario']);
    expect(result.data.effectiveRole).toBe('usuario');
  });
});
