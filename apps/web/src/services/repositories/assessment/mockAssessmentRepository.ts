import { generateId } from '@/shared/lib/id';
import { readSessionItem, writeSessionItem } from '@/shared/lib/sessionStorage';
import { fail, ok } from '@/services/repositories/assessment/errors';
import type {
  AssessmentContext,
  AssessmentOption,
  AssessmentQuestion,
  AssessmentRecord,
  AssessmentResponseRecord,
  AssessmentResult,
  AssessmentVersion,
  RiskResultRecord,
} from '@/services/repositories/assessment/types';
import type {
  AssessmentRepository,
  CreateAssessmentInput,
  MarkAssessmentStatusInput,
  ResolveAssessmentCatalogByVersionInput,
  ResolveAssessmentCatalogInput,
  UpsertAssessmentResponseInput,
  UpsertRiskResultInput,
} from '@/services/repositories/assessment/contracts';

const STORAGE_KEY = 'biomed_mock_assessment_runtime_v1';
const VERSION_CODE = 'initial_preventive_assessment';

type PersistedState = {
  versions: AssessmentVersion[];
  questions: AssessmentQuestion[];
  options: AssessmentOption[];
  assessments: AssessmentRecord[];
  responses: AssessmentResponseRecord[];
  riskResults: RiskResultRecord[];
};

const SEED_VERSION_ID = 'ass-ver-org1-v1';
const SEED_QUESTIONS: AssessmentQuestion[] = [
  buildQuestion('aq-1', 'contexto', 1, 'Interesse principal na jornada preventiva'),
  buildQuestion('aq-2', 'contexto', 2, 'Tempo sentado por dia'),
  buildQuestion('aq-3', 'sono', 1, 'Horas medias de sono'),
  buildQuestion('aq-4', 'sono', 2, 'Qualidade percebida do sono'),
  buildQuestion('aq-5', 'movimento', 1, 'Dias de atividade fisica por semana'),
  buildQuestion('aq-6', 'movimento', 2, 'Hidratacao percebida'),
  buildQuestion('aq-7', 'bem_estar', 1, 'Nivel de estresse (0 a 10)'),
  buildQuestion('aq-8', 'bem_estar', 2, 'Disposicao durante o dia (0 a 10)'),
  buildQuestion('aq-9', 'consentimento', 1, 'Aceite do consentimento preventivo'),
];

const SEED_OPTIONS: AssessmentOption[] = [
  buildOption('ao-1', 'aq-1', 'Organizar rotina', 'rotina'),
  buildOption('ao-2', 'aq-1', 'Melhorar sono', 'sono'),
  buildOption('ao-3', 'aq-1', 'Aumentar movimento', 'movimento'),
  buildOption('ao-4', 'aq-1', 'Reduzir estresse', 'estresse'),
  buildOption('ao-5', 'aq-4', 'Baixa', 'baixa'),
  buildOption('ao-6', 'aq-4', 'Regular', 'regular'),
  buildOption('ao-7', 'aq-4', 'Boa', 'boa'),
  buildOption('ao-8', 'aq-6', 'Baixa', 'baixa'),
  buildOption('ao-9', 'aq-6', 'Moderada', 'moderada'),
  buildOption('ao-10', 'aq-6', 'Adequada', 'adequada'),
  buildOption('ao-11', 'aq-9', 'Aceito', 'true'),
  buildOption('ao-12', 'aq-9', 'Nao aceito', 'false'),
];

function defaultState(): PersistedState {
  return {
    versions: [
      {
        id: SEED_VERSION_ID,
        organizationId: 'org-1',
        code: VERSION_CODE,
        title: 'Avaliacao preventiva inicial v1',
        status: 'ativo',
        version: 1,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'ass-ver-org1-v2',
        organizationId: 'org-1',
        code: VERSION_CODE,
        title: 'Avaliacao preventiva inicial v2 (futura)',
        status: 'futuro',
        version: 2,
        createdAt: '2026-08-15T00:00:00.000Z',
        updatedAt: '2026-08-15T00:00:00.000Z',
      },
    ],
    questions: SEED_QUESTIONS,
    options: SEED_OPTIONS,
    assessments: [],
    responses: [],
    riskResults: [],
  };
}

