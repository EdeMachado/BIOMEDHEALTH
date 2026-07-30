import { fail, ok } from '@/services/repositories/journey/errors';
import type { JourneyRepository } from '@/services/repositories/journey/contracts';
import type {
  ClinicalJourneyContext,
  ClinicalPatientJourneyView,
  JourneyActivity,
  JourneyCatalog,
  JourneyContext,
  JourneyResult,
  UserActivityProgressRecord,
  UserJourneyRecord,
} from '@/services/repositories/journey/types';

const CONTEXT_LOCKS = new Map<string, Promise<unknown>>();

export type JourneyActivityStatus = 'Pendente' | 'Em andamento' | 'Concluída';

export type JourneyActivityView = {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string;
  frequencia: string;
  status: JourneyActivityStatus;
  progresso: number;
  dataPrevista: string;
};

export type JourneyWeekView = {
  week: number;
  status: 'concluida' | 'em andamento' | 'bloqueada';
};

export type JourneyRuntimeSnapshot = {
  catalog: JourneyCatalog;
  userJourney: UserJourneyRecord;
  progress: UserActivityProgressRecord[];
  weeks: JourneyWeekView[];
  activities: JourneyActivityView[];
  completed: boolean;
};

export async function loadJourneyRuntimeSnapshot(
  repository: JourneyRepository,
  context: JourneyContext
): Promise<JourneyResult<JourneyRuntimeSnapshot | null>> {
  const latest = await repository.getLatestUserJourneyState(context);
  if (!latest.ok) return latest;

  if (latest.data) {
    const catalogByVersion = await repository.resolveJourneyCatalogByVersion({
      context,
      journeyVersionId: latest.data.userJourney.journeyVersionId,
    });
    if (!catalogByVersion.ok) return catalogByVersion;
    return ok(
      buildSnapshot(
        catalogByVersion.data,
        latest.data.userJourney,
        latest.data.progress
      )
    );
  }

  const catalog = await repository.resolveOperationalJourneyCatalog({ context });
  if (!catalog.ok) {
    if (catalog.error.code === 'JOURNEY_VERSION_NOT_FOUND') return ok(null);
    return catalog;
  }
  const started = await repository.createOrGetActiveUserJourney({
    context,
    journeyVersionId: catalog.data.version.id,
    status: 'ativo',
  });
  if (!started.ok) return started;
  return ok(buildSnapshot(catalog.data, started.data, []));
}

export async function registerJourneyActivityProgress(
  repository: JourneyRepository,
  context: JourneyContext,
  runtime: JourneyRuntimeSnapshot,
  input: { activityId: string; intent: 'complete' | 'register_today' }
): Promise<JourneyResult<JourneyRuntimeSnapshot>> {
  return runLockedByContext(context, async () => {
    if (runtime.completed) return fail('USER_JOURNEY_COMPLETED');
    const activity = runtime.activities.find((item) => item.id === input.activityId);
    if (!activity) return fail('ACTIVITY_NOT_FOUND');

    const nextProgress =
      input.intent === 'complete' ? 100 : Math.min(activity.progresso + 20, 95);
    const nextStatus = nextProgress === 100 ? 'concluida' : 'em_andamento';

    const persisted = await repository.upsertUserActivityProgress({
      context,
      userJourneyId: runtime.userJourney.id,
      journeyVersionId: runtime.catalog.version.id,
      journeyActivityId: activity.id,
      progressPercent: nextProgress,
      status: nextStatus,
    });
    if (!persisted.ok) return persisted;

    const refreshed = await repository.getLatestUserJourneyState(context);
    if (!refreshed.ok) return refreshed;
    if (!refreshed.data) return fail('USER_JOURNEY_NOT_FOUND');

    let userJourney = refreshed.data.userJourney;
    const allDone = areAllActivitiesCompleted(runtime.catalog.activities, refreshed.data.progress);
    if (allDone && userJourney.completedAt === null) {
      const completion = await repository.markUserJourneyCompletion({
        context,
        userJourneyId: userJourney.id,
        completedAt: new Date().toISOString(),
        status: 'concluida',
      });
      if (!completion.ok) return completion;
      userJourney = completion.data;
    }

    return ok(buildSnapshot(runtime.catalog, userJourney, refreshed.data.progress));
  });
}

