import { evaluatePreventiveRisk } from '@/domains/risk/riskEngine';
import {
  assessmentCompletionSchema,
  assessmentFormDefaultValues,
  assessmentFormSchema,
  assessmentStepFields,
  type AssessmentFormData,
} from '@/domains/assessment/formSchema';
import { fail, ok } from '@/services/repositories/assessment/errors';
import type { AssessmentRepository } from '@/services/repositories/assessment/contracts';
import type {
  AssessmentCatalog,
  AssessmentContext,
  AssessmentQuestion,
  AssessmentResponseRecord,
  AssessmentResult,
  AssessmentState,
  RiskResultRecord,
} from '@/services/repositories/assessment/types';

export const ASSESSMENT_VERSION_CODE = 'initial_preventive_assessment';

type QuestionSemanticKey =
  | 'preventiveInterest'
  | 'sittingHours'
  | 'sleepHours'
  | 'sleepQuality'
  | 'activityDays'
  | 'hydration'
  | 'stressLevel'
  | 'energyLevel'
  | 'consentAccepted';

type SemanticQuestionBlueprint = {
  key: QuestionSemanticKey;
  domain: string;
  order: number;
  valueType: 'number' | 'enum' | 'boolean';
};

type QuestionBinding = Record<QuestionSemanticKey, AssessmentQuestion>;

const BLUEPRINT: SemanticQuestionBlueprint[] = [
  { key: 'preventiveInterest', domain: 'contexto', order: 1, valueType: 'enum' },
  { key: 'sittingHours', domain: 'contexto', order: 2, valueType: 'number' },
  { key: 'sleepHours', domain: 'sono', order: 1, valueType: 'number' },
  { key: 'sleepQuality', domain: 'sono', order: 2, valueType: 'enum' },
  { key: 'activityDays', domain: 'movimento', order: 1, valueType: 'number' },
  { key: 'hydration', domain: 'movimento', order: 2, valueType: 'enum' },
  { key: 'stressLevel', domain: 'bem_estar', order: 1, valueType: 'number' },
  { key: 'energyLevel', domain: 'bem_estar', order: 2, valueType: 'number' },
  { key: 'consentAccepted', domain: 'consentimento', order: 1, valueType: 'boolean' },
];

const FORM_KEYS = BLUEPRINT.map((item) => item.key);
const CONTEXT_LOCKS = new Map<string, Promise<unknown>>();

export type AssessmentRuntimeSnapshot = {
  catalog: AssessmentCatalog;
  bindings: QuestionBinding;
  assessment: AssessmentState['assessment'] | null;
  responses: AssessmentResponseRecord[];
  draft: AssessmentFormData;
  step: number;
  completed: boolean;
  persistedRiskResult: RiskResultRecord | null;
  orientativeResult: ReturnType<typeof evaluatePreventiveRisk> | null;
};

type PersistDraftOptions = {
  fields?: Array<keyof AssessmentFormData>;
};

