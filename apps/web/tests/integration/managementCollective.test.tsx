import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagementCampaignsPage } from '@/features/biomed-gestao/ManagementPages';
import { AuthProvider } from '@/services/auth/AuthContext';
import { demoUsers } from '@/services/repositories/demoData';
import type { CampaignRecord, CollectiveResult } from '@/services/repositories/collective/types';
import type { Role } from '@/shared/types/access';

const campaigns: CampaignRecord[] = [
  {
    id: 'camp-1',
    organizationId: 'org-1',
    scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
    title: 'Semana do Sono',
    description: 'Aumentar adesao',
    channel: 'email',
    startsAt: '2026-08-01',
    endsAt: '2026-08-15',
    campaignStatus: 'Ativa',
    status: 'ativo',
    version: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'camp-selected',
    organizationId: 'org-1',
    scope: {
      scopeType: 'organization',
      unitId: null,
      unitApplicability: 'selected_units',
      unitIds: ['unit-a', 'unit-b'],
    },
    title: 'Campanha Selected',
    description: 'Escopo coletivo parcial',
    channel: 'email',
    startsAt: '2026-08-01',
    endsAt: '2026-08-20',
    campaignStatus: 'Rascunho',
    status: 'ativo',
    version: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
];

const listCampaignsMock = vi.fn((): Promise<CollectiveResult<CampaignRecord[]>> =>
  Promise.resolve({ ok: true, data: campaigns })
);
const createCampaignMock = vi.fn((): Promise<CollectiveResult<CampaignRecord>> =>
  Promise.resolve({
    ok: true,
    data: {
      ...campaigns[0],
      id: 'camp-new',
      title: 'Nova campanha',
      campaignStatus: 'Rascunho',
    },
  })
);
const updateCampaignMock = vi.fn((): Promise<CollectiveResult<CampaignRecord>> =>
  Promise.resolve({ ok: true, data: { ...campaigns[0], campaignStatus: 'Encerrada' } })
);
const deleteCampaignMock = vi.fn((): Promise<CollectiveResult<{ id: string }>> =>
  Promise.resolve({ ok: true, data: { id: 'camp-1' } })
);

vi.mock('@/services/repositories/collective', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/repositories/collective')>();
  return {
    ...actual,
    resolveCollectiveRepositoryMode: () => 'mock' as const,
    createCollectiveRepositoryFactory: () => ({
      listCampaigns: listCampaignsMock,
      getCampaign: (): Promise<CollectiveResult<CampaignRecord>> =>
        Promise.resolve({ ok: true, data: campaigns[0] }),
      createCampaign: createCampaignMock,
      updateCampaign: updateCampaignMock,
      deleteCampaign: deleteCampaignMock,
      listActionPlans: () => Promise.resolve({ ok: true as const, data: [] }),
      getActionPlan: () =>
        Promise.resolve({
          ok: false as const,
          error: {
            code: 'NOT_FOUND' as const,
            kind: 'validation' as const,
            transient: false,
            message: 'not found',
          },
        }),
      createActionPlan: () =>
        Promise.resolve({
          ok: false as const,
          error: {
            code: 'INVALID_INPUT' as const,
            kind: 'validation' as const,
            transient: false,
            message: 'invalid',
          },
        }),
      updateActionPlan: () =>
        Promise.resolve({
          ok: false as const,
          error: {
            code: 'INVALID_INPUT' as const,
            kind: 'validation' as const,
            transient: false,
            message: 'invalid',
          },
        }),
      deleteActionPlan: () =>
        Promise.resolve({
          ok: false as const,
          error: {
            code: 'NOT_FOUND' as const,
            kind: 'validation' as const,
            transient: false,
            message: 'not found',
          },
        }),
    }),
  };
});

function setSession(role: Role) {
  const source = demoUsers.find((user) => user.role === role && user.organizationId === 'org-1');
  if (!source) throw new Error(`Usuario demo nao encontrado para role=${role}`);
  sessionStorage.setItem(
    'biomed_demo_session',
    JSON.stringify({
      id: source.id,
      nome: source.nome,
      email: source.email,
      role: source.role,
      roles: source.roles,
      organizationId: source.organizationId,
    })
  );
}

