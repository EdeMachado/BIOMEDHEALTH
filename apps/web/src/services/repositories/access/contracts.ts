import type {
  AccessContext,
  AccessIdentity,
  AccessMembership,
  AccessOrganization,
  AccessResult,
  AccessRoleBinding,
  AccessUnitScope,
} from '@/services/repositories/access/types';

export type OrganizationLookupInput = {
  identity: AccessIdentity;
};

export type MembershipLookupInput = {
  identity: AccessIdentity;
};

export type RoleLookupInput = {
  identity: AccessIdentity;
  membership: AccessMembership;
};

export type UnitScopeLookupInput = {
  identity: AccessIdentity;
  membership: AccessMembership;
};

export interface OrganizationRepository {
  getOrganization(input: OrganizationLookupInput): Promise<AccessResult<AccessOrganization>>;
}

export interface MembershipRepository {
  getMembership(input: MembershipLookupInput): Promise<AccessResult<AccessMembership>>;
}

export interface RoleRepository {
  getRoleBindings(input: RoleLookupInput): Promise<AccessResult<AccessRoleBinding[]>>;
}

export interface AccessContextRepository {
  resolveAccessContext(identity: AccessIdentity): Promise<AccessResult<AccessContext>>;
}

export interface UnitScopeRepository {
  getUnitScopes(input: UnitScopeLookupInput): Promise<AccessResult<AccessUnitScope[]>>;
}