export function createMockAssessmentRepository(
  input: {
    now?: () => Date;
    seed?: Partial<PersistedState>;
  } = {}
): AssessmentRepository {
  const now = input.now ?? (() => new Date());
  const seeded = input.seed;

  return {
    resolveAssessmentCatalog(data: ResolveAssessmentCatalogInput) {
      const contextValidation = validateContext(data.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const state = readState(seeded);
      const candidates = state.versions
        .filter(
          (version) =>
            version.organizationId === data.context.organizationId &&
            version.code === data.versionCode
        )
        .sort((a, b) => compareVersionRecency(a, b));
      if (candidates.length === 0) return Promise.resolve(fail('VERSION_NOT_FOUND'));

      const chosen = candidates.find((version) => version.status === 'ativo');
      if (!chosen) return Promise.resolve(fail('VERSION_INELIGIBLE'));

      const questions = state.questions.filter(
        (question) =>
          question.organizationId === data.context.organizationId &&
          question.assessmentVersionId === chosen.id &&
          question.status === 'ativo'
      );
      if (questions.length === 0) return Promise.resolve(fail('VERSION_INCOMPATIBLE'));

      const options = state.options.filter(
        (option) =>
          option.organizationId === data.context.organizationId &&
          option.status === 'ativo' &&
          questions.some((question) => question.id === option.assessmentQuestionId)
      );

      return Promise.resolve(
        ok({
          version: chosen,
          questions,
          options,
        })
      );
    },

    resolveAssessmentCatalogByVersion(data: ResolveAssessmentCatalogByVersionInput) {
      const contextValidation = validateContext(data.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const state = readState(seeded);
      const version = state.versions.find(
        (item) =>
          item.id === data.assessmentVersionId &&
          item.organizationId === data.context.organizationId
      );
      if (!version) return Promise.resolve(fail('VERSION_NOT_FOUND'));

      const questions = state.questions.filter(
        (question) =>
          question.organizationId === data.context.organizationId &&
          question.assessmentVersionId === version.id
      );
      if (questions.length === 0) return Promise.resolve(fail('VERSION_INCOMPATIBLE'));
      const questionIds = new Set(questions.map((item) => item.id));
      const options = state.options.filter(
        (option) =>
          option.organizationId === data.context.organizationId &&
          questionIds.has(option.assessmentQuestionId)
      );
      return Promise.resolve(ok({ version, questions, options }));
    },

    getLatestAssessmentState(context: AssessmentContext) {
      const contextValidation = validateContext(context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const state = readState(seeded);
      const assessment = state.assessments
        .filter(
          (item) =>
            item.organizationId === context.organizationId &&
            item.userId === context.userId
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (!assessment) return Promise.resolve(ok(null));

      const responses = state.responses
        .filter(
          (item) =>
            item.organizationId === context.organizationId &&
            item.assessmentId === assessment.id
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const riskResult =
        state.riskResults
          .filter(
            (item) =>
              item.organizationId === context.organizationId &&
              item.assessmentId === assessment.id
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      return Promise.resolve(ok({ assessment, responses, riskResult }));
    },

    createAssessment(inputData: CreateAssessmentInput) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const state = readState(seeded);
      const version = state.versions.find(
        (item) =>
          item.id === inputData.assessmentVersionId &&
          item.organizationId === inputData.context.organizationId
      );
      if (!version) return Promise.resolve(fail('VERSION_NOT_FOUND'));
      if (version.status !== 'ativo') return Promise.resolve(fail('VERSION_INELIGIBLE'));

      const existing = state.assessments
        .filter(
          (item) =>
            item.organizationId === inputData.context.organizationId &&
            item.userId === inputData.context.userId &&
            item.assessmentVersionId === inputData.assessmentVersionId &&
            item.status === 'em_andamento'
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (existing) return Promise.resolve(ok(existing));

      const timestamp = now().toISOString();
      const record: AssessmentRecord = {
        id: generateId(),
        organizationId: inputData.context.organizationId,
        userId: inputData.context.userId as string,
        assessmentVersionId: inputData.assessmentVersionId,
        status: inputData.status,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      state.assessments.push(record);
      writeState(state);
      return Promise.resolve(ok(record));
    },

    upsertAssessmentResponse(inputData: UpsertAssessmentResponseInput) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const state = readState(seeded);
      const assessment = state.assessments.find(
        (item) =>
          item.id === inputData.assessmentId &&
          item.organizationId === inputData.context.organizationId &&
          item.userId === inputData.context.userId
      );
      if (!assessment) return Promise.resolve(fail('ASSESSMENT_NOT_FOUND'));
      if (assessment.status === 'concluida') return Promise.resolve(fail('ASSESSMENT_ALREADY_COMPLETED'));
      if (assessment.assessmentVersionId !== inputData.assessmentVersionId) {
        return Promise.resolve(fail('VERSION_INCOMPATIBLE'));
      }

      const question = state.questions.find(
        (item) =>
          item.id === inputData.assessmentQuestionId &&
          item.organizationId === inputData.context.organizationId
      );
      if (!question) return Promise.resolve(fail('QUESTION_NOT_IN_VERSION'));
      if (question.assessmentVersionId !== assessment.assessmentVersionId) {
        return Promise.resolve(fail('QUESTION_NOT_IN_VERSION'));
      }

      const options = state.options.filter(
        (item) => item.assessmentQuestionId === question.id && item.status === 'ativo'
      );
      if (options.length > 0 && inputData.answerValue !== null) {
        if (!options.some((item) => item.value === inputData.answerValue)) {
          return Promise.resolve(fail('OPTION_NOT_ALLOWED'));
        }
      }

      const current = state.responses.find(
        (item) =>
          item.organizationId === inputData.context.organizationId &&
          item.assessmentId === inputData.assessmentId &&
          item.assessmentQuestionId === inputData.assessmentQuestionId
      );

      const timestamp = now().toISOString();
      if (!current) {
        const created: AssessmentResponseRecord = {
          id: generateId(),
          organizationId: inputData.context.organizationId,
          assessmentId: inputData.assessmentId,
          assessmentQuestionId: inputData.assessmentQuestionId,
          answerText: inputData.answerText,
          answerValue: inputData.answerValue,
          status: 'ativo',
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        state.responses.push(created);
        assessment.updatedAt = timestamp;
        writeState(state);
        return Promise.resolve(ok(created));
      }

      const updated: AssessmentResponseRecord = {
        ...current,
        answerText: inputData.answerText,
        answerValue: inputData.answerValue,
        version: current.version + 1,
        updatedAt: timestamp,
      };
      state.responses = state.responses.map((item) =>
        item.id === current.id ? updated : item
      );
      assessment.updatedAt = timestamp;
      writeState(state);
      return Promise.resolve(ok(updated));
    },

    markAssessmentStatus(inputData: MarkAssessmentStatusInput) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const state = readState(seeded);
      const assessment = state.assessments.find(
        (item) =>
          item.id === inputData.assessmentId &&
          item.organizationId === inputData.context.organizationId &&
          item.userId === inputData.context.userId
      );
      if (!assessment) return Promise.resolve(fail('ASSESSMENT_NOT_FOUND'));
      if (assessment.status === 'concluida' && inputData.status === 'concluida') {
        return Promise.resolve(ok(assessment));
      }
      if (assessment.status === 'concluida') {
        return Promise.resolve(fail('ASSESSMENT_ALREADY_COMPLETED'));
      }

      const updated: AssessmentRecord = {
        ...assessment,
        status: inputData.status,
        version: assessment.version + 1,
        updatedAt: now().toISOString(),
      };
      state.assessments = state.assessments.map((item) =>
        item.id === assessment.id ? updated : item
      );
      writeState(state);
      return Promise.resolve(ok(updated));
    },

    upsertRiskResult(inputData: UpsertRiskResultInput) {
      const contextValidation = validateContext(inputData.context);
      if (!contextValidation.ok) return Promise.resolve(contextValidation);

      const state = readState(seeded);
      const assessment = state.assessments.find(
        (item) =>
          item.id === inputData.assessmentId &&
          item.organizationId === inputData.context.organizationId &&
          item.userId === inputData.context.userId
      );
      if (!assessment) return Promise.resolve(fail('ASSESSMENT_NOT_FOUND'));

      const current = state.riskResults.find(
        (item) =>
          item.organizationId === inputData.context.organizationId &&
          item.assessmentId === inputData.assessmentId
      );
      const timestamp = now().toISOString();

      if (!current) {
        const created: RiskResultRecord = {
          id: generateId(),
          organizationId: inputData.context.organizationId,
          assessmentId: inputData.assessmentId,
          level: inputData.level,
          message: inputData.message,
          explainability: inputData.explainability,
          status: 'ativo',
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        state.riskResults.push(created);
        writeState(state);
        return Promise.resolve(ok(created));
      }

      const updated: RiskResultRecord = {
        ...current,
        level: inputData.level,
        message: inputData.message,
        explainability: inputData.explainability,
        version: current.version + 1,
        updatedAt: timestamp,
      };
      state.riskResults = state.riskResults.map((item) =>
        item.id === current.id ? updated : item
      );
      writeState(state);
      return Promise.resolve(ok(updated));
    },
  };
}

function validateContext(context: AssessmentContext): AssessmentResult<true> {
  if (!context.sessionUserId || !context.userId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.userId) return fail('IDENTITY_MISMATCH');
  return ok(true);
}

function readState(seed?: Partial<PersistedState>): PersistedState {
  const raw = readSessionItem(STORAGE_KEY);
  if (!raw) return applySeed(defaultState(), seed);
  try {
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== 'object') return applySeed(defaultState(), seed);
    return applySeed(parsed, seed);
  } catch {
    return applySeed(defaultState(), seed);
  }
}

function applySeed(
  base: PersistedState,
  seed?: Partial<PersistedState>
): PersistedState {
  if (!seed) return base;
  return {
    versions: seed.versions ?? base.versions,
    questions: seed.questions ?? base.questions,
    options: seed.options ?? base.options,
    assessments: seed.assessments ?? base.assessments,
    responses: seed.responses ?? base.responses,
    riskResults: seed.riskResults ?? base.riskResults,
  };
}

function writeState(state: PersistedState) {
  writeSessionItem(STORAGE_KEY, JSON.stringify(state));
}

function buildQuestion(
  id: string,
  domain: string,
  questionOrder: number,
  prompt: string
): AssessmentQuestion {
  return {
    id,
    organizationId: 'org-1',
    assessmentVersionId: SEED_VERSION_ID,
    domain,
    prompt,
    questionOrder,
    status: 'ativo',
    version: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function buildOption(
  id: string,
  assessmentQuestionId: string,
  label: string,
  value: string
): AssessmentOption {
  return {
    id,
    organizationId: 'org-1',
    assessmentQuestionId,
    label,
    value,
    score: null,
    status: 'ativo',
    version: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function compareVersionRecency(a: AssessmentVersion, b: AssessmentVersion): number {
  if (a.version !== b.version) return b.version - a.version;
  return b.updatedAt.localeCompare(a.updatedAt);
}
