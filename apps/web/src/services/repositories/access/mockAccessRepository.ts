import { demoUsers, organizations } from '@/services/repositories/demoData';
import type { Role } from '@/shared/types/access';
import {
  fail,
  ok,
} from '@/services/repositories/access/errors';
import type {
  AccessContextRepository,
  MembershipRepository,
  OrganizationRepository,
  RoleRepository,
  UnitScopeRepository,
} from '@/services/repositories/access/contracts';
import type {
  AccessUnit,
  AccessContext,
  AccessIdentity,
  AccessMembership,
  AccessOrganization,
  AccessResult,
  AccessRoleBinding,
  AccessUnitScope,
} from '@/services/repositories/access/types';

type MembershipRecord = AccessMembership;
type RoleBindingRecord = AccessRoleBinding;
type UnitScopeRecord = AccessUnitScope;
type UnitRecord = AccessUnit;

type MockAccessRepositoryOptions = {
  organizations?: AccessOrganization[];
  memberships?: MembershipRecord[];
  roleBindings?: RoleBindingRecord[];
  unitScopes?: UnitScopeRecord[];
  userIds?: string[];
  units?: UnitRecord[];
};

const ROLE_PRIORITY: Role[] = [
  'admin_biomed',
  'admin_cliente',
  'gestor_clinico',
  'medico',
  'profissional_saude',
  'gestor_institucional',
  'sst',
  'auditor',
  'usuario',
];

