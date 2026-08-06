import { beforeEach, describe, expect, it } from 'vitest';
import {
  addLinkedCarePlanNote,
  closeLinkedCarePlan,
  createLinkedCarePlan,
  createLinkedCarePlanAction,
  listLinkedCarePlans,
  loadOpenCarePlan,
  updateLinkedCarePlan,
  updateLinkedCarePlanAction,
} from '@/domains/carePlan/carePlanService';
import { createMockCarePlanRepository } from '@/services/repositories/carePlan/mockCarePlanRepository';
import type { CarePlanContext } from '@/services/repositories/carePlan/types';

function context(overrides: Partial<CarePlanContext> = {}): CarePlanContext {
  return {
    sessionUserId: 'pro-1',
    professionalUserId: 'pro-1',
    organizationId: 'org-1',
    unitId: 'unit-org-1',
    ...overrides,
  };
}

describe('plano de cuidado e evolucoes', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('cria plano, acao, evolucao, reavaliacao e conclui com historico', async () => {
    const repository = createMockCarePlanRepository();
    const created = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano sono',
      generalObjective: 'Melhorar higiene do sono',
      startsOn: '2026-07-31',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const action = await createLinkedCarePlanAction(repository, context(), {
      planId: created.data.id,
      specificObjective: 'Reduzir telas',
      actionText: 'Desligar aparelhos 1h antes',
      frequency: 'diaria',
    });
    expect(action.ok).toBe(true);
    if (!action.ok) return;

    const edited = await updateLinkedCarePlanAction(repository, context(), {
      actionId: action.data.id,
      expectedVersion: action.data.version,
      actionText: 'Desligar aparelhos 90 min antes',
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.data.version).toBe(2);

    const advanced = await updateLinkedCarePlanAction(repository, context(), {
      actionId: edited.data.id,
      expectedVersion: edited.data.version,
      actionStatus: 'concluida',
    });
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.data.completedAt).toBeTruthy();

    const note = await addLinkedCarePlanNote(repository, context(), {
      planId: created.data.id,
      note: 'Paciente aderente',
      kind: 'evolution',
      expectedPlanVersion: created.data.version,
    });
    expect(note.ok).toBe(true);

    const reassessment = await addLinkedCarePlanNote(repository, context(), {
      planId: created.data.id,
      note: 'Reavaliacao de rotina',
      kind: 'reassessment',
      expectedPlanVersion: created.data.version,
    });
    expect(reassessment.ok).toBe(true);

    const open = await loadOpenCarePlan(repository, context(), 'usr-1');
    expect(open.ok).toBe(true);
    if (!open.ok || !open.data) return;
    expect(open.data.plan.version).toBeGreaterThan(created.data.version);
    expect(open.data.events.some((item) => item.eventKind === 'evolution')).toBe(true);
    expect(open.data.events.some((item) => item.eventKind === 'reassessment')).toBe(true);

    const concluded = await closeLinkedCarePlan(repository, context(), {
      planId: open.data.plan.id,
      expectedVersion: open.data.plan.version,
      mode: 'conclude',
    });
    expect(concluded.ok).toBe(true);
    if (!concluded.ok) return;
    expect(concluded.data.planStatus).toBe('concluido');
    expect(concluded.data.version).toBe(open.data.plan.version + 1);

    const list = await listLinkedCarePlans(repository, context(), 'usr-1');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.some((item) => item.planStatus === 'concluido')).toBe(true);

    const next = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano de manutencao',
      generalObjective: 'Manter rotina',
      startsOn: '2026-08-01',
    });
    expect(next.ok).toBe(true);
  });

  it('exige justificativa na suspensao e bloqueia plano encerrado', async () => {
    const repository = createMockCarePlanRepository();
    const created = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano',
      generalObjective: 'Objetivo',
      startsOn: '2026-07-31',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const missing = await closeLinkedCarePlan(repository, context(), {
      planId: created.data.id,
      expectedVersion: created.data.version,
      mode: 'suspend',
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('VALIDATION_REQUIRED_FIELDS');

    const suspended = await closeLinkedCarePlan(repository, context(), {
      planId: created.data.id,
      expectedVersion: created.data.version,
      mode: 'suspend',
      suspensionReason: 'Baixa adesao',
    });
    expect(suspended.ok).toBe(true);
    if (!suspended.ok) return;

    const update = await updateLinkedCarePlan(repository, context(), {
      planId: created.data.id,
      expectedVersion: suspended.data.version,
      title: 'Hack',
    });
    expect(update.ok).toBe(false);
    if (update.ok) return;
    expect(update.error.code).toBe('PLAN_CLOSED');
  });

  it('impede segundo plano aberto e detecta conflito de versao', async () => {
    const repository = createMockCarePlanRepository();
    const created = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano 1',
      generalObjective: 'Obj',
      startsOn: '2026-07-31',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const duplicate = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano 2',
      generalObjective: 'Obj 2',
      startsOn: '2026-07-31',
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error.code).toBe('OPEN_PLAN_EXISTS');

    const conflict = await updateLinkedCarePlan(repository, context(), {
      planId: created.data.id,
      expectedVersion: 999,
      title: 'Novo titulo',
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.error.code).toBe('VERSION_CONFLICT');

    const updated = await updateLinkedCarePlan(repository, context(), {
      planId: created.data.id,
      expectedVersion: created.data.version,
      title: 'Plano revisado',
      planStatus: 'em_andamento',
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.version).toBe(created.data.version + 1);
    expect(updated.data.planStatus).toBe('em_andamento');
  });

  it('permite novo plano apos conclusao e apos suspensao', async () => {
    const repository = createMockCarePlanRepository();
    const first = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano 1',
      generalObjective: 'Obj',
      startsOn: '2026-07-31',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const concluded = await closeLinkedCarePlan(repository, context(), {
      planId: first.data.id,
      expectedVersion: first.data.version,
      mode: 'conclude',
    });
    expect(concluded.ok).toBe(true);

    const second = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano 2',
      generalObjective: 'Obj 2',
      startsOn: '2026-08-01',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const suspended = await closeLinkedCarePlan(repository, context(), {
      planId: second.data.id,
      expectedVersion: second.data.version,
      mode: 'suspend',
      suspensionReason: 'Pausa clinica',
    });
    expect(suspended.ok).toBe(true);

    const third = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano 3',
      generalObjective: 'Obj 3',
      startsOn: '2026-08-02',
    });
    expect(third.ok).toBe(true);
  });

  it('reavaliacao incrementa versao e cria exatamente um evento', async () => {
    const repository = createMockCarePlanRepository();
    const created = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano',
      generalObjective: 'Obj',
      startsOn: '2026-07-31',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const note = await addLinkedCarePlanNote(repository, context(), {
      planId: created.data.id,
      note: 'Reavaliacao valida',
      kind: 'reassessment',
      expectedPlanVersion: created.data.version,
    });
    expect(note.ok).toBe(true);
    if (!note.ok) return;
    expect(note.data.eventKind).toBe('reassessment');
    expect(note.data.versionAfter).toBe(created.data.version + 1);

    const conflict = await addLinkedCarePlanNote(repository, context(), {
      planId: created.data.id,
      note: 'stale',
      kind: 'reassessment',
      expectedPlanVersion: created.data.version,
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.error.code).toBe('VERSION_CONFLICT');
  });

  it('nega paciente fora da carteira e identidade cruzada', async () => {
    const repository = createMockCarePlanRepository();
    const denied = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-999',
      title: 'X',
      generalObjective: 'Y',
      startsOn: '2026-07-31',
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('PATIENT_NOT_IN_PORTFOLIO');

    const mismatch = await createLinkedCarePlan(
      repository,
      context({ sessionUserId: 'pro-1', professionalUserId: 'pro-2' }),
      {
        patientId: 'usr-1',
        title: 'X',
        generalObjective: 'Y',
        startsOn: '2026-07-31',
      }
    );
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.error.code).toBe('IDENTITY_MISMATCH');
  });
});
