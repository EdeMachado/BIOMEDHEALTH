import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ManagementActionPlanPage,
  ManagementCampaignsPage,
} from '@/features/biomed-gestao/ManagementPages';
import { AuthProvider } from '@/services/auth/AuthContext';
import { demoUsers } from '@/services/repositories/demoData';
import type {
  ActionPlanRecord,
  CampaignRecord,
  CollectiveResult,
} from '@/services/repositories/collective/types';
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
    audience: { audienceLabel: 'Turno noite' },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
];

const actionPlans: ActionPlanRecord[] = [
  {
    id: 'plan-1',
    organizationId: 'org-1',
    scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
    originIndicator: 'Adesao',
    issueDescription: 'Baixa participacao',
    actionText: 'Reforcar comunicacao',
    ownerName: 'Marina Gestora',
    dueDate: '2026-08-15',
    priority: 'Alta',
    actionStatus: 'Em andamento',
    status: 'ativo',
    version: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'plan-selected',
    organizationId: 'org-1',
    scope: {
      scopeType: 'organization',
      unitId: null,
      unitApplicability: 'selected_units',
      unitIds: ['unit-a'],
    },
    originIndicator: 'Indicador X',
    issueDescription: 'Escopo parcial',
    actionText: 'Plano selected',
    ownerName: 'Marina Gestora',
    dueDate: '2026-08-20',
    priority: 'Media',
    actionStatus: 'Planejado',
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

const listActionPlansMock = vi.fn((): Promise<CollectiveResult<ActionPlanRecord[]>> =>
  Promise.resolve({ ok: true, data: actionPlans })
);
const createActionPlanMock = vi.fn((): Promise<CollectiveResult<ActionPlanRecord>> =>
  Promise.resolve({
    ok: true,
    data: {
      ...actionPlans[0],
      id: 'plan-new',
      actionText: 'Nova acao',
      actionStatus: 'Planejado',
    },
  })
);
const updateActionPlanMock = vi.fn((): Promise<CollectiveResult<ActionPlanRecord>> =>
  Promise.resolve({ ok: true, data: { ...actionPlans[0], actionText: 'Editado' } })
);
const deleteActionPlanMock = vi.fn((): Promise<CollectiveResult<{ id: string }>> =>
  Promise.resolve({ ok: true, data: { id: 'plan-1' } })
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
      listActionPlans: listActionPlansMock,
      getActionPlan: (): Promise<CollectiveResult<ActionPlanRecord>> =>
        Promise.resolve({ ok: true, data: actionPlans[0] }),
      createActionPlan: createActionPlanMock,
      updateActionPlan: updateActionPlanMock,
      deleteActionPlan: deleteActionPlanMock,
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

function renderActionPlans() {
  const router = createMemoryRouter([{ path: '/', element: <ManagementActionPlanPage /> }], {
    initialEntries: ['/'],
  });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('ManagementCampaignsPage SUP-D01-D', () => {
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
    updateCampaignMock.mockImplementation(() =>
      Promise.resolve({ ok: true, data: { ...campaigns[0], campaignStatus: 'Encerrada' } })
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

  it('cria campanha selected_units com unitIds textuais', async () => {
    const user = userEvent.setup();
    createCampaignMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        data: {
          ...campaigns[1],
          id: 'camp-new-selected',
          title: 'Campanha unidades',
        },
      })
    );
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nova campanha' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Nova campanha' }));
    await user.type(screen.getByPlaceholderText('Titulo'), 'Campanha unidades');
    await user.type(screen.getByPlaceholderText('Descricao / objetivo'), 'Objetivo parcial');
    await user.selectOptions(
      screen.getByDisplayValue('Organizacao / todas as unidades'),
      'selected_units'
    );
    await user.type(screen.getByPlaceholderText('unitIds (virgula ou espaco)'), 'unit-a, unit-b');
    await user.click(screen.getByRole('button', { name: 'Criar campanha' }));
    await waitFor(() => expect(createCampaignMock).toHaveBeenCalledTimes(1));
    const [, payload] = createCampaignMock.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(payload).toMatchObject({
      title: 'Campanha unidades',
      scope: {
        scopeType: 'organization',
        unitApplicability: 'selected_units',
        unitIds: ['unit-a', 'unit-b'],
      },
    });
  });

  it('edita campanha selected_units da lista com unitIds e audiencia', async () => {
    const user = userEvent.setup();
    updateCampaignMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        data: {
          ...campaigns[1],
          title: 'Campanha Selected editada',
          audience: { audienceLabel: 'Turno manha' },
          version: 2,
        },
      })
    );
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Campanha Selected')).toBeInTheDocument());
    await user.click(screen.getAllByRole('button', { name: 'Editar' })[1]);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Organizacao (unidades selecionadas)')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('unitIds (virgula ou espaco)')).toHaveValue('unit-a, unit-b');
    expect(screen.getByPlaceholderText('Rotulo de audiencia (opcional)')).toHaveValue('Turno noite');
    const titleInput = screen.getByPlaceholderText('Titulo');
    await user.clear(titleInput);
    await user.type(titleInput, 'Campanha Selected editada');
    const audienceInput = screen.getByPlaceholderText('Rotulo de audiencia (opcional)');
    await user.clear(audienceInput);
    await user.type(audienceInput, 'Turno manha');
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }));
    await waitFor(() => expect(updateCampaignMock).toHaveBeenCalledTimes(1));
    const [, rawPayload] = updateCampaignMock.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(rawPayload).toMatchObject({
      campaignId: 'camp-selected',
      title: 'Campanha Selected editada',
      scope: {
        unitApplicability: 'selected_units',
        unitIds: ['unit-a', 'unit-b'],
      },
      audience: { audienceLabel: 'Turno manha' },
    });
    await waitFor(() => {
      expect(screen.getByText(/Campanha "Campanha Selected editada" atualizada/i)).toBeInTheDocument();
    });
  });

  it('cria campanha com audiencia opcional', async () => {
    const user = userEvent.setup();
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nova campanha' }));
    await user.type(screen.getByPlaceholderText('Titulo'), 'Com audiencia');
    await user.type(screen.getByPlaceholderText('Descricao / objetivo'), 'Obj');
    await user.type(screen.getByPlaceholderText('Rotulo de audiencia (opcional)'), 'Grupo A');
    await user.click(screen.getByRole('button', { name: 'Criar campanha' }));
    await waitFor(() => expect(createCampaignMock).toHaveBeenCalledTimes(1));
    const [, payload] = createCampaignMock.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(payload).toMatchObject({
      audience: { audienceLabel: 'Grupo A' },
    });
  });

  it('preserva formulario apos erro de create e nao mostra sucesso (P3)', async () => {
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
    expect(screen.queryByText(/criada\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Campanha ".*criada/i)).not.toBeInTheDocument();
  });

  it('previne duplo envio no create', async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: CollectiveResult<CampaignRecord>) => void) | undefined;
    createCampaignMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nova campanha' }));
    await user.type(screen.getByPlaceholderText('Titulo'), 'Duplo');
    await user.type(screen.getByPlaceholderText('Descricao / objetivo'), 'Obj');
    await user.click(screen.getByRole('button', { name: 'Criar campanha' }));
    await user.click(screen.getByRole('button', { name: 'Criar campanha' }));
    expect(createCampaignMock).toHaveBeenCalledTimes(1);
    resolveCreate?.({
      ok: true,
      data: { ...campaigns[0], id: 'camp-dup', title: 'Duplo' },
    });
    await waitFor(() => expect(createCampaignMock).toHaveBeenCalledTimes(1));
  });


  it('limpa sucesso anterior quando exclusao de campanha falha (issue #25)', async () => {
    const user = userEvent.setup();
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    await user.click(screen.getAllByRole('button', { name: 'Encerrar' })[0]);
    await waitFor(() => {
      expect(screen.getByText(/Campanha "Semana do Sono" encerrada/i)).toBeInTheDocument();
    });
    deleteCampaignMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        error: {
          code: 'TECHNICAL_ERROR',
          kind: 'technical',
          transient: true,
          message: 'delete failed',
        },
      })
    );
    await user.click(screen.getAllByRole('button', { name: 'Excluir' })[0]);
    await waitFor(() => expect(screen.getByText(/Falha tecnica/i)).toBeInTheDocument());
    expect(screen.queryByText(/Campanha "Semana do Sono" encerrada/i)).not.toBeInTheDocument();
  });

  it('bloqueia escrita para auditor (leitura apenas)', async () => {
    setSession('auditor');
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
    expect(screen.getByText(/leitura coletiva apenas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova campanha' })).toBeDisabled();
    for (const btn of screen.getAllByRole('button', { name: 'Editar' })) {
      expect(btn).toBeDisabled();
    }
    expect(updateCampaignMock).not.toHaveBeenCalled();
    expect(deleteCampaignMock).not.toHaveBeenCalled();
  });

  it('exige unitId explicito para escopo unit', async () => {
    const user = userEvent.setup();
    renderCampaigns();
    await waitFor(() => expect(screen.getByText('Semana do Sono')).toBeInTheDocument());
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
});

describe('ManagementActionPlanPage SUP-D01-D (P3 debt)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setSession('gestor_institucional');
    listActionPlansMock.mockReset();
    createActionPlanMock.mockReset();
    updateActionPlanMock.mockReset();
    deleteActionPlanMock.mockReset();
    listActionPlansMock.mockImplementation(() => Promise.resolve({ ok: true, data: actionPlans }));
    createActionPlanMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        data: {
          ...actionPlans[0],
          id: 'plan-new',
          actionText: 'Nova acao',
          actionStatus: 'Planejado',
        },
      })
    );
    updateActionPlanMock.mockImplementation(() =>
      Promise.resolve({ ok: true, data: { ...actionPlans[0], actionText: 'Editado' } })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('cria plano selected_units com unitIds textuais', async () => {
    const user = userEvent.setup();
    createActionPlanMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        data: {
          ...actionPlans[1],
          id: 'plan-new-selected',
          actionText: 'Acao unidades',
        },
      })
    );
    renderActionPlans();
    await waitFor(() => expect(screen.getByText('Reforcar comunicacao')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nova ação' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Nova ação' }));
    await user.type(screen.getByPlaceholderText('Indicador de origem'), 'Indicador Y');
    await user.type(screen.getByPlaceholderText('Problema / descricao'), 'Problema parcial');
    await user.type(screen.getByPlaceholderText('Acao'), 'Acao unidades');
    await user.selectOptions(
      screen.getByDisplayValue('Organizacao / todas as unidades'),
      'selected_units'
    );
    await user.type(screen.getByPlaceholderText('unitIds (virgula ou espaco)'), 'unit-x unit-y');
    await user.click(screen.getByRole('button', { name: 'Criar plano' }));
    await waitFor(() => expect(createActionPlanMock).toHaveBeenCalledTimes(1));
    const [, payload] = createActionPlanMock.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(payload).toMatchObject({
      actionText: 'Acao unidades',
      scope: {
        unitApplicability: 'selected_units',
        unitIds: ['unit-x', 'unit-y'],
      },
    });
  });

  it('edita plano selected_units da lista', async () => {
    const user = userEvent.setup();
    updateActionPlanMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        data: {
          ...actionPlans[1],
          actionText: 'Plano selected editado',
          version: 2,
        },
      })
    );
    renderActionPlans();
    await waitFor(() => expect(screen.getByText('Plano selected')).toBeInTheDocument());
    await user.click(screen.getAllByRole('button', { name: 'Editar' })[1]);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Organizacao (unidades selecionadas)')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('unitIds (virgula ou espaco)')).toHaveValue('unit-a');
    const actionInput = screen.getByPlaceholderText('Acao');
    await user.clear(actionInput);
    await user.type(actionInput, 'Plano selected editado');
    await user.click(screen.getByRole('button', { name: 'Salvar alteracoes' }));
    await waitFor(() => expect(updateActionPlanMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateActionPlanMock.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(payload).toMatchObject({
      actionPlanId: 'plan-selected',
      actionText: 'Plano selected editado',
      scope: {
        unitApplicability: 'selected_units',
        unitIds: ['unit-a'],
      },
    });
    await waitFor(() => {
      expect(screen.getByText(/Plano de acao atualizado/i)).toBeInTheDocument();
    });
  });

  it('preserva formulario apos erro e nao mostra sucesso (P3)', async () => {
    const user = userEvent.setup();
    createActionPlanMock.mockImplementationOnce(() =>
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
    renderActionPlans();
    await waitFor(() => expect(screen.getByText('Reforcar comunicacao')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nova ação' }));
    await user.type(screen.getByPlaceholderText('Indicador de origem'), 'Origem local');
    await user.type(screen.getByPlaceholderText('Problema / descricao'), 'Problema mantido');
    await user.type(screen.getByPlaceholderText('Acao'), 'Acao mantida');
    await user.click(screen.getByRole('button', { name: 'Criar plano' }));
    await waitFor(() => expect(screen.getByText(/Falha tecnica/i)).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Indicador de origem')).toHaveValue('Origem local');
    expect(screen.getByPlaceholderText('Problema / descricao')).toHaveValue('Problema mantido');
    expect(screen.getByPlaceholderText('Acao')).toHaveValue('Acao mantida');
    expect(screen.queryByText(/Plano de acao criado/i)).not.toBeInTheDocument();
  });

  it('previne duplo envio no create', async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: CollectiveResult<ActionPlanRecord>) => void) | undefined;
    createActionPlanMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    renderActionPlans();
    await waitFor(() => expect(screen.getByText('Reforcar comunicacao')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Nova ação' }));
    await user.type(screen.getByPlaceholderText('Indicador de origem'), 'Duplo');
    await user.type(screen.getByPlaceholderText('Problema / descricao'), 'Prob');
    await user.type(screen.getByPlaceholderText('Acao'), 'Acao dupla');
    await user.click(screen.getByRole('button', { name: 'Criar plano' }));
    await user.click(screen.getByRole('button', { name: 'Criar plano' }));
    expect(createActionPlanMock).toHaveBeenCalledTimes(1);
    resolveCreate?.({
      ok: true,
      data: { ...actionPlans[0], id: 'plan-dup', actionText: 'Acao dupla' },
    });
    await waitFor(() => expect(createActionPlanMock).toHaveBeenCalledTimes(1));
  });


  it('limpa sucesso anterior quando exclusao de plano falha (issue #25)', async () => {
    const user = userEvent.setup();
    renderActionPlans();
    await waitFor(() => expect(screen.getByText('Reforcar comunicacao')).toBeInTheDocument());
    await user.click(screen.getAllByRole('button', { name: 'Atualizar status' })[0]);
    await waitFor(() => {
      expect(screen.getByText(/Status atualizado para Concluido/i)).toBeInTheDocument();
    });
    deleteActionPlanMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        error: {
          code: 'TECHNICAL_ERROR',
          kind: 'technical',
          transient: true,
          message: 'delete failed',
        },
      })
    );
    await user.click(screen.getAllByRole('button', { name: 'Excluir' })[0]);
    await waitFor(() => expect(screen.getByText(/Falha tecnica/i)).toBeInTheDocument());
    expect(screen.queryByText(/Status atualizado para Concluido/i)).not.toBeInTheDocument();
  });

  it('bloqueia escrita para auditor', async () => {
    setSession('auditor');
    renderActionPlans();
    await waitFor(() => expect(screen.getByText('Reforcar comunicacao')).toBeInTheDocument());
    expect(screen.getByText(/leitura coletiva apenas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova ação' })).toBeDisabled();
    for (const btn of screen.getAllByRole('button', { name: 'Editar' })) {
      expect(btn).toBeDisabled();
    }
    expect(updateActionPlanMock).not.toHaveBeenCalled();
    expect(deleteActionPlanMock).not.toHaveBeenCalled();
  });
});
