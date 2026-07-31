import { beforeEach, describe, expect, it } from 'vitest';
import {
  concludeLinkedClinicalRecord,
  loadClinicalRecordHistory,
  loadLinkedClinicalRecord,
  reopenLinkedClinicalRecord,
  saveLinkedClinicalRecordDraft,
} from '@/domains/clinicalRecord/clinicalRecordService';
import { createMockClinicalRecordRepository } from '@/services/repositories/clinicalRecord/mockClinicalRecordRepository';
import {
  emptyClinicalRecordSections,
  missingRequiredConclusionFields,
} from '@/services/repositories/clinicalRecord/schema';
import { createSupabaseClinicalRecordRepository } from '@/services/repositories/clinicalRecord/supabaseClinicalRecordRepository';
import type { ClinicalRecordContext } from '@/services/repositories/clinicalRecord/types';

function context(overrides: Partial<ClinicalRecordContext> = {}): ClinicalRecordContext {
  return {
    sessionUserId: 'pro-1',
    professionalUserId: 'pro-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

function filledSections() {
  const sections = emptyClinicalRecordSections();
  sections.motivo_acompanhamento = { value: 'Sono irregular' };
  sections.avaliacao_profissional_orientativa = { value: 'Acompanhamento preventivo' };
  sections.conduta_orientativa = { value: 'Higiene do sono' };
  sections.sono = { value: '6h' };
  return sections;
}

describe('ficha clinica modular versionada', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('valida campos obrigatorios apenas na conclusao', () => {
    const empty = emptyClinicalRecordSections();
    expect(missingRequiredConclusionFields(empty)).toEqual([
      'motivo_acompanhamento',
      'avaliacao_profissional_orientativa',
      'conduta_orientativa',
    ]);
    expect(missingRequiredConclusionFields(filledSections())).toEqual([]);
  });

  it('cria rascunho, lista historico e conclui com autoria', async () => {
    const repository = createMockClinicalRecordRepository();
    const created = await saveLinkedClinicalRecordDraft(repository, context(), {
      patientId: 'usr-1',
      sections: filledSections(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.recordStatus).toBe('rascunho');
    expect(created.data.schemaVersion).toBe('clinical_record.v1');
    expect(created.data.authoredBy).toBe('pro-1');

    const history = await loadClinicalRecordHistory(repository, context(), created.data.id);
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.data.some((item) => item.changeKind === 'create')).toBe(true);

    const concluded = await concludeLinkedClinicalRecord(repository, context(), {
      recordId: created.data.id,
      sections: filledSections(),
    });
    expect(concluded.ok).toBe(true);
    if (!concluded.ok) return;
    expect(concluded.data.recordStatus).toBe('concluido');
    expect(concluded.data.concludedBy).toBe('pro-1');
    expect(concluded.data.concludedAt).toBeTruthy();
  });

  it('bloqueia edicao apos conclusao e permite nova revisao sem perder historico', async () => {
    const repository = createMockClinicalRecordRepository();
    const created = await saveLinkedClinicalRecordDraft(repository, context(), {
      patientId: 'usr-1',
      sections: filledSections(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const concluded = await concludeLinkedClinicalRecord(repository, context(), {
      recordId: created.data.id,
      sections: filledSections(),
    });
    expect(concluded.ok).toBe(true);
    if (!concluded.ok) return;

    const blocked = await saveLinkedClinicalRecordDraft(repository, context(), {
      patientId: 'usr-1',
      recordId: created.data.id,
      sections: filledSections(),
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error.code).toBe('RECORD_CONCLUDED');

    const reopened = await reopenLinkedClinicalRecord(repository, context(), {
      recordId: created.data.id,
    });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.data.revisionNumber).toBe(2);
    expect(reopened.data.recordStatus).toBe('rascunho');

    const history = await loadClinicalRecordHistory(repository, context(), created.data.id);
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.data.some((item) => item.changeKind === 'conclude')).toBe(true);
    expect(history.data.some((item) => item.changeKind === 'reopen')).toBe(true);
  });

  it('nega paciente fora da carteira e profissional desconhecido', async () => {
    const repository = createMockClinicalRecordRepository();
    const denied = await loadLinkedClinicalRecord(
      repository,
      context({ sessionUserId: 'pro-unknown', professionalUserId: 'pro-unknown' }),
      'usr-1'
    );
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('CLINICAL_ACCESS_DENIED');

    const outside = await saveLinkedClinicalRecordDraft(repository, context(), {
      patientId: 'usr-999',
      sections: filledSections(),
    });
    expect(outside.ok).toBe(false);
    if (outside.ok) return;
    expect(outside.error.code).toBe('PATIENT_NOT_IN_PORTFOLIO');
  });

  it('exige campos obrigatorios ao concluir via supabase repository', async () => {
    const client = {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'pro-1' } }, error: null }),
      },
      rpc: (fn: string) => {
        if (fn === 'can_manage_clinical_record') return Promise.resolve({ data: true, error: null });
        if (fn === 'can_access_linked_patient_journey') return Promise.resolve({ data: true, error: null });
        return Promise.resolve({ data: null, error: { message: 'unexpected' } });
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    const repository = createSupabaseClinicalRecordRepository({
      client: client as unknown as import('@/services/repositories/clinicalRecord/supabaseClinicalRecordRepository').SupabaseClinicalRecordClient,
    });
    const result = await concludeLinkedClinicalRecord(repository, context(), {
      recordId: 'cr-1',
      sections: emptyClinicalRecordSections(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_REQUIRED_FIELDS');
  });
});
