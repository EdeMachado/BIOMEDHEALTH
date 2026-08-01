import type { CreateCampaignInput, UpdateCampaignInput } from '@/domains/collective';
import type {
  ActionPlanRecord,
  CampaignRecord,
  CollectiveContext,
  CollectiveResult,
  CreateActionPlanInput,
  ListActionPlansInput,
  ListCampaignsInput,
  UpdateActionPlanInput,
} from '@/services/repositories/collective/types';

export interface CollectiveRepository {
  listCampaigns(input: ListCampaignsInput): Promise<CollectiveResult<CampaignRecord[]>>;
  getCampaign(
    context: CollectiveContext,
    campaignId: string
  ): Promise<CollectiveResult<CampaignRecord>>;
  createCampaign(
    context: CollectiveContext,
    input: CreateCampaignInput
  ): Promise<CollectiveResult<CampaignRecord>>;
  updateCampaign(
    context: CollectiveContext,
    input: UpdateCampaignInput
  ): Promise<CollectiveResult<CampaignRecord>>;
  deleteCampaign(
    context: CollectiveContext,
    campaignId: string
  ): Promise<CollectiveResult<{ id: string }>>;

  listActionPlans(input: ListActionPlansInput): Promise<CollectiveResult<ActionPlanRecord[]>>;
  getActionPlan(
    context: CollectiveContext,
    actionPlanId: string
  ): Promise<CollectiveResult<ActionPlanRecord>>;
  createActionPlan(
    context: CollectiveContext,
    input: CreateActionPlanInput
  ): Promise<CollectiveResult<ActionPlanRecord>>;
  updateActionPlan(
    context: CollectiveContext,
    input: UpdateActionPlanInput
  ): Promise<CollectiveResult<ActionPlanRecord>>;
  deleteActionPlan(
    context: CollectiveContext,
    actionPlanId: string
  ): Promise<CollectiveResult<{ id: string }>>;
}