function renderCampaigns() {
  const router = createMemoryRouter([{ path: '/', element: <ManagementCampaignsPage /> }], {
    initialEntries: ['/'],
  });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('ManagementCampaignsPage SUP-D01-C', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setSession('gestor_institucional');
    listCampaignsMock.mockReset();
    createCampaignMock.mockReset();
    updateCampaignMock.mockReset();
    deleteCampaignMock.mockReset();
    listCampaignsMock.mockImplementation(() => Promise.resolve({ ok: true, data: campaigns }));
    createCampaignMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        data: {
          ...campaigns[0],
          id: 'camp-new',
          title: 'Nova campanha',
          campaignStatus: 'Rascunho',
        },
      })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('exibe loading e sucesso de leitura', async () => {
    renderCampaigns();
    expect(screen.getByText(/Carregando campanhas/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Semana do Sono')).toBeInTheDocument();
    });
    expect(listCampaignsMock).toHaveBeenCalled();
  });

  it('diferencia empty state de erro', async () => {
    listCampaignsMock.mockImplementationOnce(() => Promise.resolve({ ok: true, data: [] }));
    renderCampaigns();
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma campanha autorizada/i)).toBeInTheDocument();
    });

    cleanup();
    sessionStorage.clear();
    setSession('gestor_institucional');
    listCampaignsMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        error: {
          code: 'CROSS_TENANT_DATA',
          kind: 'authorization',
          transient: false,
          message: 'blocked',
        },
      })
    );
    renderCampaigns();
    await waitFor(() => {
      expect(screen.getByText(/Operacao nao autorizada/i)).toBeInTheDocument();
    });
  });

  it('cria campanha autorizada e evita duplo envio', async () => {
    const user = userEvent.setup();
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nova campanha' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Nova campanha' }));
    await user.type(screen.getByPlaceholderText('Titulo'), 'Nova campanha');
    await user.type(screen.getByPlaceholderText('Descricao / objetivo'), 'Objetivo coletivo');
    await user.click(screen.getByRole('button', { name: 'Criar campanha' }));
    await waitFor(() => expect(createCampaignMock).toHaveBeenCalledTimes(1));
  });

  it('bloqueia escrita para auditor', async () => {
    setSession('auditor');
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    expect(screen.getByText(/leitura coletiva apenas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova campanha' })).toBeDisabled();
  });

  it('preserva formulario apos erro de create', async () => {
    const user = userEvent.setup();
    createCampaignMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        error: {
          code: 'TECHNICAL_ERROR',
          kind: 'technical',
          transient: true,
          message: 'fail',
        },
      })
    );
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nova campanha' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Nova campanha' }));
    await user.type(screen.getByPlaceholderText('Titulo'), 'Rascunho local');
    await user.type(screen.getByPlaceholderText('Descricao / objetivo'), 'Mantido');
    await user.click(screen.getByRole('button', { name: 'Criar campanha' }));
    await waitFor(() => expect(screen.getByText(/Falha tecnica/i)).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Titulo')).toHaveValue('Rascunho local');
    expect(screen.getByPlaceholderText('Descricao / objetivo')).toHaveValue('Mantido');
  });

  it('exige unitId explicito para escopo unit (sem selectedUnitId)', async () => {
    const user = userEvent.setup();
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nova campanha' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Nova campanha' }));
    await user.type(screen.getByPlaceholderText('Titulo'), 'Unitaria');
    await user.type(screen.getByPlaceholderText('Descricao / objetivo'), 'Desc');
    await user.selectOptions(
      screen.getByDisplayValue('Organizacao / todas as unidades'),
      'unit'
    );
    await user.click(screen.getByRole('button', { name: 'Criar campanha' }));
    await waitFor(() => {
      expect(screen.getByText(/Escopo unitario exige unitId explicito/i)).toBeInTheDocument();
    });
    expect(createCampaignMock).not.toHaveBeenCalled();
  });

  it('edita metadados de campanha selected_units sem reenviar scope', async () => {
    const user = userEvent.setup();
    updateCampaignMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        data: {
          ...campaigns[1],
          title: 'Campanha Selected editada',
          version: 2,
        },
      })
    );
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Campanha Selected')).toBeInTheDocument());
    const editButtons = screen.getAllByRole('button', { name: 'Editar' });
    await user.click(editButtons[1]);
    await waitFor(() => {
      expect(
        screen.getByDisplayValue('Organizacao (unidades selecionadas — somente leitura)')
      ).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Organizacao (unidades selecionadas — somente leitura)')).toBeDisabled();
    expect(screen.getByPlaceholderText('unitId (obrigatorio se escopo unit)')).toBeDisabled();
    const titleInput = screen.getByPlaceholderText('Titulo');
    await user.clear(titleInput);
    await user.type(titleInput, 'Campanha Selected editada');
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }));
    await waitFor(() => expect(updateCampaignMock).toHaveBeenCalledTimes(1));
    expect(updateCampaignMock.mock.calls.length).toBeGreaterThan(0);
    const [, rawPayload] = updateCampaignMock.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(rawPayload).toMatchObject({
      campaignId: 'camp-selected',
      title: 'Campanha Selected editada',
    });
    expect(rawPayload).not.toHaveProperty('scope');
    expect(rawPayload).not.toHaveProperty('applicableUnitIds');
    expect(rawPayload).not.toHaveProperty('audience');
    await waitFor(() => {
      expect(screen.getByText(/Campanha "Campanha Selected editada" atualizada/i)).toBeInTheDocument();
    });
  });

  it('previne duplo envio no update de metadados selected_units', async () => {
    const user = userEvent.setup();
    let resolveUpdate: ((value: CollectiveResult<CampaignRecord>) => void) | undefined;
    updateCampaignMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Campanha Selected')).toBeInTheDocument());
    await user.click(screen.getAllByRole('button', { name: 'Editar' })[1]);
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }));
    expect(updateCampaignMock).toHaveBeenCalledTimes(1);
    resolveUpdate?.({
      ok: true,
      data: { ...campaigns[1], title: 'Campanha Selected', version: 2 },
    });
    await waitFor(() => expect(updateCampaignMock).toHaveBeenCalledTimes(1));
  });

  it('auditor continua sem acoes de escrita mesmo com selected_units', async () => {
    setSession('auditor');
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Campanha Selected')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Nova campanha' })).toBeDisabled();
    for (const btn of screen.getAllByRole('button', { name: 'Editar' })) {
      expect(btn).toBeDisabled();
    }
    expect(updateCampaignMock).not.toHaveBeenCalled();
    expect(deleteCampaignMock).not.toHaveBeenCalled();
  });
});
