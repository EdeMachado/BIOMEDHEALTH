export type AuditEvent = {
  id: string;
  actorEmail: string;
  actorRole: string;
  organizationId: string;
  action: string;
  entity: string;
  /** Opaque identifier only (UUID / stable id) — never clinical content. */
  entityId?: string;
  /** Correlation token for provenance across hops. */
  correlationId?: string;
  result: 'sucesso' | 'falha' | 'negado';
  timestamp: string;
  reason?: string;
};
