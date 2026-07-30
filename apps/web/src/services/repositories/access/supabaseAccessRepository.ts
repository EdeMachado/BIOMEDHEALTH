import type {
  AccessContextRepository,
  MembershipRepository,
  OrganizationRepository,
  RoleRepository,
  UnitScopeRepository,
} from '@/services/repositories/access/contracts';
import { fail, ok } from '@/services/repositories/access/errors';
import type { Role } from '@/shared/types/access';
import type {
  AccessContext,
  AccessError,
  AccessIdentity,
  AccessMembership,
  AccessOrganization,
  AccessResult,
  AccessRoleBinding,
  AccessUnitScope,
} from '@/services/repositories/access/types';

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

interface SupabaseFilterBuilder<T> extends PromiseLike<SupabaseQueryResponse<T[]>> {
  eq(column: string, value: unknown): SupabaseFilterBuilder<T>;
  maybeSingle(): Promise<SupabaseQueryResponse<T>>;
}

interface SupabaseTableBuilder {
  select(columns: string): SupabaseFilterBuilder<unknown>;
}

export interface SupabaseAccessClient {
  auth: { getUser(): Promise<SupabaseAuthResponse> };
  from(table: string): SupabaseTableBuilder;
}

type SupabaseAccessRepositoryOptions = {
  client: SupabaseAccessClient;
  resolveUserExists?: (input: { userId: string }) => Promise<AccessResult<boolean>>;
};

