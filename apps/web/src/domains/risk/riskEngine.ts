import { demoRiskRules } from '@/domains/risk/rules';
import type { DemoAssessmentAnswer, RiskResult } from '@/shared/types/access';

const RESULT_MAP: Record<string, string> = {
  atencao_habitos_sono: 'Acompanhamento preventivo recomendado com foco em sono.',
  oportunidade_movimento: 'Oportunidade de cuidado com atividade fisica gradual e segura.',
  avaliacao_profissional_recomendada: 'Avaliacao profissional recomendada para bem-estar.',
};

export function evaluatePreventiveRisk(answers: DemoAssessmentAnswer): RiskResult {
  const activeRules = demoRiskRules.filter((rule) => rule.status === 'ativo');
  const matched = activeRules
    .filter((rule) => rule.condition(answers))
    .sort((a, b) => b.priority - a.priority);

  if (!matched.length) {
    return {
      level: 'baixo',
      message: 'Manter acompanhamento de rotina e habitos preventivos.',
      rationale: ['Nenhuma regra de atencao foi acionada nesta avaliacao demonstrativa.'],
    };
  }

  if (matched[0].priority >= 90) {
    return {
      level: 'atencao',
      message: RESULT_MAP[matched[0].result] ?? 'Acompanhamento preventivo recomendado.',
      rationale: matched.map((item) => `${item.domain}: ${item.justification}`),
    };
  }

  return {
    level: 'moderado',
    message: RESULT_MAP[matched[0].result] ?? 'Atencao a habitos e acompanhamento preventivo.',
    rationale: matched.map((item) => `${item.domain}: ${item.justification}`),
  };
}
