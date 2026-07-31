import { describe, expect, it } from 'vitest';
import {
  CLINICAL_REPOSITORY_MODE_ENV_KEYS,
  resolveClinicalRepositoryMode,
  type ClinicalRepositoryModeEnvironment,
  type ClinicalRepositoryModule,
} from '@/services/repositories/clinical/repositoryMode';
import {
  createClinicalAgendaRepositoryFactory,
  resolveClinicalAgendaRepositoryMode,
} from '@/services/repositories/clinicalAgenda/factory';
import {
  createClinicalPortfolioRepositoryFactory,
  resolveClinicalPortfolioRepositoryMode,
} from '@/services/repositories/clinicalPortfolio/factory';
import {
  createClinicalRecordRepositoryFactory,
  resolveClinicalRecordRepositoryMode,
} from '@/services/repositories/clinicalRecord/factory';
import {
  createCarePlanRepositoryFactory,
  resolveCarePlanRepositoryMode,
} from '@/services/repositories/carePlan/factory';

const MODULES: ClinicalRepositoryModule[] = ['agenda', 'portfolio', 'record', 'carePlan'];

const MODULE_RESOLVERS = {
  agenda: resolveClinicalAgendaRepositoryMode,
  portfolio: resolveClinicalPortfolioRepositoryMode,
  record: resolveClinicalRecordRepositoryMode,
  carePlan: resolveCarePlanRepositoryMode,
} as const;

function env(
  overrides: ClinicalRepositoryModeEnvironment = {}
): ClinicalRepositoryModeEnvironment {
  return { ...overrides };
}

