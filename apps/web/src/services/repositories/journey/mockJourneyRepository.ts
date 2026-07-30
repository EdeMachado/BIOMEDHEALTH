import { generateId } from '@/shared/lib/id';
import { readSessionItem, writeSessionItem } from '@/shared/lib/sessionStorage';
import { fail, ok } from '@/services/repositories/journey/errors';
import type {
  CreateOrGetActiveUserJourneyInput,
  JourneyRepository,
  MarkUserJourneyCompletionInput,
  ResolveJourneyCatalogByVersionInput,
  ResolveOperationalJourneyCatalogInput,
  UpsertUserActivityProgressInput,
} from '@/services/repositories/journey/contracts';
import type {
  HealthJourney,
  JourneyActivity,
  JourneyCatalog,
  JourneyContext,
  JourneyResult,
  JourneyStep,
  JourneyVersion,
  UserActivityProgressRecord,
  UserJourneyRecord,
} from '@/services/repositories/journey/types';

const STORAGE_KEY = 'biomed_mock_journey_runtime_v1';
const JOURNEY_ID = 'hj-org1-preventive';
const JOURNEY_VERSION_ID = 'jv-org1-preventive-v1';

type PersistedState = {
  journeys: HealthJourney[];
  versions: JourneyVersion[];
  steps: JourneyStep[];
  activities: JourneyActivity[];
  userJourneys: UserJourneyRecord[];
  progress: UserActivityProgressRecord[];
};

