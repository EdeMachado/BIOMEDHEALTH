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

  const correlationMatch = row.reason?.match(/(?:^|\|)corr=([A-Za-z0-9_-]{8,64})(?:\||$)/);

  return {
    id: row.id,
    actorEmail: row.actor_user_id ?? 'desconhecido',
    actorRole: row.actor_role,
    organizationId: row.organization_id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id ?? undefined,
    correlationId: correlationMatch?.[1],
    result,
    timestamp: row.created_at,
    reason: row.reason ?? undefined,
  };
}

async function persist(
  client: SupabaseAuditClient,
  event: AuditRegisterInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await client.rpc('register_audit_event', {
    p_organization_id: event.organizationId,
    p_actor_role: event.actorRole,
    p_action: event.action,
    p_entity: event.entity,
    p_entity_id: event.entityId ?? null,
    p_origin: 'web',
    p_result: event.result,
    p_reason: event.reason ?? null,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

/**
 * Persistent audit trail via public.register_audit_event RPC + audit_events SELECT.
 * Never falls back to sessionStorage / mock.
 */
export function createSupabaseAuditTrail(client: SupabaseAuditClient): AuditTrail {
  return {
    mode: 'supabase',
    register(event: AuditRegisterInput) {
      void persist(client, event).then((result) => {
        if (!result.ok) {
          console.error('[audit] Falha ao persistir evento', result.message);
        }
      });
    },
    async registerAsync(event: AuditRegisterInput) {
      return persist(client, event);
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
