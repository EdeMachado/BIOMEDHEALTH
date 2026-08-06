/**
 * SUP-D01-C — tipos de repository coletivo.
 * Persistência alinhada a D01-B; sem agregações D02.
 */

import type {
  CollectiveAudienceInput,
  CollectiveScope,
  CreateCampaignInput,
  InstitutionalContext,
  UpdateCampaignInput,
} from '@/domains/collective';

export type CollectiveRepositoryMode = 'mock' | 'supabase';

export type CollectiveErrorKind =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'consistency'
  | 'technical'
  | 'atomicity';

export type CollectiveErrorCode =
  | 'NO_SESSION'
  | 'IDENTITY_MISMATCH'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'CROSS_TENANT_DATA'
  | 'AUTHORIZATION_DENIED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ATOMICITY_REQUIRED'
  | 'TECHNICAL_ERROR'
  | 'AUDIT_REQUIRED_FAILED';

export type CollectiveError = {
  code: CollectiveErrorCode;
  kind: CollectiveErrorKind;
  transient: boolean;
  message: string;
  details?: Record<string, unknown>;
  cause?: { source: 'repository'; code?: string; message?: string };
};

export type CollectiveResult<T> = { ok: true; data: T } | { ok: false; error: CollectiveError };

export type CollectiveContext = InstitutionalContext;

export type CampaignRecord = {
  id: string;
  organizationId: string;
  scope: CollectiveScope;
  title: string;
  description: string;
  channel: string;
  startsAt: string;
  endsAt: string;
  campaignStatus: string;
  status: string;
  version: number;
  audience?: CollectiveAudienceInput;
  createdAt: string;
  updatedAt: string;
};

export type ActionPlanScope = CollectiveScope;

export type ActionPlanRecord = {
  id: string;
  organizationId: string;
  scope: ActionPlanScope;
  originIndicator: string;
  issueDescription: string;
  actionText: string;
  ownerName: string;
  dueDate: string;
  priority: string;
  actionStatus: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateActionPlanInput = {
  organizationId: string;
  scope: ActionPlanScope;
  originIndicator: string;
  issueDescription: string;
  actionText: string;
  ownerName: string;
  dueDate: string;
  priority: string;
  actionStatus?: string;
};

export type UpdateActionPlanInput = {
  organizationId: string;
  actionPlanId: string;
  scope?: ActionPlanScope;
  originIndicator?: string;
  issueDescription?: string;
  actionText?: string;
  ownerName?: string;
  dueDate?: string;
  priority?: string;
  actionStatus?: string;
};

export type ListCampaignsInput = {
  context: CollectiveContext;
  campaignStatus?: string;
  search?: string;
};

export type ListActionPlansInput = {
  context: CollectiveContext;
  actionStatus?: string;
};

export type { CreateCampaignInput, UpdateCampaignInput, CollectiveAudienceInput };
