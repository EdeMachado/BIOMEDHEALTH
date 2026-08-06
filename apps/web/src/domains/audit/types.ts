export type AuditEvent = {
  id: string;
  actorEmail: string;
  actorRole: string;
  organizationId: string;
  action: string;
  entity: string;
  result: 'sucesso' | 'falha' | 'negado';
  timestamp: string;
  reason?: string;
};
