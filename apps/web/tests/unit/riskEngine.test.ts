import { describe, expect, it } from 'vitest';
import { evaluatePreventiveRisk } from '@/domains/risk/riskEngine';

describe('evaluatePreventiveRisk', () => {
  it('retorna atencao para estresse elevado', () => {
    const result = evaluatePreventiveRisk({
      sleepHours: 7,
      activityDays: 3,
      stressLevel: 9,
    });
    expect(result.level).toBe('atencao');
  });

  it('retorna baixo quando nenhuma regra aciona', () => {
    const result = evaluatePreventiveRisk({
      sleepHours: 8,
      activityDays: 4,
      stressLevel: 3,
    });
    expect(result.level).toBe('baixo');
  });
});
