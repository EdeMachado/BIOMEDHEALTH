export type JourneyErrorCode =
  | 'NO_SESSION'
  | 'IDENTITY_MISMATCH'
  | 'CROSS_TENANT_DATA'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'JOURNEY_VERSION_NOT_FOUND'
  | 'JOURNEY_VERSION_AMBIGUOUS'
  | 'JOURNEY_VERSION_INELIGIBLE'
  | 'JOURNEY_VERSION_INCOMPATIBLE'
  | 'USER_JOURNEY_NOT_FOUND'
  | 'USER_JOURNEY_COMPLETED'
  | 'ACTIVITY_NOT_FOUND'
  | 'ACTIVITY_VERSION_MISMATCH'
  | 'INVALID_PROGRESS_PAYLOAD'
  | 'TECHNICAL_ERROR';

export type JourneyErrorKind =
  | 'authentication'
  | 'authorization'
  | 'consistency'
  | 'validation'
  | 'technical';

export type JourneyErrorCause = {
  source: 'mock' | 'repository' | 'validation';
  code: string;
  message?: string;
};

export type JourneyError = {
  code: JourneyErrorCode;
  kind: JourneyErrorKind;
  message: string;
  details?: string;
  cause?: JourneyErrorCause;
  transient: boolean;
};

export type JourneyResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: JourneyError };

export type JourneyContext = {
  sessionUserId: string | null;
  userId: string | null;
  organizationId: string;
};

export type HealthJourney = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  targetAudience: string;
  durationWeeks: number;
  technicalOwner: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type JourneyVersion = {
  id: string;
  organizationId: string;
  journeyId: string;
  code: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type JourneyStep = {
  id: string;
  organizationId: string;
  journeyVersionId: string;
  title: string;
  stepOrder: number;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type JourneyActivity = {
  id: string;
  organizationId: string;
  journeyStepId: string;
  title: string;
  periodicity: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type UserJourneyRecord = {
  id: string;
  organizationId: string;
  userId: string;
  journeyVersionId: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type UserActivityProgressRecord = {
  id: string;
  organizationId: string;
  userJourneyId: string;
  journeyActivityId: string;
  progressPercent: number;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type JourneyCatalog = {
  journey: HealthJourney;
  version: JourneyVersion;
  steps: JourneyStep[];
  activities: JourneyActivity[];
};

export type UserJourneyState = {
  userJourney: UserJourneyRecord;
  progress: UserActivityProgressRecord[];
};
