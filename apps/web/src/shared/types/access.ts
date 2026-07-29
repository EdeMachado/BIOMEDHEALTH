export type Role =
  | 'usuario'
  | 'medico'
  | 'profissional_saude'
  | 'gestor_clinico'
  | 'gestor_institucional'
  | 'sst'
  | 'admin_cliente'
  | 'admin_biomed'
  | 'auditor';

export type ProductArea = 'minha-biomed' | 'biomed-clinica' | 'biomed-gestao';

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  role: Role;
  roles: Role[];
  organizationId: string;
};

export type Organization = {
  id: string;
  nome: string;
};

export type DemoAssessmentAnswer = {
  sleepHours: number;
  activityDays: number;
  stressLevel: number;
};

export type RiskResult = {
  level: 'baixo' | 'moderado' | 'atencao';
  message: string;
  rationale: string[];
};