function buildSnapshot(
  catalog: JourneyCatalog,
  userJourney: UserJourneyRecord,
  progress: UserActivityProgressRecord[]
): JourneyRuntimeSnapshot {
  const byActivityId = new Map<string, UserActivityProgressRecord>();
  for (const item of progress) byActivityId.set(item.journeyActivityId, item);

  const stepById = new Map(catalog.steps.map((step) => [step.id, step]));
  const activities: JourneyActivityView[] = catalog.activities.map((item) => {
    const step = stepById.get(item.journeyStepId);
    const persisted = byActivityId.get(item.id);
    const progressPercent = clampProgress(persisted?.progressPercent ?? 0);
    return {
      id: item.id,
      titulo: item.title,
      categoria: step?.title ?? 'Etapa sem titulo',
      descricao: `Atividade preventiva da etapa ${step?.title ?? 'vinculada'}.`,
      frequencia: item.periodicity,
      status:
        progressPercent >= 100
          ? 'Concluída'
          : progressPercent > 0
            ? 'Em andamento'
            : 'Pendente',
      progresso: progressPercent,
      dataPrevista:
        progressPercent >= 100
          ? formatCompletionDate(persisted?.updatedAt ?? userJourney.updatedAt)
          : 'Hoje',
    };
  });

  return {
    catalog,
    userJourney,
    progress,
    weeks: deriveWeekStates(catalog, activities),
    activities: sortActivities(catalog.activities, activities),
    completed: userJourney.completedAt !== null || userJourney.status === 'concluida',
  };
}

function deriveWeekStates(
  catalog: JourneyCatalog,
  activities: JourneyActivityView[]
): JourneyWeekView[] {
  const byStep = new Map<string, JourneyActivityView[]>();
  for (const activity of catalog.activities) {
    if (!byStep.has(activity.journeyStepId)) byStep.set(activity.journeyStepId, []);
    const view = activities.find((entry) => entry.id === activity.id);
    if (view) byStep.get(activity.journeyStepId)?.push(view);
  }

  const orderedSteps = [...catalog.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const allDoneByStep = orderedSteps.map((step) => {
    const group = byStep.get(step.id) ?? [];
    return group.length > 0 && group.every((item) => item.progresso >= 100);
  });
  const firstIncomplete = allDoneByStep.findIndex((value) => !value);

  return orderedSteps.map((step, index) => {
    if (allDoneByStep[index]) return { week: step.stepOrder, status: 'concluida' };
    if (firstIncomplete === -1 || index === firstIncomplete) {
      return { week: step.stepOrder, status: 'em andamento' };
    }
    return { week: step.stepOrder, status: 'bloqueada' };
  });
}

function sortActivities(
  source: JourneyActivity[],
  rendered: JourneyActivityView[]
): JourneyActivityView[] {
  const position = new Map<string, number>();
  source.forEach((item, index) => position.set(item.id, index));
  return [...rendered].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}

function areAllActivitiesCompleted(
  activities: JourneyActivity[],
  progress: UserActivityProgressRecord[]
): boolean {
  if (activities.length === 0) return false;
  const map = new Map(progress.map((item) => [item.journeyActivityId, item]));
  return activities.every((item) => clampProgress(map.get(item.id)?.progressPercent ?? 0) >= 100);
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function formatCompletionDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'Concluída';
  return `Concluída em ${parsed.toLocaleDateString('pt-BR')}`;
}

async function runLockedByContext<T>(
  context: JourneyContext,
  task: () => Promise<T>
): Promise<T> {
  const key = `${context.organizationId}:${context.userId ?? 'anon'}`;
  const previous = CONTEXT_LOCKS.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(task);
  CONTEXT_LOCKS.set(key, pending);
  try {
    return await pending;
  } finally {
    if (CONTEXT_LOCKS.get(key) === pending) CONTEXT_LOCKS.delete(key);
  }
}

/** Leitura clinica vinculada read-only. Nao expoe APIs de escrita. */
export async function loadLinkedPatientJourneyViews(
  repository: JourneyRepository,
  context: ClinicalJourneyContext
): Promise<JourneyResult<ClinicalPatientJourneyView[]>> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId || !context.patientUserId) return fail('CLINICAL_ACCESS_DENIED');
  if (context.patientUserId === context.professionalUserId) return fail('CLINICAL_ACCESS_DENIED');
  return repository.listLinkedPatientJourneys({ context });
}

export function summarizeClinicalJourneyViews(views: ClinicalPatientJourneyView[]): {
  primary: ClinicalPatientJourneyView | null;
  label: string;
  detail: string;
} {
  const primary = views[0] ?? null;
  if (!primary) {
    return {
      primary: null,
      label: 'Sem jornada registrada',
      detail: 'Nenhuma jornada persistida para este usuario vinculado.',
    };
  }
  const name = primary.catalogName ?? 'Jornada preventiva';
  const statusLabel =
    primary.userJourney.completedAt !== null || primary.userJourney.status === 'concluida'
      ? 'Concluída'
      : 'Ativa';
  const progressLabel =
    primary.totalTrackedActivities > 0
      ? `${primary.completedActivityCount}/${primary.totalTrackedActivities} atividades concluidas`
      : 'Sem atividades registradas';
  return {
    primary,
    label: `${name} (${statusLabel})`,
    detail: progressLabel,
  };
}