export class MockAccessRepository
  implements OrganizationRepository, MembershipRepository, RoleRepository, UnitScopeRepository, AccessContextRepository
{
  private readonly organizations: AccessOrganization[];
  private readonly memberships: MembershipRecord[];
  private readonly roleBindings: RoleBindingRecord[];
  private readonly unitScopes: UnitScopeRecord[];
  private readonly userIds: Set<string>;
  private readonly units: UnitRecord[];

  constructor(options: MockAccessRepositoryOptions = {}) {
    this.organizations = options.organizations ?? organizations.map((org) => ({ id: org.id, nome: org.nome, status: 'active' }));
    this.memberships = options.memberships ?? buildDefaultMemberships();
    this.roleBindings = options.roleBindings ?? buildDefaultRoleBindings(this.memberships);
    this.unitScopes = options.unitScopes ?? [];
    this.userIds = new Set(options.userIds ?? demoUsers.map((user) => user.id));
    this.units = options.units ?? [];
  }

  getOrganization({ identity }: { identity: AccessIdentity }): Promise<AccessResult<AccessOrganization>> {
    const sessionValidation = validateSessionIdentity(identity);
    if (!sessionValidation.ok) return Promise.resolve(sessionValidation);

    const organization = this.organizations.find((item) => item.id === identity.organizationId);
    if (!organization) return Promise.resolve(fail('ORGANIZATION_NOT_FOUND'));
    if (organization.status !== 'active') return Promise.resolve(fail('ORGANIZATION_INACTIVE'));
    return Promise.resolve(ok(organization));
  }

  getMembership({ identity }: { identity: AccessIdentity }): Promise<AccessResult<AccessMembership>> {
    const sessionValidation = validateSessionIdentity(identity);
    if (!sessionValidation.ok) return Promise.resolve(sessionValidation);

    const userId = identity.userId as string;
    if (!this.userIds.has(userId)) return Promise.resolve(fail('USER_NOT_FOUND'));

    const activeMembership = this.memberships.find(
      (membership) => membership.userId === userId && membership.organizationId === identity.organizationId && membership.status === 'active'
    );

    if (activeMembership) return Promise.resolve(ok(activeMembership));

    const inactiveMembership = this.memberships.find(
      (membership) => membership.userId === userId && membership.organizationId === identity.organizationId
    );
    if (inactiveMembership?.status === 'inactive') return Promise.resolve(fail('MEMBERSHIP_INACTIVE'));

    return Promise.resolve(fail('NO_ACTIVE_MEMBERSHIP'));
  }

  getRoleBindings({
    identity,
    membership,
  }: {
    identity: AccessIdentity;
    membership: AccessMembership;
  }): Promise<AccessResult<AccessRoleBinding[]>> {
    const sessionValidation = validateSessionIdentity(identity);
    if (!sessionValidation.ok) return Promise.resolve(sessionValidation);

    if (membership.organizationId !== identity.organizationId || membership.userId !== identity.userId) {
      return Promise.resolve(fail('CROSS_TENANT_DATA', {
        details: 'Vínculo não corresponde à identidade solicitada.',
      }));
    }

    const allBindings = this.roleBindings.filter((binding) => binding.membershipId === membership.id);
    if (allBindings.some((binding) => binding.status === 'active' && !isRole(binding.role))) {
      return Promise.resolve(fail('UNEXPECTED_BACKEND_ERROR', {
        details: 'Papel inválido detectado no repositório mock.',
      }));
    }

    const activeBindings = allBindings.filter((binding) => binding.status === 'active');
    if (activeBindings.length === 0) return Promise.resolve(fail('NO_ACTIVE_ROLES'));

    const unitValidation = validateSelectedUnit(identity, membership, activeBindings, this.unitScopes, this.units);
    if (!unitValidation.ok) return Promise.resolve(unitValidation);

    return Promise.resolve(ok(activeBindings));
  }

  getUnitScopes({
    identity,
    membership,
  }: {
    identity: AccessIdentity;
    membership: AccessMembership;
  }): Promise<AccessResult<AccessUnitScope[]>> {
    const sessionValidation = validateSessionIdentity(identity);
    if (!sessionValidation.ok) return Promise.resolve(sessionValidation);

    if (membership.organizationId !== identity.organizationId || membership.userId !== identity.userId) {
      return Promise.resolve(fail('CROSS_TENANT_DATA', {
        details: 'Escopos solicitados para vínculo fora do tenant da identidade.',
      }));
    }

    const activeScopes = this.unitScopes.filter((scope) => scope.membershipId === membership.id && scope.status === 'active');
    if (activeScopes.some((scope) => scope.organizationId !== membership.organizationId)) {
      return Promise.resolve(fail('CROSS_TENANT_DATA', {
        details: 'Escopo de unidade com organização divergente do vínculo.',
      }));
    }

    return Promise.resolve(ok(activeScopes));
  }

  async resolveAccessContext(identity: AccessIdentity): Promise<AccessResult<AccessContext>> {
    const organizationResult = await this.getOrganization({ identity });
    if (!organizationResult.ok) return organizationResult;

    const membershipResult = await this.getMembership({ identity });
    if (!membershipResult.ok) return membershipResult;

    const roleBindingsResult = await this.getRoleBindings({
      identity,
      membership: membershipResult.data,
    });
    if (!roleBindingsResult.ok) return roleBindingsResult;

    const unitScopesResult = await this.getUnitScopes({
      identity,
      membership: membershipResult.data,
    });
    if (!unitScopesResult.ok) return unitScopesResult;

    const roles = deduplicateRoles(roleBindingsResult.data.map((binding) => binding.role));
    if (roles.length === 0) return fail('NO_ACTIVE_ROLES');

    const effectiveRole = resolveEffectiveRole(roles);
    if (!effectiveRole) return fail('NO_ACTIVE_ROLES');

    return ok({
      identity: {
        sessionUserId: identity.sessionUserId,
        userId: identity.userId,
        organizationId: identity.organizationId,
        selectedUnitId: identity.selectedUnitId ?? null,
      },
      organization: organizationResult.data,
      membership: membershipResult.data,
      roleBindings: roleBindingsResult.data,
      roles,
      effectiveRole,
      unitScopes: unitScopesResult.data,
    });
  }
}

export function createMockAccessRepository(options: MockAccessRepositoryOptions = {}) {
  return new MockAccessRepository(options);
}

