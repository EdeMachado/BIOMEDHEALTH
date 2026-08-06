import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicalRecordPage } from '@/features/biomed-clinica/ClinicalPages';
import { AuthProvider } from '@/services/auth/AuthContext';
import { emptyClinicalRecordSections } from '@/services/repositories/clinicalRecord/schema';
import type { ClinicalRecord, ClinicalRecordVersion } from '@/services/repositories/clinicalRecord/types';
import type { ClinicalPortfolioPatient } from '@/services/repositories/clinicalPortfolio/types';

const patients: ClinicalPortfolioPatient[] = [
  {
    patientId: 'usr-1',
    organizationId: 'org-1',
    unitId: 'unit-org-1',
    displayName: 'Ana Demo',
    assignmentStatus: 'ativo',
    assignmentReason: 'acompanhamento',
  },
];

let recordResult: { ok: true; data: ClinicalRecord | null } | { ok: false; error: { code: string } } = {
  ok: true,
  data: null,
};
let versionsResult: { ok: true; data: ClinicalRecordVersion[] } | { ok: false; error: { code: string } } = {
  ok: true,
  data: [],
};

const getLinkedClinicalRecordMock = vi.fn(() => Promise.resolve(recordResult));
const listClinicalRecordVersionsMock = vi.fn(() => Promise.resolve(versionsResult));
const saveClinicalRecordDraftMock = vi.fn(({ draft }: { draft: { sections: ClinicalRecord['sections'] } }) => {
  const saved: ClinicalRecord = {
    id: 'cr-1',
    organizationId: 'org-1',
    patientId: 'usr-1',
    professionalId: 'pro-1',
    summary: 'Sono',
    recordStatus: 'rascunho',
    schemaVersion: 'clinical_record.v1',
    sections: draft.sections,
    revisionNumber: 1,
    authoredBy: 'pro-1',
    concludedAt: null,
    concludedBy: null,
    updatedAt: new Date().toISOString(),
    status: 'ativo',
  };
  recordResult = { ok: true, data: saved };
  versionsResult = {
    ok: true,
    data: [
      {
        id: 'crv-1',
        clinicalRecordId: 'cr-1',
        organizationId: 'org-1',
        patientId: 'usr-1',
        professionalId: 'pro-1',
        schemaVersion: 'clinical_record.v1',
        sections: draft.sections,
        summary: 'Sono',
        recordStatus: 'rascunho',
        revisionNumber: 1,
        changeKind: 'create',
        authoredBy: 'pro-1',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  return Promise.resolve({ ok: true as const, data: saved });
});

vi.mock('@/services/repositories/clinicalPortfolio/factory', () => ({
  resolveClinicalPortfolioRepositoryMode: () => 'mock',
  createClinicalPortfolioRepositoryFactory: () => ({
    listLinkedClinicalPatients: () => Promise.resolve({ ok: true, data: patients }),
  }),
}));

vi.mock('@/services/repositories/clinicalRecord/factory', () => ({
  resolveClinicalRecordRepositoryMode: () => 'mock',
  createClinicalRecordRepositoryFactory: () => ({
    getLinkedClinicalRecord: () => getLinkedClinicalRecordMock(),
    listClinicalRecordVersions: () => listClinicalRecordVersionsMock(),
    saveClinicalRecordDraft: (input: { draft: { sections: ClinicalRecord['sections'] } }) =>
      saveClinicalRecordDraftMock(input),
    concludeClinicalRecord: () => Promise.resolve({ ok: false, error: { code: 'VALIDATION_REQUIRED_FIELDS' } }),
    reopenClinicalRecord: () => Promise.resolve({ ok: false, error: { code: 'INVALID_INPUT' } }),
  }),
}));

function setClinicalSession() {
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: 'pro-1',
      nome: 'Dr. Demo',
      email: 'medico.demo@biomed.health',
      role: 'medico',
      roles: ['medico'],
      organizationId: 'org-1',
    })
  );
}

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <ClinicalRecordPage /> }], {
    initialEntries: ['/'],
  });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('ClinicalRecordPage integracao', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setClinicalSession();
    recordResult = { ok: true, data: null };
    versionsResult = { ok: true, data: [] };
    getLinkedClinicalRecordMock.mockClear();
    listClinicalRecordVersionsMock.mockClear();
    saveClinicalRecordDraftMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('mostra vazio, nota de validacao e salva rascunho', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByTestId('clinical-record-validation-note')).toHaveTextContent(
      /Estrutura clínica em validação/
    );

    await waitFor(() => {
      expect(screen.getByTestId('clinical-record-empty')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('clinical-record-toggle-edit'));
    const motivo = screen.getByTestId('clinical-record-field-motivo_acompanhamento');
    await user.clear(motivo);
    await user.type(motivo, 'Sono irregular');
    await user.click(screen.getByTestId('clinical-record-save-draft'));

    await waitFor(() => {
      expect(saveClinicalRecordDraftMock).toHaveBeenCalled();
      expect(screen.getByTestId('clinical-record-message')).toHaveTextContent(/Rascunho salvo/);
    });
  });

  it('exibe erro de acesso clinico', async () => {
    recordResult = { ok: false, error: { code: 'CLINICAL_ACCESS_DENIED' } };
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('clinical-record-error')).toHaveTextContent(/nao autorizado/i);
    });
  });

  it('preserva secoes conhecidas ao carregar ficha existente', async () => {
    const sections = emptyClinicalRecordSections();
    sections.motivo_acompanhamento = { value: 'Motivo persistido' };
    recordResult = {
      ok: true,
      data: {
        id: 'cr-1',
        organizationId: 'org-1',
        patientId: 'usr-1',
        professionalId: 'pro-1',
        summary: 'Motivo persistido',
        recordStatus: 'rascunho',
        schemaVersion: 'clinical_record.v1',
        sections,
        revisionNumber: 1,
        authoredBy: 'pro-1',
        concludedAt: null,
        concludedBy: null,
        updatedAt: '2026-07-31T12:00:00.000Z',
        status: 'ativo',
      },
    };
    versionsResult = {
      ok: true,
      data: [
        {
          id: 'crv-1',
          clinicalRecordId: 'cr-1',
          organizationId: 'org-1',
          patientId: 'usr-1',
          professionalId: 'pro-1',
          schemaVersion: 'clinical_record.v1',
          sections,
          summary: 'Motivo persistido',
          recordStatus: 'rascunho',
          revisionNumber: 1,
          changeKind: 'create',
          authoredBy: 'pro-1',
          createdAt: '2026-07-31T12:00:00.000Z',
        },
      ],
    };

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Motivo persistido')).toBeInTheDocument();
      expect(screen.getByTestId('clinical-record-history')).toBeInTheDocument();
    });
  });
});
