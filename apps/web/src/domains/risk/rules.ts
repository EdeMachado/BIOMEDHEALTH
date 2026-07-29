import type { DemoAssessmentAnswer } from '@/shared/types/access';

export type RuleDefinition = {
  id: string;
  version: number;
  domain: string;
  condition: (answers: DemoAssessmentAnswer) => boolean;
  result: string;
  justification: string;
  priority: number;
  status: 'ativo' | 'inativo';
  effectiveAt: string;
};

export const demoRiskRules: RuleDefinition[] = [
  {
    id: 'rule-sono-001',
    version: 1,
    domain: 'sono',
    condition: (a) => a.sleepHours < 6,
    result: 'atencao_habitos_sono',
    justification: 'Menos de 6 horas de sono sugere necessidade de atencao a rotina de descanso.',
    priority: 90,
    status: 'ativo',
    effectiveAt: '2026-07-01',
  },
  {
    id: 'rule-atividade-001',
    version: 1,
    domain: 'atividade_fisica',
    condition: (a) => a.activityDays <= 1,
    result: 'oportunidade_movimento',
    justification: 'Baixa frequencia de atividade indica oportunidade de cuidado preventivo.',
    priority: 80,
    status: 'ativo',
    effectiveAt: '2026-07-01',
  },
  {
    id: 'rule-bemestar-001',
    version: 1,
    domain: 'bem_estar',
    condition: (a) => a.stressLevel >= 8,
    result: 'avaliacao_profissional_recomendada',
    justification: 'Nivel elevado de estresse pede avaliacao profissional preventiva.',
    priority: 95,
    status: 'ativo',
    effectiveAt: '2026-07-01',
  },
];
