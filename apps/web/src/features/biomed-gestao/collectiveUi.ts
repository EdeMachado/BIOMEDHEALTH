/**
 * Adaptadores de apresentação para BioMed Gestão.
 * Regras de autorização, mensagens e formatação pertencem ao domínio coletivo.
 * A autorização definitiva permanece na RLS.
 */

export {
  canWriteCollective,
  formatCollectivePeriod as formatPeriod,
  formatCollectiveScopeLabel as formatScopeLabel,
  sanitizeCollectiveMessage as sanitizeCollectiveUiMessage,
} from '@/domains/collective';