function buildDefaultMemberships(): MembershipRecord[] {
  const dedup = new Map<string, MembershipRecord>();

  for (const user of demoUsers) {
    const key = `${user.id}:${user.organizationId}`;
    if (dedup.has(key)) continue;

    dedup.set(key, {
      id: `membership-${user.id}-${user.organizationId}`,
      userId: user.id,
      organizationId: user.organizationId,
      status: 'active',
    });
  }

  return [...dedup.values()];
}

function buildDefaultRoleBindings(memberships: MembershipRecord[]): RoleBindingRecord[] {
  const clinicalRoles = new Set(['medico', 'profissional_saude', 'gestor_clinico']);
  const roleBindings: RoleBindingRecord[] = [];
  for (const user of demoUsers) {
    const membership = memberships.find((item) => item.userId === user.id && item.organizationId === user.organizationId);
    if (!membership) continue;

    const cumulativeRoles = deduplicateRoles(user.roles?.length ? user.roles : [user.role]);
    for (const role of cumulativeRoles) {
      roleBindings.push({
        membershipId: membership.id,
        role,
        // Mock: clinical roles bind to a deterministic demo unit (fail-closed requires a unit).
        unitId: clinicalRoles.has(role) ? `unit-${user.organizationId}` : null,
        status: 'active',
      });
    }
  }
  return roleBindings;
}

function validateSessionIdentity(identity: AccessIdentity): AccessResult<true> {
  if (!identity.sessionUserId || !identity.userId) return fail('NO_SESSION');
  if (identity.sessionUserId !== identity.userId) {
    return fail('IDENTITY_MISMATCH', {
      details: `sessionUserId=${identity.sessionUserId} difere de userId=${identity.userId}`,
    });
  }
  return ok(true);
}

function validateSelectedUnit(
  identity: AccessIdentity,
  membership: AccessMembership,
  roleBindings: RoleBindingRecord[],
  unitScopes: UnitScopeRecord[],
  units: UnitRecord[]
): AccessResult<true> {
  const selectedUnitId = identity.selectedUnitId ?? null;
  if (!selectedUnitId) return ok(true);

  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  if (!selectedUnit) return fail('UNIT_SCOPE_INCOMPATIBLE', { details: 'Unidade selecionada não encontrada.' });
  if (selectedUnit.organizationId !== membership.organizationId) {
    return fail('CROSS_TENANT_DATA', { details: 'Unidade pertence a organização diferente do vínculo.' });
  }
  if (selectedUnit.status !== 'active') return fail('UNIT_SCOPE_INCOMPATIBLE', { details: 'Unidade selecionada está inativa.' });

  const hasGlobalRole = roleBindings.some((binding) => binding.unitId === null);
  if (hasGlobalRole) return ok(true);

  const roleBoundUnit = roleBindings.some((binding) => binding.unitId === selectedUnitId && binding.status === 'active');
  if (roleBoundUnit) return ok(true);

  const matchingScope = unitScopes.find((scope) => scope.membershipId === membership.id && scope.unitId === selectedUnitId);
  if (!matchingScope) return fail('UNIT_SCOPE_INCOMPATIBLE');
  if (matchingScope.organizationId !== membership.organizationId) return fail('CROSS_TENANT_DATA');
  if (matchingScope.status !== 'active') return fail('UNIT_SCOPE_INCOMPATIBLE');
  return ok(true);
}

function deduplicateRoles(roles: Role[]): Role[] {
  const seen = new Set<Role>();
  const output: Role[] = [];
  for (const role of roles) {
    if (!seen.has(role)) {
      seen.add(role);
      output.push(role);
    }
  }
  return output;
}

function resolveEffectiveRole(roles: Role[]): Role | null {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return null;
}

function isRole(value: unknown): value is Role {
  return (
    value === 'usuario' ||
    value === 'medico' ||
    value === 'profissional_saude' ||
    value === 'gestor_clinico' ||
    value === 'gestor_institucional' ||
    value === 'sst' ||
    value === 'admin_cliente' ||
    value === 'admin_biomed' ||
    value === 'auditor'
  );
}
