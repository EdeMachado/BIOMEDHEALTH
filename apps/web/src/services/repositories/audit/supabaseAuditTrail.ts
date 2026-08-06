import type { AuditEvent } from '@/domains/audit/types';
import type { AuditRegisterInput, AuditTrail, SupabaseAuditClient } from './types';

type AuditRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  origin: string;
  result: string;
  reason: string | null;
  created_at: string;
};

function mapRow(row: AuditRow): AuditEvent {
  const result =
    row.result === 'sucesso' || row.result === 'falha' || row.result === 'negado'
      ? row.result
      : 'falha';

  return {
    id: row.id,
    actorEmail: row.actor_user_id ?? 'desconhecido',
    actorRole: row.actor_role,
    organizationId: row.organization_id,
    action: row.action,
    entity: row.entity_id ? `${row.entity}:${row.entity_id}` : row.entity,
    result,
    timestamp: row.created_at,
    reason: row.reason ?? undefined,
  };
}

/**
 * Persistent audit trail via app_audit.register_event RPC + audit_events SELECT.
 * Failures are logged; callers keep fire-and-forget semantics.
 */
export function createSupabaseAuditTrail(client: SupabaseAuditClient): AuditTrail {
  return {
    mode: 'supabase',
    register(event: AuditRegisterInput) {
      void (async () => {
        const { error } = await client.rpc('register_audit_event', {
          p_organization_id: event.organizationId,
          p_actor_role: event.actorRole,
          p_action: event.action,
          p_entity: event.entity,
          p_entity_id: null,
          p_origin: 'web',
          p_result: event.result,
          p_reason: event.reason
            ? `${event.reason} | actor=${event.actorEmail}`
            : `actor=${event.actorEmail}`,
        });
        if (error) {
          console.error('[audit] Falha ao persistir evento', error.message);
        }
      })();
    },
    listSync() {
      return [];
    },
    async list() {
      const { data, error } = await client
        .from('audit_events')
        .select(
          'id, organization_id, actor_user_id, actor_role, action, entity, entity_id, origin, result, reason, created_at'
        )
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as AuditRow[]).map(mapRow);
    },
  };
}