type OrganizationRow = { id: string; name: string; status: string };
type MembershipRow = { id: string; user_id: string; organization_id: string; status: string };
type RoleJoinRow = { code?: string; status?: string };
type RoleRow = {
  user_organization_id: string;
  organization_id: string;
  role_id: string;
  unit_id: string | null;
  status: string;
  roles?: RoleJoinRow | RoleJoinRow[];
};
type UnitRow = { id: string; organization_id: string; status: string };
type UnitScopeRow = {
  user_organization_id: string;
  organization_id: string;
  unit_id: string | null;
  status: string;
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

export class SupabaseAccessRepository
  implements OrganizationRepository, MembershipRepository, RoleRepository, UnitScopeRepository, AccessContextRepository
{
  private readonly client: SupabaseAccessClient;
  private readonly resolveUserExistsHook?: (input: { userId: string }) => Promise<AccessResult<boolean>>;

  constructor(options: SupabaseAccessRepositoryOptions) {
    this.client = options.client;
    this.resolveUserExistsHook = options.resolveUserExists;
  }

  async getOrganization({ identity }: { identity: AccessIdentity }): Promise<AccessResult<AccessOrganization>> {
    const sessionValidation = await this.validateSessionIdentity(identity);
    if (!sessionValidation.ok) return sessionValidation;

    const rowResult = await this.queryMaybeSingle<OrganizationRow>(
      'organizations',
      'id, name, status',
      [['id', identity.organizationId]]
    );
    if (!rowResult.ok) return rowResult;
    if (!rowResult.data) return fail('ORGANIZATION_NOT_FOUND');
    if (rowResult.data.id !== identity.organizationId) return fail('CROSS_TENANT_DATA');
    if (rowResult.data.status !== 'ativo') return fail('ORGANIZATION_INACTIVE');

    return ok({
      id: rowResult.data.id,
      nome: rowResult.data.name,
      status: 'active',
    });
  }

  async getMembership({ identity }: { identity: AccessIdentity }): Promise<AccessResult<AccessMembership>> {
    const sessionValidation = await this.validateSessionIdentity(identity);
    if (!sessionValidation.ok) return sessionValidation;

    const userId = identity.userId as string;
    const userExistenceResult = await this.resolveUserExists(userId);
    if (!userExistenceResult.ok) return userExistenceResult;
    if (!userExistenceResult.data) return fail('USER_NOT_FOUND');

    const rowResult = await this.queryMaybeSingle<MembershipRow>(
      'user_organizations',
      'id, user_id, organization_id, status',
      [
        ['user_id', userId],
        ['organization_id', identity.organizationId],
      ]
    );
    if (!rowResult.ok) return rowResult;
    if (!rowResult.data) return fail('NO_ACTIVE_MEMBERSHIP');
    if (rowResult.data.user_id !== userId || rowResult.data.organization_id !== identity.organizationId) {
      return fail('CROSS_TENANT_DATA');
    }
    if (rowResult.data.status !== 'ativo') return fail('MEMBERSHIP_INACTIVE');

    return ok({
      id: rowResult.data.id,
      userId: rowResult.data.user_id,
      organizationId: rowResult.data.organization_id,
      status: 'active',
    });
  }

  async getRoleBindings({
    identity,
    membership,
  }: {
    identity: AccessIdentity;
    membership: AccessMembership;
  }): Promise<AccessResult<AccessRoleBinding[]>> {
    const sessionValidation = await this.validateSessionIdentity(identity);
    if (!sessionValidation.ok) return sessionValidation;
    if (membership.userId !== identity.userId || membership.organizationId !== identity.organizationId) return fail('CROSS_TENANT_DATA');

    const rowResult = await this.queryMany<RoleRow>(
      'user_roles',
      'user_organization_id, organization_id, role_id, unit_id, status, roles(code, status)',
      [
        ['user_organization_id', membership.id],
        ['organization_id', membership.organizationId],
      ]
    );
    if (!rowResult.ok) return rowResult;

    const roleBindings: AccessRoleBinding[] = [];
    for (const row of rowResult.data) {
      if (row.organization_id !== membership.organizationId || row.user_organization_id !== membership.id) return fail('CROSS_TENANT_DATA');
      if (row.status !== 'ativo') continue;
      const roleCode = extractRoleCode(row.roles);
      const roleStatus = extractRoleStatus(row.roles);
      if (!roleCode || !isRole(roleCode)) {
        return fail('UNEXPECTED_BACKEND_ERROR', {
          details: 'Código de papel inválido.',
          cause: { source: 'validation', code: 'INVALID_ROLE_CODE' },
        });
      }
      if (roleStatus !== null && roleStatus !== 'ativo') continue;
      roleBindings.push({
        membershipId: row.user_organization_id,
        role: roleCode,
        unitId: row.unit_id ?? null,
        status: 'active',
      });
    }

    if (roleBindings.length === 0) return fail('NO_ACTIVE_ROLES');
    return ok(roleBindings);
  }

  async getUnitScopes({
    identity,
    membership,
  }: {
    identity: AccessIdentity;
    membership: AccessMembership;
  }): Promise<AccessResult<AccessUnitScope[]>> {
    const sessionValidation = await this.validateSessionIdentity(identity);
    if (!sessionValidation.ok) return sessionValidation;
    if (membership.userId !== identity.userId || membership.organizationId !== identity.organizationId) return fail('CROSS_TENANT_DATA');

    const rowResult = await this.queryMany<UnitScopeRow>(
      'user_profiles',
      'user_organization_id, organization_id, unit_id, status',
      [
        ['user_organization_id', membership.id],
        ['organization_id', membership.organizationId],
      ]
    );
    if (!rowResult.ok) return rowResult;

    const scopes: AccessUnitScope[] = [];
    for (const row of rowResult.data) {
      if (row.organization_id !== membership.organizationId || row.user_organization_id !== membership.id) return fail('CROSS_TENANT_DATA');
      if (row.status !== 'ativo' || !row.unit_id) continue;
      scopes.push({
        membershipId: row.user_organization_id,
        unitId: row.unit_id,
        organizationId: row.organization_id,
        status: 'active',
      });
    }

    return ok(scopes);
  }

  async resolveAccessContext(identity: AccessIdentity): Promise<AccessResult<AccessContext>> {
    const organization = await this.getOrganization({ identity });
    if (!organization.ok) return organization;

    const membership = await this.getMembership({ identity });
    if (!membership.ok) return membership;

    const roleBindings = await this.getRoleBindings({ identity, membership: membership.data });
    if (!roleBindings.ok) return roleBindings;

    const unitScopes = await this.getUnitScopes({ identity, membership: membership.data });
    if (!unitScopes.ok) return unitScopes;

    const unitValidation = await this.validateSelectedUnit(
      identity.selectedUnitId ?? null,
      membership.data,
      roleBindings.data,
      unitScopes.data
    );
    if (!unitValidation.ok) return unitValidation;

    const roles = deduplicateRoles(roleBindings.data.map((binding) => binding.role));
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
      organization: organization.data,
      membership: membership.data,
      roleBindings: roleBindings.data,
      roles,
      effectiveRole,
      unitScopes: unitScopes.data,
    });
  }

  private async validateSessionIdentity(identity: AccessIdentity): Promise<AccessResult<true>> {
    if (!identity.sessionUserId || !identity.userId) return fail('NO_SESSION');

    let authResponse: SupabaseAuthResponse;
    try {
      authResponse = await this.client.auth.getUser();
    } catch (error: unknown) {
      authResponse = { data: { user: null }, error: normalizeThrownError(error) };
    }

    if (authResponse.error) return this.mapBackendError(authResponse.error);
    if (!authResponse.data.user?.id) return fail('NO_SESSION');

    if (authResponse.data.user.id !== identity.sessionUserId || authResponse.data.user.id !== identity.userId) {
      return fail('IDENTITY_MISMATCH');
    }

    return ok(true);
  }

  private async resolveUserExists(userId: string): Promise<AccessResult<boolean>> {
    if (!this.resolveUserExistsHook) return ok(true);
    return this.resolveUserExistsHook({ userId });
  }

  private async validateSelectedUnit(
    selectedUnitId: string | null,
    membership: AccessMembership,
    roleBindings: AccessRoleBinding[],
    unitScopes: AccessUnitScope[]
  ): Promise<AccessResult<true>> {
    if (!selectedUnitId) return ok(true);

    const unitResult = await this.queryMaybeSingle<UnitRow>(
      'organization_units',
      'id, organization_id, status',
      [['id', selectedUnitId]]
    );
    if (!unitResult.ok) return unitResult;
    if (!unitResult.data) return fail('UNIT_SCOPE_INCOMPATIBLE');
    if (unitResult.data.organization_id !== membership.organizationId) return fail('CROSS_TENANT_DATA');
    if (unitResult.data.status !== 'ativo') return fail('UNIT_SCOPE_INCOMPATIBLE');

    const hasGlobalRole = roleBindings.some((binding) => binding.status === 'active' && binding.unitId === null);
    if (hasGlobalRole) return ok(true);

    const hasDirectRoleBinding = roleBindings.some(
      (binding) => binding.status === 'active' && binding.unitId === selectedUnitId
    );
    if (hasDirectRoleBinding) return ok(true);

    const matchingScope = unitScopes.find((scope) => scope.unitId === selectedUnitId && scope.status === 'active');
    if (!matchingScope) return fail('UNIT_SCOPE_INCOMPATIBLE');
    if (matchingScope.organizationId !== membership.organizationId || matchingScope.membershipId !== membership.id) {
      return fail('CROSS_TENANT_DATA');
    }

    return ok(true);
  }

  private async queryMaybeSingle<T>(
    table: string,
    select: string,
    filters: ReadonlyArray<readonly [string, unknown]>
  ): Promise<AccessResult<T | null>> {
    let query = this.client.from(table).select(select) as SupabaseFilterBuilder<T>;
    for (const [column, value] of filters) {
      query = query.eq(column, value);
    }
    let response: SupabaseQueryResponse<T>;
    try {
      response = await query.maybeSingle();
    } catch (error: unknown) {
      response = {
        data: null,
        error: normalizeThrownError(error),
      };
    }
    if (response.error) return this.mapBackendError(response.error);
    return ok(response.data ?? null);
  }

  private async queryMany<T>(
    table: string,
    select: string,
    filters: ReadonlyArray<readonly [string, unknown]>
  ): Promise<AccessResult<T[]>> {
    let query = this.client.from(table).select(select) as SupabaseFilterBuilder<T>;
    for (const [column, value] of filters) {
      query = query.eq(column, value);
    }
    let response: SupabaseQueryResponse<T[]>;
    try {
      response = await query;
    } catch (error: unknown) {
      response = {
        data: null,
        error: normalizeThrownError(error),
      };
    }
    if (response.error) return this.mapBackendError(response.error);
    return ok(response.data ?? []);
  }

  private mapBackendError(error: SupabaseLikeError): AccessResult<never> {
    const causeCode = sanitizeErrorCode(error.code, error.status);
    const causeMessage = sanitizeErrorMessage(error.message);
    const base: Pick<AccessError, 'details' | 'cause'> = {
      details: 'Falha técnica ao consultar repositório Supabase.',
      cause: { source: 'repository', code: causeCode, message: causeMessage },
    };

    if (isTransientError(error)) return fail('TRANSIENT_BACKEND_ERROR', base);
    return fail('UNEXPECTED_BACKEND_ERROR', base);
  }
}