export async function loadAssessmentRuntimeSnapshot(
  repository: AssessmentRepository,
  context: AssessmentContext
): Promise<AssessmentResult<AssessmentRuntimeSnapshot>> {
  const latest = await repository.getLatestAssessmentState(context);
  if (!latest.ok) return latest;

  if (latest.data) {
    const boundCatalog = await repository.resolveAssessmentCatalogByVersion({
      context,
      assessmentVersionId: latest.data.assessment.assessmentVersionId,
    });
    if (!boundCatalog.ok) return boundCatalog;

    const bound = bindQuestions(boundCatalog.data);
    if (!bound.ok) return bound;
    const draft = restoreDraftFromResponses(latest.data.responses, bound.data.bindings);
    const completed = latest.data.assessment.status === 'concluida';
    const persistedOrientative = latest.data.riskResult
      ? mapPersistedRiskResultToOrientative(latest.data.riskResult)
      : null;
    return ok({
      catalog: boundCatalog.data,
      bindings: bound.data.bindings,
      assessment: latest.data.assessment,
      responses: latest.data.responses,
      draft,
      step: resolveStepFromDraft(draft, completed),
      completed,
      persistedRiskResult: latest.data.riskResult,
      orientativeResult:
        completed
          ? (persistedOrientative ?? evaluatePreventiveRisk(extractRiskInput(draft)))
          : null,
    });
  }

  const operationalCatalog = await repository.resolveAssessmentCatalog({
    context,
    versionCode: ASSESSMENT_VERSION_CODE,
  });
  if (!operationalCatalog.ok) return operationalCatalog;
  const bound = bindQuestions(operationalCatalog.data);
  if (!bound.ok) return bound;
  return ok({
    catalog: operationalCatalog.data,
    bindings: bound.data.bindings,
    assessment: null,
    responses: [],
    draft: { ...assessmentFormDefaultValues },
    step: 0,
    completed: false,
    persistedRiskResult: null,
    orientativeResult: null,
  });
}

export async function persistAssessmentDraft(
  repository: AssessmentRepository,
  context: AssessmentContext,
  runtime: AssessmentRuntimeSnapshot,
  draft: AssessmentFormData,
  options: PersistDraftOptions = {}
): Promise<AssessmentResult<AssessmentRuntimeSnapshot>> {
  return runLockedByContext(context, () =>
    persistAssessmentDraftUnlocked(repository, context, runtime, draft, options)
  );
}

export async function completeAssessment(
  repository: AssessmentRepository,
  context: AssessmentContext,
  runtime: AssessmentRuntimeSnapshot,
  draft: AssessmentFormData
): Promise<AssessmentResult<AssessmentRuntimeSnapshot>> {
  return runLockedByContext(context, async () => {
    if (runtime.completed) return fail('ASSESSMENT_ALREADY_COMPLETED');
    const parsed = assessmentCompletionSchema.safeParse(draft);
    if (!parsed.success) return fail('INVALID_ANSWER_PAYLOAD');

    const draftPersisted = await persistAssessmentDraftUnlocked(
      repository,
      context,
      runtime,
      parsed.data
    );
    if (!draftPersisted.ok) return draftPersisted;
    if (!draftPersisted.data.assessment) return fail('ASSESSMENT_NOT_FOUND');

    const orientativeResult = evaluatePreventiveRisk(extractRiskInput(parsed.data));
    const explainability = JSON.stringify({
      rationale: orientativeResult.rationale,
      source: 'domains/risk/riskEngine',
      orientationOnly: true,
    });
    const riskStored = await repository.upsertRiskResult({
      context,
      assessmentId: draftPersisted.data.assessment.id,
      level: orientativeResult.level,
      message: orientativeResult.message,
      explainability,
    });
    if (!riskStored.ok) return riskStored;

    const statusChanged = await repository.markAssessmentStatus({
      context,
      assessmentId: draftPersisted.data.assessment.id,
      status: 'concluida',
    });
    if (!statusChanged.ok) return statusChanged;

    const refreshed = await repository.getLatestAssessmentState(context);
    if (!refreshed.ok) return refreshed;
    if (!refreshed.data) return fail('ASSESSMENT_NOT_FOUND');

    return ok({
      ...draftPersisted.data,
      assessment: statusChanged.data,
      responses: refreshed.data.responses,
      draft: parsed.data,
      step: assessmentStepFields.length - 1,
      completed: true,
      persistedRiskResult: refreshed.data.riskResult,
      orientativeResult,
    });
  });
}

