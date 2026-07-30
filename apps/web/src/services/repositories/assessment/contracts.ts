import type {
  AssessmentCatalog,
  AssessmentContext,
  AssessmentResponseRecord,
  AssessmentResult,
  AssessmentState,
  RiskResultRecord,
} from '@/services/repositories/assessment/types';

export type ResolveAssessmentCatalogInput = {
  context: AssessmentContext;
  versionCode: string;
};

export type ResolveAssessmentCatalogByVersionInput = {
  context: AssessmentContext;
  assessmentVersionId: string;
};

export type CreateAssessmentInput = {
  context: AssessmentContext;
  assessmentVersionId: string;
  status: string;
};

export type UpsertAssessmentResponseInput = {
  context: AssessmentContext;
  assessmentId: string;
  assessmentVersionId: string;
  assessmentQuestionId: string;
  answerText: string | null;
  answerValue: string | null;
};

export type MarkAssessmentStatusInput = {
  context: AssessmentContext;
  assessmentId: string;
  status: string;
};

export type UpsertRiskResultInput = {
  context: AssessmentContext;
  assessmentId: string;
  level: string;
  message: string;
  explainability: string;
};

export interface AssessmentRepository {
  resolveAssessmentCatalog(input: ResolveAssessmentCatalogInput): Promise<AssessmentResult<AssessmentCatalog>>;
  resolveAssessmentCatalogByVersion(
    input: ResolveAssessmentCatalogByVersionInput
  ): Promise<AssessmentResult<AssessmentCatalog>>;
  getLatestAssessmentState(context: AssessmentContext): Promise<AssessmentResult<AssessmentState | null>>;
  createAssessment(input: CreateAssessmentInput): Promise<AssessmentResult<AssessmentState['assessment']>>;
  upsertAssessmentResponse(input: UpsertAssessmentResponseInput): Promise<AssessmentResult<AssessmentResponseRecord>>;
  markAssessmentStatus(input: MarkAssessmentStatusInput): Promise<AssessmentResult<AssessmentState['assessment']>>;
  upsertRiskResult(input: UpsertRiskResultInput): Promise<AssessmentResult<RiskResultRecord>>;
}
