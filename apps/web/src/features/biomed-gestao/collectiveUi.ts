/**
 * Helpers de UX para BioMed Gestão × repository coletivo (SUP-D01-C).
 * Autorização definitiva permanece na RLS; papéis aqui só controlam a experiência.
 */

import type { Role } from '@/shared/types/access';
import type { CollectiveError } from '@/services/repositories/collective/types';

const WRITE_ROLES: ReadonlySet<Role> = new Set([
  'gestor_institucional',
  'sst',
  'admin_cliente',
  'admin_biomed',
]);

export function canWriteCollective(role: Role | null | undefined): boolean {
  if (!role) return false;
  return WRITE_ROLES.has(role);
}

export function sanitizeCollectiveUiMessage(error: CollectiveError): string {
  switch (error.code) {
    case 'NO_SESSION':
      return 'Sessao ausente. Faca login novamente.';
    case 'IDENTITY_MISMATCH':
      return 'Sessao inconsistente com o contexto solicitado.';
    case 'NO_ACTIVE_MEMBERSHIP':
      return 'Sem vinculo organizacional ativo para gestao coletiva.';
    case 'CROSS_TENANT_DATA':
    case 'AUTHORIZATION_DENIED':
      return 'Operacao nao autorizada para este recurso coletivo.';
    case 'INVALID_INPUT':
      return 'Dados invalidos. Revise o formulario.';
    case 'NOT_FOUND':
      return 'Recurso coletivo nao encontrado.';
    case 'CONFLICT':
      return 'Conflito ao salvar. Recarregue e tente novamente.';
    case 'ATOMICITY_REQUIRED':
      return 'Esta operacao exige persistencia atomica multi-tabela (RPC autorizada fora do D01-C). Nao foi executada.';
    case 'TECHNICAL_ERROR':
    default:
      return 'Falha tecnica ao acessar gestao coletiva.';
  }
}

export function formatScopeLabel(scope: {
  scopeType: string;
  unitId?: string | null;
  unitApplicability?: string | null;
}): string {
  if (scope.scopeType === 'unit') return `Unidade ${scope.unitId ?? '—'}`;
  if (scope.unitApplicability === 'selected_units') return 'Organizacao (unidades selecionadas)';
  return 'Organizacao (todas as unidades)';
}

export function formatPeriod(startsAt: string, endsAt: string): string {
  return `${startsAt} a ${endsAt}`;
}
