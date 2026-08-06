import type { AuditEvent } from '@/domains/audit/types';

const ALLOWED_CODES = new Set([
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
  'access_denied',
  'repository_error',
]);

const BLOCKED_REASON_PATTERN =
  /(diagnost|anota[cç][aã]o|prontu[aá]rio|cpf|senha|password|summary|notes?\s*=|body\s*=|conteudo\s*=)/i;

export type SanitizedAuditPayload = {
  action: string;
  entity: string;
  entityId?: string;
  correlationId?: string;
  result: AuditEvent['result'];
  reason: string;
};

/**
 * Builds audit reason with only action code + optional correlation id.
 * Rejects free-text clinical / PII payloads.
 */
export function sanitizeAuditMetadata(input: {
  code: string;
  entity: string;
  entityId?: string | null;
  correlationId?: string | null;
  result: AuditEvent['result'];
  rawReason?: string | null;
}): SanitizedAuditPayload {
  const code = input.code.trim().toLowerCase();
  if (!ALLOWED_CODES.has(code)) {
    throw new Error(`audit metadata: codigo nao permitido (${code})`);
  }

  if (input.rawReason && BLOCKED_REASON_PATTERN.test(input.rawReason)) {
    throw new Error('audit metadata: payload clinico/PII bloqueado');
  }

  const entityId = normalizeId(input.entityId);
  const correlationId = normalizeCorrelation(input.correlationId);
  const reasonParts = [`code=${code}`];
  if (correlationId) reasonParts.push(`corr=${correlationId}`);

  return {
    action: code,
    entity: input.entity.trim() || 'unknown',
    entityId,
    correlationId,
    result: input.result,
    reason: reasonParts.join('|'),
  };
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
