export type AssessmentErrorCode =
  | 'NO_SESSION'
  | 'IDENTITY_MISMATCH'
  | 'CROSS_TENANT_DATA'
  | 'VERSION_NOT_FOUND'
  | 'VERSION_INELIGIBLE'
  | 'VERSION_INCOMPATIBLE'
  | 'ASSESSMENT_NOT_FOUND'
  | 'ASSESSMENT_ALREADY_COMPLETED'
  | 'INVALID_ANSWER_PAYLOAD'
  | 'QUESTION_NOT_IN_VERSION'
  | 'OPTION_NOT_ALLOWED'
  | 'TECHNICAL_ERROR';

export type AssessmentErrorKind =
  | 'authentication'
  | 'authorization'
  | 'consistency'
  | 'validation'
  | 'technical';

export type AssessmentErrorCause = {
  source: 'mock' | 'repository' | 'validation';
  code: string;
  message?: string;
};

export type AssessmentError = {
  code: AssessmentErrorCode;
  kind: AssessmentErrorKind;
  message: string;
  details?: string;
  cause?: AssessmentErrorCause;
  transient: boolean;
};

export type AssessmentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AssessmentError };

export type AssessmentContext = {
  sessionUserId: string | null;
  userId: string | null;
  organizationId: string;
};

export type AssessmentVersion = {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentQuestion = {
  id: string;
  organizationId: string;
  assessmentVersionId: string;
  domain: string;
  prompt: string;
  questionOrder: number;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentOption = {
  id: string;
  organizationId: string;
  assessmentQuestionId: string;
  label: string;
  value: string;
  score: number | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentRecord = {
  id: string;
  organizationId: string;
  userId: string;
  assessmentVersionId: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentResponseRecord = {
  id: string;
  organizationId: string;
  assessmentId: string;
  assessmentQuestionId: string;
  answerText: string | null;
  answerValue: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type RiskResultRecord = {
  id: string;
  organizationId: string;
  assessmentId: string;
  level: string;
  message: string;
  explainability: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentCatalog = {
  version: AssessmentVersion;
  questions: AssessmentQuestion[];
  options: AssessmentOption[];
};

export type AssessmentState = {
  assessment: AssessmentRecord;
  responses: AssessmentResponseRecord[];
  riskResult: RiskResultRecord | null;
};