function defaultState(): PersistedState {
  const now = '2026-07-01T00:00:00.000Z';
  const journey: HealthJourney = {
    id: JOURNEY_ID,
    organizationId: 'org-1',
    name: 'Bem-estar e Prevenção',
    description: 'Jornada preventiva introdutoria.',
    targetAudience: 'Adultos ativos',
    durationWeeks: 8,
    technicalOwner: 'Equipe Clinica Demo',
    status: 'ativo',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  const activeVersion: JourneyVersion = {
    id: JOURNEY_VERSION_ID,
    organizationId: 'org-1',
    journeyId: JOURNEY_ID,
    code: 'preventive_journey_v1',
    status: 'ativo',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  const futureVersion: JourneyVersion = {
    id: 'jv-org1-preventive-v2',
    organizationId: 'org-1',
    journeyId: JOURNEY_ID,
    code: 'preventive_journey_v2',
    status: 'futuro',
    version: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  const steps: JourneyStep[] = Array.from({ length: 8 }).map((_, index) => ({
    id: `js-${index + 1}`,
    organizationId: 'org-1',
    journeyVersionId: JOURNEY_VERSION_ID,
    title: `Semana ${index + 1}`,
    stepOrder: index + 1,
    status: 'ativo',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }));
  const activities: JourneyActivity[] = [
    {
      id: 'ja-1',
      organizationId: 'org-1',
      journeyStepId: 'js-1',
      title: 'Rotina de sono',
      periodicity: 'Diaria',
      status: 'ativo',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ja-2',
      organizationId: 'org-1',
      journeyStepId: 'js-2',
      title: 'Hidratacao',
      periodicity: 'Diaria',
      status: 'ativo',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ja-3',
      organizationId: 'org-1',
      journeyStepId: 'js-3',
      title: 'Conteudo educativo',
      periodicity: 'Semanal',
      status: 'ativo',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];
  return {
    journeys: [journey],
    versions: [activeVersion, futureVersion],
    steps,
    activities,
    userJourneys: [],
    progress: [],
  };
}

export function createMockJourneyRepository(
  input: { now?: () => Date; seed?: Partial<PersistedState> } = {}
): JourneyRepository {
  const now = input.now ?? (() => new Date());
  const seed = input.seed;

  return {
    resolveOperationalJourneyCatalog(data: ResolveOperationalJourneyCatalogInput) {
      const contextValidation = validateContext(data.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);
      const state = readState(seed);
      const eligibleVersions = state.versions
        .filter((item) => item.organizationId === data.context.organizationId && item.status === 'ativo')
        .sort((a, b) => compareVersionRecency(a, b));
      if (eligibleVersions.length === 0) return Promise.resolve(fail('JOURNEY_VERSION_NOT_FOUND'));
      if (eligibleVersions.length > 1) return Promise.resolve(fail('JOURNEY_VERSION_AMBIGUOUS'));
      return Promise.resolve(buildCatalog(state, data.context.organizationId, eligibleVersions[0]));
    },

    resolveJourneyCatalogByVersion(data: ResolveJourneyCatalogByVersionInput) {
      const contextValidation = validateContext(data.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);
      const state = readState(seed);
      const version = state.versions.find(
        (item) => item.id === data.journeyVersionId && item.organizationId === data.context.organizationId
      );
      if (!version) return Promise.resolve(fail('JOURNEY_VERSION_NOT_FOUND'));
      return Promise.resolve(buildCatalog(state, data.context.organizationId, version));
    },

    getLatestUserJourneyState(context: JourneyContext) {
      const contextValidation = validateContext(context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);
      const state = readState(seed);
      const active = state.userJourneys
        .filter(
          (item) =>
            item.organizationId === context.organizationId &&
            item.userId === context.userId &&
            item.status === 'ativo' &&
            item.completedAt === null
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const completed = state.userJourneys
        .filter(
          (item) =>
            item.organizationId === context.organizationId &&
            item.userId === context.userId &&
            item.completedAt !== null
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const userJourney = active ?? completed ?? null;
      if (!userJourney) return Promise.resolve(ok(null));
      const progress = state.progress
        .filter((item) => item.organizationId === context.organizationId && item.userJourneyId === userJourney.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return Promise.resolve(ok({ userJourney, progress }));
    },

    createOrGetActiveUserJourney(inputData: CreateOrGetActiveUserJourneyInput) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);
      const state = readState(seed);
      const version = state.versions.find(
        (item) => item.id === inputData.journeyVersionId && item.organizationId === inputData.context.organizationId
      );
      if (!version) return Promise.resolve(fail('JOURNEY_VERSION_NOT_FOUND'));
      if (version.status !== 'ativo') return Promise.resolve(fail('JOURNEY_VERSION_INELIGIBLE'));
      const existing = state.userJourneys
        .filter(
          (item) =>
            item.organizationId === inputData.context.organizationId &&
            item.userId === inputData.context.userId &&
            item.status === 'ativo' &&
            item.completedAt === null
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (existing) return Promise.resolve(ok(existing));

      const timestamp = now().toISOString();
      const created: UserJourneyRecord = {
        id: generateId(),
        organizationId: inputData.context.organizationId,
        userId: inputData.context.userId as string,
        journeyVersionId: inputData.journeyVersionId,
        startedAt: timestamp,
        completedAt: null,
        status: inputData.status,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.userJourneys.push(created);
      writeState(state);
      return Promise.resolve(ok(created));
    },

    upsertUserActivityProgress(inputData: UpsertUserActivityProgressInput) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);
      if (!Number.isFinite(inputData.progressPercent) || inputData.progressPercent < 0 || inputData.progressPercent > 100) {
        return Promise.resolve(fail('INVALID_PROGRESS_PAYLOAD'));
      }
      const state = readState(seed);
      const userJourney = state.userJourneys.find(
        (item) =>
          item.id === inputData.userJourneyId &&
          item.organizationId === inputData.context.organizationId &&
          item.userId === inputData.context.userId
      );
      if (!userJourney) return Promise.resolve(fail('USER_JOURNEY_NOT_FOUND'));
      if (userJourney.completedAt !== null || userJourney.status !== 'ativo') return Promise.resolve(fail('USER_JOURNEY_COMPLETED'));
      if (userJourney.journeyVersionId !== inputData.journeyVersionId) return Promise.resolve(fail('ACTIVITY_VERSION_MISMATCH'));

      const stepIds = new Set(
        state.steps
          .filter(
            (step) =>
              step.organizationId === inputData.context.organizationId &&
              step.journeyVersionId === inputData.journeyVersionId
          )
          .map((step) => step.id)
      );
      const activity = state.activities.find(
        (item) =>
          item.id === inputData.journeyActivityId &&
          item.organizationId === inputData.context.organizationId &&
          stepIds.has(item.journeyStepId)
      );
      if (!activity) return Promise.resolve(fail('ACTIVITY_NOT_FOUND'));

      const current = state.progress.find(
        (item) =>
          item.organizationId === inputData.context.organizationId &&
          item.userJourneyId === inputData.userJourneyId &&
          item.journeyActivityId === inputData.journeyActivityId
      );
      const timestamp = now().toISOString();
      if (!current) {
        const created: UserActivityProgressRecord = {
          id: generateId(),
          organizationId: inputData.context.organizationId,
          userJourneyId: inputData.userJourneyId,
          journeyActivityId: inputData.journeyActivityId,
          progressPercent: inputData.progressPercent,
          status: inputData.status,
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        state.progress.push(created);
        writeState(state);
        return Promise.resolve(ok(created));
      }

      const updated: UserActivityProgressRecord = {
        ...current,
        progressPercent: inputData.progressPercent,
        status: inputData.status,
        version: current.version + 1,
        updatedAt: timestamp,
      };
      state.progress = state.progress.map((item) => (item.id === updated.id ? updated : item));
      writeState(state);
      return Promise.resolve(ok(updated));
    },

    markUserJourneyCompletion(inputData: MarkUserJourneyCompletionInput) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);
      const state = readState(seed);
      const current = state.userJourneys.find(
        (item) =>
          item.id === inputData.userJourneyId &&
          item.organizationId === inputData.context.organizationId &&
          item.userId === inputData.context.userId
      );
      if (!current) return Promise.resolve(fail('USER_JOURNEY_NOT_FOUND'));
      if (current.completedAt !== null) return Promise.resolve(fail('USER_JOURNEY_COMPLETED'));
      if (!inputData.completedAt || inputData.status !== 'concluida') {
        return Promise.resolve(fail('INVALID_PROGRESS_PAYLOAD'));
      }
      const updated: UserJourneyRecord = {
        ...current,
        status: inputData.status,
        completedAt: inputData.completedAt,
        version: current.version + 1,
        updatedAt: now().toISOString(),
      };
      state.userJourneys = state.userJourneys.map((item) => (item.id === current.id ? updated : item));
      writeState(state);
      return Promise.resolve(ok(updated));
    },
  };
}

function validateContext(context: JourneyContext): JourneyResult<true> {
  if (!context.sessionUserId || !context.userId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.userId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return ok(true);
}

function buildCatalog(state: PersistedState, organizationId: string, version: JourneyVersion): JourneyResult<JourneyCatalog> {
  const journey = state.journeys.find((item) => item.id === version.journeyId && item.organizationId === organizationId);
  if (!journey || journey.status !== 'ativo') return fail('JOURNEY_VERSION_INELIGIBLE');
  const steps = state.steps
    .filter((item) => item.organizationId === organizationId && item.journeyVersionId === version.id && item.status === 'ativo')
    .sort((a, b) => a.stepOrder - b.stepOrder || a.createdAt.localeCompare(b.createdAt));
  const stepIds = new Set(steps.map((item) => item.id));
  const activities = state.activities
    .filter((item) => item.organizationId === organizationId && item.status === 'ativo' && stepIds.has(item.journeyStepId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title));
  return ok({ journey, version, steps, activities });
}

function readState(seed?: Partial<PersistedState>): PersistedState {
  const base = {
    ...defaultState(),
    ...seed,
  };
  const raw = readSessionItem(STORAGE_KEY);
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      journeys: parsed.journeys ?? base.journeys,
      versions: parsed.versions ?? base.versions,
      steps: parsed.steps ?? base.steps,
      activities: parsed.activities ?? base.activities,
      userJourneys: parsed.userJourneys ?? base.userJourneys,
      progress: parsed.progress ?? base.progress,
    };
  } catch {
    return base;
  }
}

function writeState(state: PersistedState): void {
  writeSessionItem(STORAGE_KEY, JSON.stringify(state));
}

function compareVersionRecency(a: JourneyVersion, b: JourneyVersion): number {
  if (a.version !== b.version) return b.version - a.version;
  if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
  return b.createdAt.localeCompare(a.createdAt);
}
