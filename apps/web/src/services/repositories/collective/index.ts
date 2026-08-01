export type { CollectiveRepository } from '@/services/repositories/collective/contracts';
export {
  COLLECTIVE_REPOSITORY_MODE_ENV_KEY,
  createCollectiveRepositoryFactory,
  resolveCollectiveRepositoryMode,
  type CollectiveModeEnvironment,
} from '@/services/repositories/collective/factory';
export { createMockCollectiveRepository } from '@/services/repositories/collective/mockCollectiveRepository';
export {
  createSupabaseCollectiveRepository,
  type SupabaseCollectiveClient,
} from '@/services/repositories/collective/supabaseCollectiveRepository';
export type {
  ActionPlanRecord,
  CampaignRecord,
  CollectiveContext,
  CollectiveError,
  CollectiveErrorCode,
  CollectiveRepositoryMode,
  CollectiveResult,
  CreateActionPlanInput,
  ListActionPlansInput,
  ListCampaignsInput,
  UpdateActionPlanInput,
} from '@/services/repositories/collective/types';
export {
  requiresMultiTableWrite,
  validateCreateActionPlanWrite,
  validateCreateCampaignWrite,
  validateUpdateActionPlanWrite,
  validateUpdateCampaignWrite,
} from '@/services/repositories/collective/validation';
