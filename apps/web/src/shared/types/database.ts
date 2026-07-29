export type BaseEntity = {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  status: string;
  version: number;
};

export type Organization = BaseEntity & {
  name: string;
};

export type Assessment = BaseEntity & {
  user_id: string;
  assessment_version_id: string;
};

export type RiskRule = BaseEntity & {
  rule_key: string;
  domain: string;
  condition_expression: string;
  result_label: string;
  rationale: string;
  priority: number;
  effective_at: string;
};

export type RiskResult = BaseEntity & {
  assessment_id: string;
  level: string;
  message: string;
  explainability: string;
};
