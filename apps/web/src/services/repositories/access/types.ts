import type { Role } from '@/shared/types/access';

export type AccessErrorCode =
  | 'NO_SESSION'
  | 'USER_NOT_FOUND'
  | 'ORGANIZATION_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'MEMBERSHIP_INACTIVE'
  | 'NO_ACTIVE_ROLES'
  | 'UNIT_SCOPE_INCOMPATIBLE'
  | 'CROSS_TENANT_DATA'
  | 'IDENTITY_MISMATCH'
  | 'TRANSIENT_BACKEND_ERROR'
  | 'UNEXPECTED_BACKEND_ERROR';

export type AccessErrorKind = 'authentication' | 'authorization' | 'consistency' | 'technical';

export type AccessErrorCause = {
  source: 'mock' | 'repository' | 'validation';
  code: string;
  message?: string;
};

export type AccessError = {
  code: AccessErrorCode;
  kind: AccessErrorKind;
  message: string;
  details?: string;
  cause?: AccessErrorCause;
  transient: boolean;
};

export type AccessResult<T> = { ok: true; data: T } | { ok: false; error: AccessError };

export type AccessIdentity = {
  sessionUserId: string | null;
  userId: string | null;
  organizationId: string;
  selectedUnitId?: string | null;
};

export type AccessOrganization = {
  id: string;
  nome: string;
  status: 'active' | 'inactive';
};

export type AccessMembership = {
  id: string;
  userId: string;
  organizationId: string;
  status: 'active' | 'inactive';
};

export type AccessRoleBinding = {
  membershipId: string;
  role: Role;
  unitId: string | null;
  status: 'active' | 'inactive';
};

export type AccessUnitScope = {
  membershipId: string;
  unitId: string;
  organizationId: string;
  status: 'active' | 'inactive';
};

export type AccessUnit = {
  id: string;
  organizationId: string;
  status: 'active' | 'inactive';
};

export type AccessContext = {
  identity: AccessIdentity;
  organization: AccessOrganization;
  membership: AccessMembership;
  roleBindings: AccessRoleBinding[];
  roles: Role[];
  effectiveRole: Role;
  unitScopes: AccessUnitScope[];
};
