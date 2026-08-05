export type {
  CampaignContract,
  CollectiveAudienceInput,
  CollectiveScope,
  CollectiveScopeType,
  CreateCampaignInput,
  InstitutionalContext,
  NonEmptyArray,
  PersonalContext,
  SafeAggregateResult,
  UnitApplicabilityLiteral,
  UpdateCampaignInput,
} from './types';

export {
  isCollectiveScope,
  isNonEmptyArray,
  parseCollectiveScope,
  validateCreateCampaignInputStructure,
} from './guards';
export type {
  CollectiveScopeParseFailure,
  CollectiveScopeParseResult,
  CreateCampaignStructuralFailure,
  CreateCampaignStructuralResult,
} from './guards';

export {
  canWriteCollective,
  formatCollectivePeriod,
  formatCollectiveScopeLabel,
  sanitizeCollectiveMessage,
} from './policy';
