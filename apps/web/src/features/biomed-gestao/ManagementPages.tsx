import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { listAuditEvents } from '@/domains/audit/auditTrail';
import type { CollectiveScope } from '@/domains/collective';
import {
  canWriteCollective,
  formatPeriod,
  formatScopeLabel,
  sanitizeCollectiveUiMessage,
} from '@/features/biomed-gestao/collectiveUi';
import { getSupabaseClient } from '@/services/api/supabaseClient';
import { useAuth } from '@/services/auth/AuthContext';
import {
  createCollectiveRepositoryFactory,
  resolveCollectiveRepositoryMode,
  type ActionPlanRecord,
  type CampaignRecord,
  type CollectiveContext,
  type CollectiveRepository,
  type SupabaseCollectiveClient,
} from '@/services/repositories/collective';
import { collectiveIndicators, programDistribution, riskDistribution, roleLabel, trendByMonth } from '@/services/repositories/demoData';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { Alert } from '@/shared/ui/alert';

type RepositoryBootstrap =
  | { ok: true; mode: 'mock' | 'supabase'; repository: CollectiveRepository }
  | { ok: false; message: string };

function bootstrapCollectiveRepository(): RepositoryBootstrap {
  try {
    const mode = resolveCollectiveRepositoryMode(import.meta.env);
    if (mode === 'mock') {
      return { ok: true, mode, repository: createCollectiveRepositoryFactory({ mode: 'mock' }) };
    }
    const client = getSupabaseClient() as unknown as SupabaseCollectiveClient | null;
    if (!client) {
      return {
        ok: false,
        message: 'Modo Supabase ativo sem cliente configurado. Gestao coletiva indisponivel (fail-closed).',
      };
    }
    return {
      ok: true,
      mode,
      repository: createCollectiveRepositoryFactory({ mode: 'supabase', supabaseClient: client }),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Configuracao invalida do repository coletivo.';
    return { ok: false, message };
  }
}

function buildCollectiveContext(user: { id: string; organizationId: string } | null): CollectiveContext | null {
  if (!user?.id || !user.organizationId) return null;
  return { userId: user.id, organizationId: user.organizationId, selectedUnitId: null };
}

function buildSingleTableScope(input: {
  scopeKind: 'all_units' | 'unit';
  unitId: string;
}): { ok: true; scope: CollectiveScope } | { ok: false; message: string } {
  if (input.scopeKind === 'all_units') {
    return {
      ok: true,
      scope: { scopeType: 'organization', unitId: null, unitApplicability: 'all_units' },
    };
  }
  const unitId = input.unitId.trim();
  if (!unitId) {
    return {
      ok: false,
      message:
        'Escopo unitario exige unitId explicito no formulario. selectedUnitId de sessao nao esta disponivel no D01-C.',
    };
  }
  return { ok: true, scope: { scopeType: 'unit', unitId } };
}

export function ManagementOverviewPage() {
  const [period, setPeriod] = useState('30d');
  const [unit, setUnit] = useState('geral');
  const [program, setProgram] = useState('todos');

  return (
    <div className="space-y-4">
      <Alert>
        A área de Gestão apresenta exclusivamente informações coletivas e agregadas. Dados clínicos
        individuais não estão disponíveis neste ambiente.
      </Alert>
      <Card className="space-y-3">
        <CardTitle>Painel executivo</CardTitle>
        <CardDescription>Visão coletiva de adesão e engajamento.</CardDescription>
        <div className="grid gap-2 sm:grid-cols-3">
          <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
          <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="geral">Todas as unidades</option>
            <option value="norte">Unidade Norte</option>
            <option value="sul">Unidade Sul</option>
          </select>
          <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="todos">Todos os programas</option>
            <option value="sono">Sono e recuperação</option>
            <option value="cardio">Saúde cardiovascular</option>
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {collectiveIndicators.map((indicator) => (
            <div key={indicator.label} className="rounded-lg border bg-[var(--secondary)] p-3" title={indicator.description}>
              <p className="text-xs text-[var(--muted-foreground)]">{indicator.label}</p>
              <p className="text-xl font-semibold">{indicator.value}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{indicator.variation} • {indicator.reference}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="space-y-2">
        <CardTitle>Distribuição agregada de risco</CardTitle>
        <CardDescription>Gráfico acompanhado de leitura textual acessível.</CardDescription>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="faixa" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantidade" fill="#075E54" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Baixo: 280, Moderado: 170, Atenção: 47 (dados fictícios). Referência: {period === '30d' ? 'últimos 30 dias' : 'últimos 90 dias'}.
        </p>
      </Card>
      <Card className="space-y-2">
        <CardTitle>Adesão e conclusão ao longo do tempo</CardTitle>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="adesao" stroke="#075E54" />
              <Line type="monotone" dataKey="avaliacoes" stroke="#1d4f91" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="space-y-2">
        <CardTitle>Indicadores agregados</CardTitle>
        <CardDescription>Visão analítica de adesão, engajamento e campanhas por programa.</CardDescription>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Programa</th>
                <th className="p-2">Adesão</th>
                <th className="p-2">Engajamento</th>
                <th className="p-2">Avaliações concluídas</th>
              </tr>
            </thead>
            <tbody>
              {programDistribution.map((row) => (
                <tr key={row.programa} className="border-b">
                  <td className="p-2">{row.programa}</td>
                  <td className="p-2">{row.adesao}</td>
                  <td className="p-2">{Math.round(row.adesao * 0.71)}</td>
                  <td className="p-2">{Math.round(row.adesao * 0.59)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="space-y-2">
        <CardTitle>Distribuição coletiva por programa</CardTitle>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={programDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="programa" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="adesao" fill="#3b8b7f" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          Dados agrupados por programa e unidade fictícia, sem detalhamento individual.
        </p>
      </Card>
    </div>
  );
}

export function ManagementCampaignsPage() {
  const { user } = useAuth();
  const bootstrap = useMemo(() => bootstrapCollectiveRepository(), []);
  const context = useMemo(() => buildCollectiveContext(user), [user]);
  const canWrite = canWriteCollective(user?.role);
  const submittingRef = useRef(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState('email');
  const [startsAt, setStartsAt] = useState('2026-08-01');
  const [endsAt, setEndsAt] = useState('2026-08-15');
  const [scopeKind, setScopeKind] = useState<'all_units' | 'unit'>('all_units');
  const [unitId, setUnitId] = useState('');

  async function loadCampaigns(repo: CollectiveRepository, ctx: CollectiveContext) {
    setLoading(true);
    setError(null);
    const result = await repo.listCampaigns({
      context: ctx,
      campaignStatus: status === 'todos' ? undefined : status,
      search: search.trim() || undefined,
    });
    if (!result.ok) {
      setCampaigns([]);
      setError(sanitizeCollectiveUiMessage(result.error));
      setLoading(false);
      return;
    }
    setCampaigns(result.data);
    setLoading(false);
  }

  useEffect(() => {
    if (!bootstrap.ok) {
      setLoading(false);
      setError(bootstrap.message);
      return;
    }
    if (!context) {
      setLoading(false);
      setCampaigns([]);
      setError('Sessao ausente para gestao coletiva.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void bootstrap.repository
      .listCampaigns({
        context,
        campaignStatus: status === 'todos' ? undefined : status,
        search: search.trim() || undefined,
      })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setCampaigns([]);
          setError(sanitizeCollectiveUiMessage(result.error));
          setLoading(false);
          return;
        }
        setCampaigns(result.data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrap, context, search, status]);

  async function reloadCampaigns() {
    if (!bootstrap.ok || !context) return;
    await loadCampaigns(bootstrap.repository, context);
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setChannel('email');
    setStartsAt('2026-08-01');
    setEndsAt('2026-08-15');
    setScopeKind('all_units');
    setUnitId('');
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
    setMessage('');
    setError(null);
  }

  function openEdit(campaign: CampaignRecord) {
    setEditingId(campaign.id);
    setTitle(campaign.title);
    setDescription(campaign.description);
    setChannel(campaign.channel);
    setStartsAt(campaign.startsAt);
    setEndsAt(campaign.endsAt);
    if (campaign.scope.scopeType === 'unit') {
      setScopeKind('unit');
      setUnitId(campaign.scope.unitId);
    } else {
      setScopeKind('all_units');
      setUnitId('');
      if (campaign.scope.unitApplicability === 'selected_units') {
        setMessage(
          'Campanha com selected_units: leitura ok; alteracao de escopo/audiencia bloqueada sem RPC atomica.'
        );
      }
    }
    setShowForm(true);
    setError(null);
  }

  async function submitForm() {
    if (!bootstrap.ok || !context || submittingRef.current || !canWrite) return;
    const scoped = buildSingleTableScope({ scopeKind, unitId });
    if (!scoped.ok) {
      setError(scoped.message);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        const result = await bootstrap.repository.updateCampaign(context, {
          organizationId: context.organizationId,
          campaignId: editingId,
          title,
          description,
          channel,
          startsAt,
          endsAt,
          scope: scoped.scope,
        });
        if (!result.ok) {
          setError(sanitizeCollectiveUiMessage(result.error));
          return;
        }
        setMessage(`Campanha "${result.data.title}" atualizada.`);
      } else {
        const result = await bootstrap.repository.createCampaign(context, {
          organizationId: context.organizationId,
          title,
          description,
          channel,
          startsAt,
          endsAt,
          scope: scoped.scope,
        });
        if (!result.ok) {
          setError(sanitizeCollectiveUiMessage(result.error));
          return;
        }
        setMessage(`Campanha "${result.data.title}" criada.`);
      }
      setShowForm(false);
      resetForm();
      await reloadCampaigns();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function closeCampaign(campaign: CampaignRecord) {
    if (!bootstrap.ok || !context || submittingRef.current || !canWrite) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await bootstrap.repository.updateCampaign(context, {
        organizationId: context.organizationId,
        campaignId: campaign.id,
        campaignStatus: 'Encerrada',
      });
      if (!result.ok) {
        setError(sanitizeCollectiveUiMessage(result.error));
        return;
      }
      setMessage(`Campanha "${campaign.title}" encerrada.`);
      await reloadCampaigns();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function removeCampaign(campaign: CampaignRecord) {
    if (!bootstrap.ok || !context || submittingRef.current || !canWrite) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await bootstrap.repository.deleteCampaign(context, campaign.id);
      if (!result.ok) {
        setError(sanitizeCollectiveUiMessage(result.error));
        return;
      }
      setMessage(`Campanha "${campaign.title}" excluida.`);
      await reloadCampaigns();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-3">
      <CardTitle>Campanhas</CardTitle>
      <CardDescription>
        Persistencia via repository coletivo ({bootstrap.ok ? bootstrap.mode : 'indisponivel'}). Escopos
        single-table: organization/all_units e unit. selected_units e audiencias exigem RPC (fora do D01-C).
      </CardDescription>
      <div className="grid gap-2 sm:grid-cols-[1fr_240px_auto]">
        <input
          className="focus-ring h-10 rounded-xl border px-3 text-sm"
          placeholder="Buscar campanha"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="focus-ring h-10 rounded-xl border px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="todos">Todos os status</option>
          <option value="Rascunho">Rascunho</option>
          <option value="Agendada">Agendada</option>
          <option value="Ativa">Ativa</option>
          <option value="Encerrada">Encerrada</option>
          <option value="Cancelada">Cancelada</option>
        </select>
        <Button size="sm" disabled={!canWrite || !bootstrap.ok || submitting} onClick={openCreate}>
          Nova campanha
        </Button>
      </div>
      {!canWrite ? (
        <Alert>Perfil com leitura coletiva apenas. Escrita desabilitada na interface.</Alert>
      ) : null}
      {loading ? <p className="text-sm text-[var(--muted-foreground)]">Carregando campanhas…</p> : null}
      {error ? <Alert>{error}</Alert> : null}
      {!loading && !error && campaigns.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">Nenhuma campanha autorizada neste escopo.</p>
      ) : null}
      {showForm ? (
        <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            placeholder="Titulo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            placeholder="Canal"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm sm:col-span-2"
            placeholder="Descricao / objetivo"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
          <select
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            value={scopeKind}
            onChange={(e) => setScopeKind(e.target.value as 'all_units' | 'unit')}
          >
            <option value="all_units">Organizacao / todas as unidades</option>
            <option value="unit">Unidade (unitId explicito)</option>
          </select>
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            placeholder="unitId (obrigatorio se escopo unit)"
            value={unitId}
            disabled={scopeKind !== 'unit'}
            onChange={(e) => setUnitId(e.target.value)}
          />
          <p className="sm:col-span-2 text-xs text-[var(--muted-foreground)]">
            selected_units e audiencia nao estao disponiveis sem operacao atomica autorizada.
          </p>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={submitting || !title.trim() || !description.trim()} onClick={() => void submitForm()}>
              {editingId ? 'Salvar alteracoes' : 'Criar campanha'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Nome</th>
              <th className="p-2">Objetivo</th>
              <th className="p-2">Escopo</th>
              <th className="p-2">Periodo</th>
              <th className="p-2">Status</th>
              <th className="p-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2">{item.title}</td>
                <td className="p-2">{item.description}</td>
                <td className="p-2">{formatScopeLabel(item.scope)}</td>
                <td className="p-2">{formatPeriod(item.startsAt, item.endsAt)}</td>
                <td className="p-2">{item.campaignStatus}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canWrite || submitting}
                      onClick={() => openEdit(item)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canWrite || submitting || item.campaignStatus === 'Encerrada'}
                      onClick={() => void closeCampaign(item)}
                    >
                      Encerrar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canWrite || submitting}
                      onClick={() => void removeCampaign(item)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm">{message}</p> : null}
    </Card>
  );
}

export function ManagementActionPlanPage() {
  const { user } = useAuth();
  const bootstrap = useMemo(() => bootstrapCollectiveRepository(), []);
  const context = useMemo(() => buildCollectiveContext(user), [user]);
  const canWrite = canWriteCollective(user?.role);
  const submittingRef = useRef(false);

  const [statusFilter, setStatusFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ActionPlanRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originIndicator, setOriginIndicator] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [actionText, setActionText] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [dueDate, setDueDate] = useState('2026-08-15');
  const [priority, setPriority] = useState('Media');
  const [scopeKind, setScopeKind] = useState<'all_units' | 'unit'>('all_units');
  const [unitId, setUnitId] = useState('');

  async function loadPlans(repo: CollectiveRepository, ctx: CollectiveContext) {
    setLoading(true);
    setError(null);
    const result = await repo.listActionPlans({
      context: ctx,
      actionStatus: statusFilter === 'todos' ? undefined : statusFilter,
    });
    if (!result.ok) {
      setPlans([]);
      setError(sanitizeCollectiveUiMessage(result.error));
      setLoading(false);
      return;
    }
    setPlans(result.data);
    setLoading(false);
  }

  useEffect(() => {
    if (!bootstrap.ok) {
      setLoading(false);
      setError(bootstrap.message);
      return;
    }
    if (!context) {
      setLoading(false);
      setPlans([]);
      setError('Sessao ausente para gestao coletiva.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void bootstrap.repository
      .listActionPlans({
        context,
        actionStatus: statusFilter === 'todos' ? undefined : statusFilter,
      })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setPlans([]);
          setError(sanitizeCollectiveUiMessage(result.error));
          setLoading(false);
          return;
        }
        setPlans(result.data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrap, context, statusFilter]);

  async function reloadPlans() {
    if (!bootstrap.ok || !context) return;
    await loadPlans(bootstrap.repository, context);
  }
  function resetForm() {
    setEditingId(null);
    setOriginIndicator('');
    setIssueDescription('');
    setActionText('');
    setOwnerName(user?.nome ?? '');
    setDueDate('2026-08-15');
    setPriority('Media');
    setScopeKind('all_units');
    setUnitId('');
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
    setMessage('');
    setError(null);
  }

  function openEdit(plan: ActionPlanRecord) {
    setEditingId(plan.id);
    setOriginIndicator(plan.originIndicator);
    setIssueDescription(plan.issueDescription);
    setActionText(plan.actionText);
    setOwnerName(plan.ownerName);
    setDueDate(plan.dueDate);
    setPriority(plan.priority);
    if (plan.scope.scopeType === 'unit') {
      setScopeKind('unit');
      setUnitId(plan.scope.unitId);
    } else {
      setScopeKind('all_units');
      setUnitId('');
    }
    setShowForm(true);
    setError(null);
  }

  async function submitForm() {
    if (!bootstrap.ok || !context || submittingRef.current || !canWrite) return;
    const scoped = buildSingleTableScope({ scopeKind, unitId });
    if (!scoped.ok) {
      setError(scoped.message);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        const result = await bootstrap.repository.updateActionPlan(context, {
          organizationId: context.organizationId,
          actionPlanId: editingId,
          originIndicator,
          issueDescription,
          actionText,
          ownerName,
          dueDate,
          priority,
          scope: scoped.scope,
        });
        if (!result.ok) {
          setError(sanitizeCollectiveUiMessage(result.error));
          return;
        }
        setMessage('Plano de acao atualizado.');
      } else {
        const result = await bootstrap.repository.createActionPlan(context, {
          organizationId: context.organizationId,
          originIndicator,
          issueDescription,
          actionText,
          ownerName,
          dueDate,
          priority,
          scope: scoped.scope,
        });
        if (!result.ok) {
          setError(sanitizeCollectiveUiMessage(result.error));
          return;
        }
        setMessage('Plano de acao criado.');
      }
      setShowForm(false);
      resetForm();
      await reloadPlans();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function advanceStatus(plan: ActionPlanRecord) {
    if (!bootstrap.ok || !context || submittingRef.current || !canWrite) return;
    const nextStatus =
      plan.actionStatus === 'Planejado'
        ? 'Em andamento'
        : plan.actionStatus === 'Em andamento'
          ? 'Concluido'
          : plan.actionStatus;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await bootstrap.repository.updateActionPlan(context, {
        organizationId: context.organizationId,
        actionPlanId: plan.id,
        actionStatus: nextStatus,
      });
      if (!result.ok) {
        setError(sanitizeCollectiveUiMessage(result.error));
        return;
      }
      setMessage(`Status atualizado para ${nextStatus}.`);
      await reloadPlans();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function removePlan(plan: ActionPlanRecord) {
    if (!bootstrap.ok || !context || submittingRef.current || !canWrite) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await bootstrap.repository.deleteActionPlan(context, plan.id);
      if (!result.ok) {
        setError(sanitizeCollectiveUiMessage(result.error));
        return;
      }
      setMessage('Plano de acao excluido.');
      await reloadPlans();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Plano de ação coletivo</CardTitle>
        <div className="flex gap-2">
          <select
            className="focus-ring h-9 rounded-lg border px-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos os status</option>
            <option value="Planejado">Planejado</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluido">Concluído</option>
          </select>
          <Button size="sm" disabled={!canWrite || !bootstrap.ok || submitting} onClick={openCreate}>
            Nova ação
          </Button>
        </div>
      </div>
      <CardDescription>
        Repository ({bootstrap.ok ? bootstrap.mode : 'indisponivel'}). Escritas single-table apenas; selected_units
        bloqueado sem RPC.
      </CardDescription>
      {!canWrite ? (
        <Alert>Perfil com leitura coletiva apenas. Escrita desabilitada na interface.</Alert>
      ) : null}
      {loading ? <p className="text-sm text-[var(--muted-foreground)]">Carregando planos…</p> : null}
      {error ? <Alert>{error}</Alert> : null}
      {!loading && !error && plans.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">Nenhum plano de acao autorizado neste escopo.</p>
      ) : null}
      {showForm ? (
        <div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            placeholder="Indicador de origem"
            value={originIndicator}
            onChange={(e) => setOriginIndicator(e.target.value)}
          />
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            placeholder="Responsavel"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm sm:col-span-2"
            placeholder="Problema / descricao"
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
          />
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm sm:col-span-2"
            placeholder="Acao"
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
          />
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <select
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="Alta">Alta</option>
            <option value="Media">Média</option>
            <option value="Baixa">Baixa</option>
          </select>
          <select
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            value={scopeKind}
            onChange={(e) => setScopeKind(e.target.value as 'all_units' | 'unit')}
          >
            <option value="all_units">Organizacao / todas as unidades</option>
            <option value="unit">Unidade (unitId explicito)</option>
          </select>
          <input
            className="focus-ring h-10 rounded-xl border px-3 text-sm"
            placeholder="unitId (obrigatorio se escopo unit)"
            value={unitId}
            disabled={scopeKind !== 'unit'}
            onChange={(e) => setUnitId(e.target.value)}
          />
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={
                submitting ||
                !originIndicator.trim() ||
                !issueDescription.trim() ||
                !actionText.trim() ||
                !ownerName.trim()
              }
              onClick={() => void submitForm()}
            >
              {editingId ? 'Salvar alteracoes' : 'Criar plano'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-2">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-xl border p-3 text-sm">
            <p className="font-semibold">{plan.actionText}</p>
            <p>{plan.issueDescription}</p>
            <p className="text-[var(--muted-foreground)]">
              Origem: {plan.originIndicator} • Responsavel: {plan.ownerName} • Escopo:{' '}
              {formatScopeLabel(plan.scope)}
            </p>
            <p>
              Prazo: {plan.dueDate} • Prioridade: {plan.priority} • Status: {plan.actionStatus}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Ultima atualizacao: {new Date(plan.updatedAt).toLocaleString('pt-BR')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!canWrite || submitting} onClick={() => openEdit(plan)}>
                Editar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!canWrite || submitting || plan.actionStatus === 'Concluido'}
                onClick={() => void advanceStatus(plan)}
              >
                Atualizar status
              </Button>
              <Button size="sm" variant="outline" disabled={!canWrite || submitting} onClick={() => void removePlan(plan)}>
                Excluir
              </Button>
            </div>
          </article>
        ))}
      </div>
      {message ? <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm">{message}</p> : null}
    </Card>
  );
}

export function ManagementIndicatorsPage() {
  return (
    <Card className="space-y-3">
      <CardTitle>Indicadores analíticos</CardTitle>
      <CardDescription>
        Comparativo agregado por unidade e programa, mantendo anonimização.
      </CardDescription>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Unidade</th>
              <th className="p-2">Programa</th>
              <th className="p-2">Adesão</th>
              <th className="p-2">Engajamento</th>
              <th className="p-2">Campanhas</th>
              <th className="p-2">Evolução</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-2">Norte</td>
              <td className="p-2">Bem-estar e Prevenção</td>
              <td className="p-2">72%</td>
              <td className="p-2">64%</td>
              <td className="p-2">3 ativas</td>
              <td className="p-2">+4,1%</td>
            </tr>
            <tr className="border-b">
              <td className="p-2">Sul</td>
              <td className="p-2">Saúde Cardiovascular</td>
              <td className="p-2">68%</td>
              <td className="p-2">59%</td>
              <td className="p-2">2 ativas</td>
              <td className="p-2">+2,7%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        Nenhuma informação identifica usuários individualmente.
      </p>
    </Card>
  );
}

export function ManagementAuditPage() {
  const events = listAuditEvents();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<'todos' | 'sucesso' | 'falha' | 'negado'>('todos');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const normalized = useMemo(
    () =>
      events
        .filter((event) => (result === 'todos' ? true : event.result === result))
        .filter((event) => `${event.actorEmail} ${event.action} ${event.entity}`.toLowerCase().includes(query.toLowerCase())),
    [events, result, query]
  );
  const maxPage = Math.max(1, Math.ceil(normalized.length / pageSize));
  const paged = normalized.slice((page - 1) * pageSize, page * pageSize);
  const selected = normalized.find((event) => event.id === selectedEventId) ?? null;

  return (
    <Card className="space-y-3">
      <CardTitle>Auditoria (somente leitura)</CardTitle>
      <CardDescription>
        Eventos de demonstração: login, logout, negação de rota e falhas de autenticação.
      </CardDescription>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <input className="focus-ring h-10 rounded-xl border px-3 text-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por usuário, ação ou recurso" />
        <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={result} onChange={(e) => setResult(e.target.value as typeof result)}>
          <option value="todos">Todos os resultados</option>
          <option value="sucesso">Sucesso</option>
          <option value="falha">Falha</option>
          <option value="negado">Acesso negado</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Data/hora</th>
              <th className="p-2">Usuario</th>
              <th className="p-2">Perfil</th>
              <th className="p-2">Organização</th>
              <th className="p-2">Acao</th>
              <th className="p-2">Recurso</th>
              <th className="p-2">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td className="p-2 text-[var(--muted-foreground)]" colSpan={7}>
                  Nenhum evento de auditoria registrado nesta sessão.
                </td>
              </tr>
            ) : (
              paged.map((event) => (
                <tr key={event.id} className="border-b hover:bg-[var(--secondary)] cursor-pointer" onClick={() => setSelectedEventId(event.id)}>
                  <td className="p-2">{new Date(event.timestamp).toLocaleString('pt-BR')}</td>
                  <td className="p-2">{event.actorEmail}</td>
                  <td className="p-2">{roleLabel((event.actorRole as Parameters<typeof roleLabel>[0]) ?? 'nao_autenticado')}</td>
                  <td className="p-2">{event.organizationId}</td>
                  <td className="p-2">{event.action}</td>
                  <td className="p-2">{event.entity}</td>
                  <td className="p-2">
                    <span className={`status-badge ${event.result === 'sucesso' ? 'status-success' : event.result === 'negado' ? 'status-warning' : 'status-info'}`}>
                      {event.result === 'sucesso' ? 'Sucesso' : event.result === 'negado' ? 'Acesso negado' : 'Falha'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <p>
          Página {page} de {maxPage}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(maxPage, p + 1))}>Próxima</Button>
        </div>
      </div>
      {selected ? (
        <div className="rounded-xl border bg-[var(--secondary)] p-3 text-sm">
          <p className="font-semibold">Detalhes do evento</p>
          <p>Usuário: {selected.actorEmail}</p>
          <p>Ação: {selected.action}</p>
          <p>Resultado: {selected.result}</p>
          <p>Código técnico: {selected.entity}</p>
          {selected.reason ? <p>Motivo técnico: {selected.reason}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