export function createSupabaseAccessRepository(options: SupabaseAccessRepositoryOptions) {
  return new SupabaseAccessRepository(options);
}

function extractRoleCode(value: RoleRow['roles']): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  return typeof item?.code === 'string' ? item.code : null;
}

function extractRoleStatus(value: RoleRow['roles']): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  return typeof item?.status === 'string' ? item.status : null;
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

function normalizeThrownError(error: unknown): SupabaseLikeError {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Record<string, unknown>;
    return {
      message: typeof candidate['message'] === 'string' ? candidate['message'] : 'Erro não identificado.',
      code: typeof candidate['code'] === 'string' ? candidate['code'] : undefined,
      status: typeof candidate['status'] === 'number' ? candidate['status'] : undefined,
    };
  }
  return { message: 'Erro desconhecido durante consulta.', code: 'UNKNOWN_ERROR' };
}

function sanitizeErrorCode(code: string | undefined, status: number | undefined): string {
  if (typeof code === 'string' && code.trim().length > 0) return code.trim().slice(0, 64);
  if (typeof status === 'number') return `HTTP_${status}`;
  return 'SUPABASE_ERROR';
}

function sanitizeErrorMessage(message: string | undefined): string {
  if (!message) return 'Falha técnica sem mensagem detalhada.';
  return message.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function isTransientError(error: SupabaseLikeError): boolean {
  const transientStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
  if (typeof error.status === 'number' && transientStatusCodes.has(error.status)) return true;
  const code = error.code?.toUpperCase() ?? '';
  if (code.startsWith('ETIMEDOUT') || code.startsWith('ECONNRESET') || code === 'PGRST301') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('timeout') || message.includes('temporar') || message.includes('network');
}