describe('resolveClinicalRepositoryMode (SUP-C04.1)', () => {
  it.each(MODULES)('specific mock selects mock for %s', (module) => {
    const key = CLINICAL_REPOSITORY_MODE_ENV_KEYS[module];
    expect(
      resolveClinicalRepositoryMode(
        module,
        env({
          VITE_ENABLE_SUPABASE_AUTH: 'true',
          [key]: 'mock',
        })
      )
    ).toBe('mock');
  });

  it.each(MODULES)('specific supabase selects supabase for %s', (module) => {
    const key = CLINICAL_REPOSITORY_MODE_ENV_KEYS[module];
    expect(
      resolveClinicalRepositoryMode(
        module,
        env({
          VITE_ENABLE_SUPABASE_AUTH: 'false',
          [key]: 'supabase',
        })
      )
    ).toBe('supabase');
  });

  it('modules can operate independently of each other', () => {
    const configuration = env({
      VITE_ENABLE_SUPABASE_AUTH: 'false',
      VITE_CLINICAL_AGENDA_REPOSITORY_MODE: 'supabase',
      VITE_CLINICAL_PORTFOLIO_REPOSITORY_MODE: 'mock',
      VITE_CLINICAL_RECORD_REPOSITORY_MODE: 'supabase',
      VITE_CLINICAL_CARE_PLAN_REPOSITORY_MODE: 'mock',
    });

    expect(resolveClinicalRepositoryMode('agenda', configuration)).toBe('supabase');
    expect(resolveClinicalRepositoryMode('portfolio', configuration)).toBe('mock');
    expect(resolveClinicalRepositoryMode('record', configuration)).toBe('supabase');
    expect(resolveClinicalRepositoryMode('carePlan', configuration)).toBe('mock');
  });

  it.each(MODULES)('absent specific flag inherits VITE_ENABLE_SUPABASE_AUTH for %s', (module) => {
    expect(resolveClinicalRepositoryMode(module, env({ VITE_ENABLE_SUPABASE_AUTH: 'true' }))).toBe(
      'supabase'
    );
    expect(resolveClinicalRepositoryMode(module, env({ VITE_ENABLE_SUPABASE_AUTH: 'false' }))).toBe(
      'mock'
    );
  });

  it('global true keeps supabase on modules without override', () => {
    const configuration = env({ VITE_ENABLE_SUPABASE_AUTH: 'true' });
    for (const module of MODULES) {
      expect(resolveClinicalRepositoryMode(module, configuration)).toBe('supabase');
    }
  });

  it('global false keeps mock on modules without override', () => {
    const configuration = env({ VITE_ENABLE_SUPABASE_AUTH: 'false' });
    for (const module of MODULES) {
      expect(resolveClinicalRepositoryMode(module, configuration)).toBe('mock');
    }
  });

  it('absence of all flags keeps current default mock', () => {
    const configuration = env();
    for (const module of MODULES) {
      expect(resolveClinicalRepositoryMode(module, configuration)).toBe('mock');
    }
  });

  it.each(MODULES)('specific mock overrides global supabase for %s', (module) => {
    const key = CLINICAL_REPOSITORY_MODE_ENV_KEYS[module];
    expect(
      resolveClinicalRepositoryMode(
        module,
        env({ VITE_ENABLE_SUPABASE_AUTH: 'true', [key]: 'mock' })
      )
    ).toBe('mock');
  });

  it.each(MODULES)('specific supabase overrides global mock for %s', (module) => {
    const key = CLINICAL_REPOSITORY_MODE_ENV_KEYS[module];
    expect(
      resolveClinicalRepositoryMode(
        module,
        env({ VITE_ENABLE_SUPABASE_AUTH: 'false', [key]: 'supabase' })
      )
    ).toBe('supabase');
  });

  it.each(MODULES)('invalid specific flag throws deterministically for %s', (module) => {
    const key = CLINICAL_REPOSITORY_MODE_ENV_KEYS[module];
    expect(() =>
      resolveClinicalRepositoryMode(module, env({ [key]: 'banana' }))
    ).toThrow(`Valor invalido para ${key}: "banana"`);
  });

  it.each(MODULES)('invalid global flag throws when inherited for %s', (module) => {
    expect(() =>
      resolveClinicalRepositoryMode(module, env({ VITE_ENABLE_SUPABASE_AUTH: 'banana' }))
    ).toThrow('Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "banana"');
  });

  it('configuration of one module does not alter another', () => {
    const withAgendaOnly = env({
      VITE_ENABLE_SUPABASE_AUTH: 'false',
      VITE_CLINICAL_AGENDA_REPOSITORY_MODE: 'supabase',
    });

    expect(resolveClinicalRepositoryMode('agenda', withAgendaOnly)).toBe('supabase');
    expect(resolveClinicalRepositoryMode('portfolio', withAgendaOnly)).toBe('mock');
    expect(resolveClinicalRepositoryMode('record', withAgendaOnly)).toBe('mock');
    expect(resolveClinicalRepositoryMode('carePlan', withAgendaOnly)).toBe('mock');
  });

  it('does not define a repository mode flag for /clinica/registros', () => {
    const keys = Object.values(CLINICAL_REPOSITORY_MODE_ENV_KEYS);
    expect(keys).toEqual([
      'VITE_CLINICAL_AGENDA_REPOSITORY_MODE',
      'VITE_CLINICAL_PORTFOLIO_REPOSITORY_MODE',
      'VITE_CLINICAL_RECORD_REPOSITORY_MODE',
      'VITE_CLINICAL_CARE_PLAN_REPOSITORY_MODE',
    ]);
    expect(keys.join(' ')).not.toMatch(/REGISTROS|ATTENDANCE|DEMO/i);
    expect(keys).toHaveLength(4);
  });

  it('factory resolvers match the central resolver', () => {
    const configuration = env({
      VITE_ENABLE_SUPABASE_AUTH: 'true',
      VITE_CLINICAL_PORTFOLIO_REPOSITORY_MODE: 'mock',
    });

    for (const module of MODULES) {
      expect(MODULE_RESOLVERS[module](configuration)).toBe(
        resolveClinicalRepositoryMode(module, configuration)
      );
    }
  });
});