async function persistAssessmentDraftUnlocked(
  repository: AssessmentRepository,
  context: AssessmentContext,
  runtime: AssessmentRuntimeSnapshot,
  draft: AssessmentFormData,
  options: PersistDraftOptions = {}
): Promise<AssessmentResult<AssessmentRuntimeSnapshot>> {
  if (runtime.completed) return fail('ASSESSMENT_ALREADY_COMPLETED');
  const parsed = assessmentFormSchema.safeParse(draft);
  if (!parsed.success) return fail('INVALID_ANSWER_PAYLOAD');
  const payloadValidation = validateDraftAgainstCatalog(parsed.data, runtime.catalog, runtime.bindings);
  if (!payloadValidation.ok) return payloadValidation;

  const ensured = await ensureAssessment(repository, context, runtime);
  if (!ensured.ok) return ensured;
  if (!ensured.data.assessment) return fail('ASSESSMENT_NOT_FOUND');

  const keysToPersist = options.fields ?? FORM_KEYS;
  for (const entry of normalizeDraft(ensured.data.bindings, parsed.data, keysToPersist)) {
    const persisted = await repository.upsertAssessmentResponse({
      context,
      assessmentId: ensured.data.assessment.id,
      assessmentVersionId: ensured.data.catalog.version.id,
      assessmentQuestionId: entry.questionId,
      answerText: null,
      answerValue: entry.answerValue,
    });
    if (!persisted.ok) return persisted;
  }

  const refreshed = await repository.getLatestAssessmentState(context);
  if (!refreshed.ok) return refreshed;
  if (!refreshed.data) return fail('ASSESSMENT_NOT_FOUND');
  return ok({
    ...ensured.data,
    assessment: refreshed.data.assessment,
    responses: refreshed.data.responses,
    draft: parsed.data,
    step: resolveStepFromDraft(parsed.data, false),
    completed: false,
    persistedRiskResult: refreshed.data.riskResult,
    orientativeResult: null,
  });
}

function bindQuestions(catalog: AssessmentCatalog): AssessmentResult<{ bindings: QuestionBinding }> {
  const bindings = {} as QuestionBinding;
  for (const schema of BLUEPRINT) {
    const matches = catalog.questions.filter(
      (question) =>
        question.domain === schema.domain && question.questionOrder === schema.order
    );
    if (matches.length !== 1) {
      return fail('VERSION_INCOMPATIBLE', {
        details: `Mapeamento de pergunta nao deterministico para ${schema.key}.`,
      });
    }
    bindings[schema.key] = matches[0];
  }
  return ok({ bindings });
}

function restoreDraftFromResponses(
  responses: AssessmentResponseRecord[],
  bindings: QuestionBinding
): AssessmentFormData {
  const byQuestion = new Map<string, AssessmentResponseRecord>();
  for (const response of responses) {
    byQuestion.set(response.assessmentQuestionId, response);
  }
  const base: AssessmentFormData = { ...assessmentFormDefaultValues };
  for (const schema of BLUEPRINT) {
    const response = byQuestion.get(bindings[schema.key].id);
    if (!response || response.answerValue === null) continue;
    const parsed = parsePersistedValue(schema.valueType, response.answerValue);
    if (parsed !== null) {
      (base as Record<string, unknown>)[schema.key] = parsed;
    }
  }
  return base;
}

