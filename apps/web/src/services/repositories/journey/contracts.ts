import type {
  JourneyCatalog,
  JourneyContext,
  JourneyResult,
  UserActivityProgressRecord,
  UserJourneyState,
} from '@/services/repositories/journey/types';

export type ResolveOperationalJourneyCatalogInput = {
  context: JourneyContext;
};

export type ResolveJourneyCatalogByVersionInput = {
  context: JourneyContext;
  journeyVersionId: string;
};

export type CreateOrGetActiveUserJourneyInput = {
  context: JourneyContext;
  journeyVersionId: string;
  status: string;
};

export type UpsertUserActivityProgressInput = {
  context: JourneyContext;
  userJourneyId: string;
  journeyVersionId: string;
  journeyActivityId: string;
  progressPercent: number;
  status: string;
};

export type MarkUserJourneyCompletionInput = {
  context: JourneyContext;
  userJourneyId: string;
  completedAt: string | null;
  status: string;
};

export interface JourneyRepository {
  resolveOperationalJourneyCatalog(
    input: ResolveOperationalJourneyCatalogInput
  ): Promise<JourneyResult<JourneyCatalog>>;
  resolveJourneyCatalogByVersion(
    input: ResolveJourneyCatalogByVersionInput
  ): Promise<JourneyResult<JourneyCatalog>>;
  getLatestUserJourneyState(
    context: JourneyContext
  ): Promise<JourneyResult<UserJourneyState | null>>;
  createOrGetActiveUserJourney(
    input: CreateOrGetActiveUserJourneyInput
  ): Promise<JourneyResult<UserJourneyState['userJourney']>>;
  upsertUserActivityProgress(
    input: UpsertUserActivityProgressInput
  ): Promise<JourneyResult<UserActivityProgressRecord>>;
  markUserJourneyCompletion(
    input: MarkUserJourneyCompletionInput
  ): Promise<JourneyResult<UserJourneyState['userJourney']>>;
}
