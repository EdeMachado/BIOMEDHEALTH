import type { AuditEvent } from '@/domains/audit/types';
import type { AuditEventInput, AuditSource } from '@/domains/audit/auditContract';
import { toDbResult } from '@/domains/audit/auditContract';

const ALLOWED_CODES = new Set([
  'login',
  'logout',
  'access_denied',
  'consent_accepted',
  'consent_revoked',
  'clinical_record_draft_saved',
  'clinical_record_concluded',
  'clinical_record_reopened',
  'care_plan_created',
  'care_plan_closed',
  'care_plan_note_added',
  'clinical_appointment_created',
  'clinical_appointment_updated',
  'campaign_created',
  'campaign_updated',
  'campaign_closed',
  'campaign_deleted',
  'action_plan_created',
  'action_plan_updated',
  'action_plan_status_advanced',
  'action_plan_deleted',
  'repository_error',
  'context_denied',
  'permission_denied',
  'audit_persist_failed',
]);

const ALLOWED_SOURCES = new Set<AuditSource>([
  'auth',
  'consent',
  'clinical',
  'collective',
  'lgpd',
  'repository',
  'application',
]);

const ALLOWED_METADATA_KEYS = new Set([
  'error_code',
  'scope_type',
  'campaign_status',
  'action_status',
  'repository_mode',
  'previous_status',
  'next_status',
]);

const BLOCKED_REASON_PATTERN =
  /(diagnost|anota[cç][aã]o|prontu[aá]rio|cpf|senha|password|summary|notes?\s*=|body\s*=|conteudo\s*=|email\s*=|token|jwt|bearer|stack|select\s+|insert\s+|update\s+|delete\s+)/i;

export type SanitizedAuditPayload = {
  action: string;
  entity: string;
  entityId?: string;
  correlationId: string;
  source: AuditSource;
  result: AuditEvent['result'];
  reason: string;
};

/**
 * Allowlist sanitizer — rejects PHI/PII/clinical free text and unknown keys.
 */
export function sanitizeAuditMetadata(input: {
  code: string;
  entity: string;
  entityId?: string | null;
  correlationId?: string | null;
  result: AuditEvent['result'];
  source?: AuditSource;
  rawReason?: string | null;
  metadata?: Record<string, unknown> | null;
}): SanitizedAuditPayload {
  const code = input.code.trim().toLowerCase();
  if (!ALLOWED_CODES.has(code)) {
    throw new Error(`audit metadata: codigo nao permitido (${code})`);
  }

  if (input.rawReason && BLOCKED_REASON_PATTERN.test(input.rawReason)) {
    throw new Error('audit metadata: payload clinico/PII bloqueado');
  }

  const source = input.source ?? 'application';
  if (!ALLOWED_SOURCES.has(source)) {
    throw new Error('audit metadata: source invalida');
  }

  const entityId = normalizeId(input.entityId);
  const correlationId = normalizeCorrelation(input.correlationId);
  if (!correlationId) {
    throw new Error('audit metadata: correlationId obrigatorio');
  }

  const metaPairs = sanitizeMetadataRecord(input.metadata);
  const reasonParts = [`code=${code}`, `src=${source}`, `corr=${correlationId}`, ...metaPairs];

  return {
    action: code,
    entity: input.entity.trim() || 'unknown',
    entityId,
    correlationId,
    source,
    result: input.result,
    reason: reasonParts.join('|').slice(0, 500),
  };
}

/** Builds DB-facing register payload from canonical AuditEventInput. */
export function sanitizeAuditEventInput(input: AuditEventInput): SanitizedAuditPayload & {
  organizationId: string;
  actorEmail: string;
  actorRole: string;
} {
  const meta = sanitizeAuditMetadata({
    code: input.reasonCode ?? input.action,
    entity: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId,
    result: toDbResult(input.result),
    source: input.source,
    metadata: input.metadata,
  });
  return {
    ...meta,
    organizationId: input.organizationId,
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
  };
}

function sanitizeMetadataRecord(metadata: Record<string, unknown> | null | undefined): string[] {
  if (!metadata) return [];
  const keys = Object.keys(metadata);
  if (keys.length > 8) {
    throw new Error('audit metadata: excesso de campos');
  }
  const pairs: string[] = [];
  for (const key of keys) {
    if (!ALLOWED_METADATA_KEYS.has(key)) {
      throw new Error(`audit metadata: chave nao permitida (${key})`);
    }
    const value = metadata[key];
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object') {
      throw new Error('audit metadata: objetos aninhados proibidos');
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error('audit metadata: tipo de valor nao permitido');
    }
    const asText = typeof value === 'string' ? value : String(value);
    if (asText.length > 64) {
      throw new Error('audit metadata: valor excede limite');
    }
    if (BLOCKED_REASON_PATTERN.test(asText)) {
      throw new Error('audit metadata: valor bloqueado');
    }
    pairs.push(`${key}=${asText}`);
  }
  return pairs;
}

function normalizeId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 80) {
    throw new Error('audit metadata: entityId excede limite');
  }
  if (BLOCKED_REASON_PATTERN.test(trimmed)) {
    throw new Error('audit metadata: entityId invalido');
  }
  return trimmed;
}

function normalizeCorrelation(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(trimmed)) {
    throw new Error('audit metadata: correlationId invalido');
  }
  return trimmed;
}
