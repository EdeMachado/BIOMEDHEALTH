/**
 * Canonical classification for PostgreSQL/PostgREST SQLSTATE 42501
 * (insufficient_privilege) across clinical repositories.
 *
 * Module Result/fail helpers stay local: each repository builds its own Result
 * with this shared classification to avoid cross-module type coupling.
 */

export const POSTGRES_INSUFFICIENT_PRIVILEGE_SQLSTATE = '42501' as const;

/** Internal clinical error code used for 42501 (majority pattern in repo). */
export const CLINICAL_INSUFFICIENT_PRIVILEGE_ERROR_CODE = 'CROSS_TENANT_DATA' as const;

export const CLINICAL_INSUFFICIENT_PRIVILEGE_KIND = 'authorization' as const;

export const CLINICAL_INSUFFICIENT_PRIVILEGE_TRANSIENT = false as const;

export type ClinicalInsufficientPrivilegeClassification = {
  readonly code: typeof CLINICAL_INSUFFICIENT_PRIVILEGE_ERROR_CODE;
  readonly kind: typeof CLINICAL_INSUFFICIENT_PRIVILEGE_KIND;
  readonly transient: typeof CLINICAL_INSUFFICIENT_PRIVILEGE_TRANSIENT;
};

export function isPostgresInsufficientPrivilege(code: string | undefined | null): boolean {
  return (code ?? '').toUpperCase() === POSTGRES_INSUFFICIENT_PRIVILEGE_SQLSTATE;
}

export function classifyPostgresInsufficientPrivilege(): ClinicalInsufficientPrivilegeClassification {
  return {
    code: CLINICAL_INSUFFICIENT_PRIVILEGE_ERROR_CODE,
    kind: CLINICAL_INSUFFICIENT_PRIVILEGE_KIND,
    transient: CLINICAL_INSUFFICIENT_PRIVILEGE_TRANSIENT,
  };
}