function parsePersistedValue(
  type: SemanticQuestionBlueprint['valueType'],
  value: string
): string | number | boolean | null {
  if (type === 'number') {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  if (type === 'boolean') return value === 'true';
  return value;
}

function normalizeDraft(
  bindings: QuestionBinding,
  draft: AssessmentFormData,
  keys: Array<keyof AssessmentFormData>
): Array<{ questionId: string; answerValue: string }> {
  const normalized: Array<{ questionId: string; answerValue: string }> = [];
  for (const key of keys) {
    const value = draft[key];
    const answerValue =
      typeof value === 'boolean' ? String(value) : typeof value === 'number' ? String(value) : value;
    normalized.push({
      questionId: bindings[key].id,
      answerValue,
    });
  }
  return normalized;
}

function validateDraftAgainstCatalog(
  draft: AssessmentFormData,
  catalog: AssessmentCatalog,
  bindings: QuestionBinding
): AssessmentResult<true> {
  const optionsByQuestion = new Map<string, Set<string>>();
  for (const option of catalog.options) {
    if (!optionsByQuestion.has(option.assessmentQuestionId)) {
      optionsByQuestion.set(option.assessmentQuestionId, new Set<string>());
    }
    optionsByQuestion.get(option.assessmentQuestionId)?.add(option.value);
  }

  for (const schema of BLUEPRINT) {
    const question = bindings[schema.key];
    if (question.assessmentVersionId !== catalog.version.id) {
      return fail('QUESTION_NOT_IN_VERSION');
    }
    if (schema.valueType === 'enum' || schema.valueType === 'boolean') {
      const optionSet = optionsByQuestion.get(question.id);
      if (!optionSet || optionSet.size === 0) return fail('VERSION_INCOMPATIBLE');
      const draftValue = String(draft[schema.key]);
      if (!optionSet.has(draftValue)) return fail('OPTION_NOT_ALLOWED');
    }
  }
  return ok(true);
}

async function ensureAssessment(
  repository: AssessmentRepository,
  context: AssessmentContext,
  runtime: AssessmentRuntimeSnapshot
): Promise<AssessmentResult<AssessmentRuntimeSnapshot>> {
  if (runtime.assessment) return ok(runtime);
  const created = await repository.createAssessment({
    context,
    assessmentVersionId: runtime.catalog.version.id,
    status: 'em_andamento',
  });
  if (!created.ok) return created;
  return ok({
    ...runtime,
    assessment: created.data,
  });
}

function resolveStepFromDraft(draft: AssessmentFormData, completed: boolean): number {
  if (completed) return assessmentStepFields.length - 1;
  for (let index = 0; index < assessmentStepFields.length; index += 1) {
    const keys = assessmentStepFields[index];
    const allFilled = keys.every((key) => {
      const value = draft[key];
      if (typeof value === 'boolean') return value === true;
      if (typeof value === 'number') return Number.isFinite(value);
      return typeof value === 'string' && value.length > 0;
    });
    if (!allFilled) return index;
  }
  return assessmentStepFields.length - 1;
}

function extractRiskInput(draft: AssessmentFormData) {
  return {
    sleepHours: draft.sleepHours,
    activityDays: draft.activityDays,
    stressLevel: draft.stressLevel,
  };
}

async function runLockedByContext<T>(
  context: AssessmentContext,
  task: () => Promise<T>
): Promise<T> {
  const key = `${context.organizationId}:${context.userId ?? 'anon'}`;
  const previous = CONTEXT_LOCKS.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(task);
  CONTEXT_LOCKS.set(key, pending);
  try {
    return await pending;
  } finally {
    if (CONTEXT_LOCKS.get(key) === pending) {
      CONTEXT_LOCKS.delete(key);
    }
  }
}

function mapPersistedRiskResultToOrientative(
  riskResult: RiskResultRecord
): ReturnType<typeof evaluatePreventiveRisk> | null {
  const payload = parseExplainabilityPayload(riskResult.explainability);
  if (!payload) return null;
  const level = normalizeRiskLevel(riskResult.level);
  if (!level) return null;
  return {
    level,
    message: riskResult.message,
    rationale: payload.rationale,
  };
}

function parseExplainabilityPayload(
  explainability: string
): { rationale: string[] } | null {
  try {
    const parsed = JSON.parse(explainability) as { rationale?: unknown };
    if (!Array.isArray(parsed.rationale)) return null;
    const sanitized = parsed.rationale.filter(
      (item): item is string => typeof item === 'string'
    );
    if (sanitized.length === 0) return null;
    return { rationale: sanitized };
  } catch {
    return null;
  }
}

function normalizeRiskLevel(
  value: string
): 'baixo' | 'moderado' | 'atencao' | null {
  if (value === 'baixo' || value === 'moderado' || value === 'atencao') return value;
  return null;
}
