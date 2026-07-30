import { beforeEach, describe, expect, it } from 'vitest';
import {
  completeAssessment,
  loadAssessmentRuntimeSnapshot,
  persistAssessmentDraft,
} from '@/domains/assessment/assessmentService';
import type {
  AssessmentContext,
  AssessmentVersion,
} from '@/services/repositories/assessment/types';
import { createMockAssessmentRepository } from '@/services/repositories/assessment/mockAssessmentRepository';
import type { AssessmentRepository } from '@/services/repositories/assessment/contracts';

function context(overrides: Partial<AssessmentContext> = {}): AssessmentContext {
  return {
    sessionUserId: 'usr-1',
    userId: 'usr-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('assessmentService', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('resolve a versao operacional ativa mais recente', async () => {
    const repository = createMockAssessmentRepository({
      seed: {
        versions: [
          version('v1', 'ativo', 1),
          version('v2', 'ativo', 2),
          version('v3', 'futuro', 3),
        ],
        questions: makeQuestionsForVersion('v2'),
        options: makeOptionsForVersion('v2'),
      },
    });
    const loaded = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.catalog.version.id).toBe('v2');
  });

  it('cria avaliacao, persiste respostas minimizadas e conclui com risco orientativo', async () => {
    const repository = createMockAssessmentRepository();
    const loaded = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const persisted = await persistAssessmentDraft(repository, context(), loaded.data, {
      ...loaded.data.draft,
      preventiveInterest: 'sono',
      sittingHours: 8,
      sleepHours: 6,
      sleepQuality: 'regular',
      activityDays: 2,
      hydration: 'adequada',
      stressLevel: 5,
      energyLevel: 7,
      consentAccepted: true,
    });
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    expect(persisted.data.assessment).not.toBeNull();
    expect(persisted.data.responses).toHaveLength(9);
    expect(persisted.data.responses.every((item) => item.answerText === null)).toBe(true);

    const completed = await completeAssessment(
      repository,
      context(),
      persisted.data,
      persisted.data.draft
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.data.completed).toBe(true);
    expect(completed.data.persistedRiskResult).not.toBeNull();
    expect(completed.data.orientativeResult).not.toBeNull();
  });

  it('nao persiste respostas de etapas futuras durante salvamento parcial', async () => {
    const repository = createMockAssessmentRepository();
    const loaded = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const partial = await persistAssessmentDraft(
      repository,
      context(),
      loaded.data,
      {
        ...loaded.data.draft,
        preventiveInterest: 'estresse',
        sittingHours: 6,
      },
      { fields: ['preventiveInterest', 'sittingHours'] }
    );
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.data.responses).toHaveLength(2);
    const responseQuestionIds = new Set(partial.data.responses.map((item) => item.assessmentQuestionId));
    expect(responseQuestionIds.size).toBe(2);
  });

  it('retoma avaliacao incompleta sem criar duplicidade local', async () => {
    const repository = createMockAssessmentRepository();
    const loaded = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const firstPersist = await persistAssessmentDraft(repository, context(), loaded.data, {
      ...loaded.data.draft,
      consentAccepted: true,
    });
    expect(firstPersist.ok).toBe(true);
    if (!firstPersist.ok) return;

    const resumed = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.data.assessment?.id).toBe(firstPersist.data.assessment?.id);
    expect(resumed.data.completed).toBe(false);
  });

  it('rejeita contexto cross-user e versao ineligivel', async () => {
    const repository = createMockAssessmentRepository({
      seed: {
        versions: [version('v3', 'futuro', 3)],
      },
    });
    const denied = await loadAssessmentRuntimeSnapshot(
      repository,
      context({ sessionUserId: 'usr-1', userId: 'usr-2' })
    );
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('IDENTITY_MISMATCH');

    const noEligible = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(noEligible.ok).toBe(false);
    if (noEligible.ok) return;
    expect(noEligible.error.code).toBe('VERSION_INELIGIBLE');
  });

  it('preserva versao historica apos conclusao mesmo com nova versao elegivel', async () => {
    const repositoryV1 = createMockAssessmentRepository({
      seed: {
        versions: [version('v1', 'ativo', 1)],
        questions: makeQuestionsForVersion('v1'),
        options: makeOptionsForVersion('v1'),
      },
    });
    const loaded = await loadAssessmentRuntimeSnapshot(repositoryV1, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const completed = await completeAssessment(repositoryV1, context(), loaded.data, {
      ...loaded.data.draft,
      consentAccepted: true,
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.data.assessment?.assessmentVersionId).toBe('v1');

    const repositoryWithNewVersion = createMockAssessmentRepository({
      seed: {
        versions: [version('v1', 'ativo', 1), version('v2', 'ativo', 2)],
        questions: makeQuestionsForVersion('v1'),
        options: makeOptionsForVersion('v1'),
      },
    });
    const restored = await loadAssessmentRuntimeSnapshot(repositoryWithNewVersion, context());
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.data.assessment?.assessmentVersionId).toBe('v1');
    expect(restored.data.catalog.version.id).toBe('v1');
    expect(restored.data.completed).toBe(true);
    expect(restored.data.orientativeResult?.message).toBe(completed.data.orientativeResult?.message);
  });

  it('falha explicitamente quando mapeamento domain + question_order e ambiguo', async () => {
    const repository = createMockAssessmentRepository({
      seed: {
        versions: [version('v1', 'ativo', 1)],
        questions: [
          ...makeQuestionsForVersion('v1'),
          question('q-duplicada', 'v1', 'sono', 2),
        ],
        options: makeOptionsForVersion('v1'),
      },
    });
    const loaded = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('VERSION_INCOMPATIBLE');
  });

  it('rejeita resposta vinculada a pergunta de outra versao', async () => {
    const repository = createMockAssessmentRepository({
      seed: {
        versions: [version('v1', 'ativo', 1), version('v2', 'inativo', 2)],
        questions: [
          ...makeQuestionsForVersion('v1'),
          ...makeQuestionsForVersion('v2').map((item, index) => ({
            ...item,
            id: `v2-q-${index + 1}`,
          })),
        ],
        options: makeOptionsForVersion('v1'),
      },
    });
    const loaded = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const persisted = await persistAssessmentDraft(repository, context(), loaded.data, {
      ...loaded.data.draft,
      consentAccepted: true,
    });
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;

    const response = await repository.upsertAssessmentResponse({
      context: context(),
      assessmentId: persisted.data.assessment?.id ?? '',
      assessmentVersionId: 'v1',
      assessmentQuestionId: 'v2-q-1',
      answerText: null,
      answerValue: 'rotina',
    });
    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.error.code).toBe('QUESTION_NOT_IN_VERSION');
  });

  it('rejeita opcao que nao pertence a pergunta correspondente', async () => {
    const repository = createMockAssessmentRepository();
    const loaded = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const persisted = await persistAssessmentDraft(repository, context(), loaded.data, {
      ...loaded.data.draft,
      consentAccepted: true,
    });
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;

    const result = await repository.upsertAssessmentResponse({
      context: context(),
      assessmentId: persisted.data.assessment?.id ?? '',
      assessmentVersionId: persisted.data.catalog.version.id,
      assessmentQuestionId: 'aq-4',
      answerText: null,
      answerValue: 'rotina',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('OPTION_NOT_ALLOWED');
  });

  it('nao permite concluir novamente avaliacao ja concluida', async () => {
    const repository = createMockAssessmentRepository();
    const loaded = await loadAssessmentRuntimeSnapshot(repository, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const first = await completeAssessment(repository, context(), loaded.data, {
      ...loaded.data.draft,
      consentAccepted: true,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await completeAssessment(repository, context(), first.data, first.data.draft);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('ASSESSMENT_ALREADY_COMPLETED');
  });

  it('em falha parcial de conclusao, nao marca como concluida e permite retomada coerente', async () => {
    const baseRepository = createMockAssessmentRepository();
    const wrapped: AssessmentRepository = {
      ...baseRepository,
      markAssessmentStatus() {
        return Promise.resolve({
          ok: false as const,
          error: { code: 'TECHNICAL_ERROR', kind: 'technical', message: 'x', transient: true },
        });
      },
    };

    const loaded = await loadAssessmentRuntimeSnapshot(wrapped, context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const completion = await completeAssessment(wrapped, context(), loaded.data, {
      ...loaded.data.draft,
      consentAccepted: true,
    });
    expect(completion.ok).toBe(false);
    if (completion.ok) return;
    expect(completion.error.code).toBe('TECHNICAL_ERROR');

    const resumed = await loadAssessmentRuntimeSnapshot(baseRepository, context());
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.data.completed).toBe(false);
    expect(resumed.data.persistedRiskResult).not.toBeNull();
  });
});

function version(id: string, status: string, schemaVersion: number): AssessmentVersion {
  return {
    id,
    organizationId: 'org-1',
    code: 'initial_preventive_assessment',
    title: `Avaliacao ${id}`,
    status,
    version: schemaVersion,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function makeQuestionsForVersion(versionId: string) {
  return [
    question('q1', versionId, 'contexto', 1),
    question('q2', versionId, 'contexto', 2),
    question('q3', versionId, 'sono', 1),
    question('q4', versionId, 'sono', 2),
    question('q5', versionId, 'movimento', 1),
    question('q6', versionId, 'movimento', 2),
    question('q7', versionId, 'bem_estar', 1),
    question('q8', versionId, 'bem_estar', 2),
    question('q9', versionId, 'consentimento', 1),
  ];
}

function question(id: string, versionId: string, domain: string, order: number) {
  return {
    id,
    organizationId: 'org-1',
    assessmentVersionId: versionId,
    domain,
    prompt: id,
    questionOrder: order,
    status: 'ativo',
    version: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function makeOptionsForVersion(versionId: string) {
  const allQuestions = makeQuestionsForVersion(versionId);
  const q1 = allQuestions.find((item) => item.id === 'q1')?.id ?? 'q1';
  const q4 = allQuestions.find((item) => item.id === 'q4')?.id ?? 'q4';
  const q6 = allQuestions.find((item) => item.id === 'q6')?.id ?? 'q6';
  const q9 = allQuestions.find((item) => item.id === 'q9')?.id ?? 'q9';
  return [
    option('o1', q1, 'rotina'),
    option('o2', q1, 'sono'),
    option('o3', q1, 'movimento'),
    option('o4', q1, 'estresse'),
    option('o5', q4, 'baixa'),
    option('o6', q4, 'regular'),
    option('o7', q4, 'boa'),
    option('o8', q6, 'baixa'),
    option('o9', q6, 'moderada'),
    option('o10', q6, 'adequada'),
    option('o11', q9, 'true'),
    option('o12', q9, 'false'),
  ];
}

function option(id: string, questionId: string, value: string) {
  return {
    id,
    organizationId: 'org-1',
    assessmentQuestionId: questionId,
    label: value,
    value,
    score: null,
    status: 'ativo',
    version: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}