describe('clinical repository factories (SUP-C04.1)', () => {
  it('agenda factory returns contract-compatible mock and supabase adapters', () => {
    const mockRepo = createClinicalAgendaRepositoryFactory({ mode: 'mock' });
    expect(typeof mockRepo.listLinkedClinicalAppointments).toBe('function');
    expect(typeof mockRepo.createClinicalAppointment).toBe('function');
    expect(typeof mockRepo.updateClinicalAppointment).toBe('function');

    const supabaseRepo = createClinicalAgendaRepositoryFactory({
      mode: 'supabase',
      supabaseClient: {} as never,
    });
    expect(typeof supabaseRepo.listLinkedClinicalAppointments).toBe('function');
    expect(typeof supabaseRepo.createClinicalAppointment).toBe('function');
    expect(typeof supabaseRepo.updateClinicalAppointment).toBe('function');
  });

  it('portfolio factory returns contract-compatible mock and supabase adapters', () => {
    const mockRepo = createClinicalPortfolioRepositoryFactory({ mode: 'mock' });
    expect(typeof mockRepo.listLinkedClinicalPatients).toBe('function');

    const supabaseRepo = createClinicalPortfolioRepositoryFactory({
      mode: 'supabase',
      supabaseClient: {} as never,
    });
    expect(typeof supabaseRepo.listLinkedClinicalPatients).toBe('function');
  });

  it('record factory returns contract-compatible mock and supabase adapters', () => {
    const mockRepo = createClinicalRecordRepositoryFactory({ mode: 'mock' });
    expect(typeof mockRepo.getLinkedClinicalRecord).toBe('function');
    expect(typeof mockRepo.saveClinicalRecordDraft).toBe('function');
    expect(typeof mockRepo.concludeClinicalRecord).toBe('function');

    const supabaseRepo = createClinicalRecordRepositoryFactory({
      mode: 'supabase',
      supabaseClient: {} as never,
    });
    expect(typeof supabaseRepo.getLinkedClinicalRecord).toBe('function');
    expect(typeof supabaseRepo.saveClinicalRecordDraft).toBe('function');
    expect(typeof supabaseRepo.concludeClinicalRecord).toBe('function');
  });

  it('care plan factory returns contract-compatible mock and supabase adapters', () => {
    const mockRepo = createCarePlanRepositoryFactory({ mode: 'mock' });
    expect(typeof mockRepo.getOpenCarePlan).toBe('function');
    expect(typeof mockRepo.createCarePlan).toBe('function');
    expect(typeof mockRepo.addCarePlanNote).toBe('function');

    const supabaseRepo = createCarePlanRepositoryFactory({
      mode: 'supabase',
      supabaseClient: {} as never,
    });
    expect(typeof supabaseRepo.getOpenCarePlan).toBe('function');
    expect(typeof supabaseRepo.createCarePlan).toBe('function');
    expect(typeof supabaseRepo.addCarePlanNote).toBe('function');
  });

  it('does not introduce runtime fallback: supabase mode requires client and returns supabase adapter only', () => {
    expect(() => createClinicalAgendaRepositoryFactory({ mode: 'supabase' })).toThrow(
      'Modo Supabase exige client por injecao.'
    );
    expect(() => createClinicalPortfolioRepositoryFactory({ mode: 'supabase' })).toThrow(
      'Modo Supabase exige client por injecao.'
    );
    expect(() => createClinicalRecordRepositoryFactory({ mode: 'supabase' })).toThrow(
      'Modo Supabase exige client por injecao.'
    );
    expect(() => createCarePlanRepositoryFactory({ mode: 'supabase' })).toThrow(
      'Modo Supabase exige client por injecao.'
    );

    const agenda = createClinicalAgendaRepositoryFactory({
      mode: 'supabase',
      supabaseClient: {} as never,
    });
    const portfolio = createClinicalPortfolioRepositoryFactory({
      mode: 'supabase',
      supabaseClient: {} as never,
    });
    const record = createClinicalRecordRepositoryFactory({
      mode: 'supabase',
      supabaseClient: {} as never,
    });
    const carePlan = createCarePlanRepositoryFactory({
      mode: 'supabase',
      supabaseClient: {} as never,
    });

    // Factories return the adapter directly (no fallback wrapper with dual methods).
    expect(Object.keys(agenda).sort()).toEqual(
      ['createClinicalAppointment', 'listLinkedClinicalAppointments', 'updateClinicalAppointment'].sort()
    );
    expect(Object.keys(portfolio)).toEqual(['listLinkedClinicalPatients']);
    expect(Object.keys(record).sort()).toEqual(
      [
        'concludeClinicalRecord',
        'getLinkedClinicalRecord',
        'listClinicalRecordVersions',
        'reopenClinicalRecord',
        'saveClinicalRecordDraft',
      ].sort()
    );
    expect(Object.keys(carePlan)).toContain('getOpenCarePlan');
    expect(Object.keys(carePlan)).not.toContain('resolveAccessContext');
  });
});
