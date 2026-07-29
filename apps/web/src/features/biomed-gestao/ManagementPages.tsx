import { useMemo, useState } from 'react';
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
import { collectiveIndicators, programDistribution, riskDistribution, roleLabel, trendByMonth } from '@/services/repositories/demoData';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { Alert } from '@/shared/ui/alert';

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
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');
  const [message, setMessage] = useState('');
  const campaigns = [
    { nome: 'Semana do Sono', objetivo: 'Aumentar adesão às rotinas de sono', publico: 'Adultos ativos', periodo: '01/08 a 15/08', status: 'Ativa', adesao: '68%', responsavel: 'Marina Gestora' },
    { nome: 'Movimente-se com Saúde', objetivo: 'Incentivar atividade física leve', publico: 'Programa cardiovascular', periodo: '16/08 a 31/08', status: 'Agendada', adesao: '—', responsavel: 'Helena SST' },
    { nome: 'Prevenção no Trabalho', objetivo: 'Reduzir sedentarismo ocupacional', publico: 'Unidade Norte', periodo: '01/07 a 30/07', status: 'Encerrada', adesao: '74%', responsavel: 'Paulo Admin Cliente' },
  ];
  const filtered = campaigns.filter((item) => (status === 'todos' || item.status === status) && item.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="space-y-3">
      <CardTitle>Campanhas</CardTitle>
      <CardDescription>Estados: Rascunho, Agendada, Ativa, Encerrada e Cancelada.</CardDescription>
      <div className="grid gap-2 sm:grid-cols-[1fr_240px_auto]">
        <input className="focus-ring h-10 rounded-xl border px-3 text-sm" placeholder="Buscar campanha" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="Rascunho">Rascunho</option>
          <option value="Agendada">Agendada</option>
          <option value="Ativa">Ativa</option>
          <option value="Encerrada">Encerrada</option>
          <option value="Cancelada">Cancelada</option>
        </select>
        <Button size="sm" onClick={() => setMessage('Nova campanha criada em modo demonstração.')}>Nova campanha</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Nome</th>
              <th className="p-2">Objetivo</th>
              <th className="p-2">Público elegível</th>
              <th className="p-2">Período</th>
              <th className="p-2">Status</th>
              <th className="p-2">Adesão</th>
              <th className="p-2">Responsável</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.nome} className="border-b">
                <td className="p-2">{item.nome}</td>
                <td className="p-2">{item.objetivo}</td>
                <td className="p-2">{item.publico}</td>
                <td className="p-2">{item.periodo}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">{item.adesao}</td>
                <td className="p-2">{item.responsavel}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => setMessage(`Edição da campanha "${item.nome}" aberta em modo demonstração.`)}>Editar</Button>
                    <Button size="sm" variant="outline" onClick={() => setMessage(`Campanha "${item.nome}" duplicada em modo demonstração.`)}>Duplicar</Button>
                    <Button size="sm" variant="secondary" onClick={() => setMessage(`Campanha "${item.nome}" encerrada em modo demonstração.`)}>Encerrar</Button>
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
  const [statusFilter, setStatusFilter] = useState('todos');
  const plans = [
    { origem: 'Adesão ao programa', problema: 'Baixa participação na unidade norte', acao: 'Reforçar comunicação segmentada', responsavel: 'Marina Gestora', prazo: '15/08/2026', prioridade: 'Alta', status: 'Em andamento', indicador: 'Adesão semanal', atualizacao: '29/07/2026' },
    { origem: 'Conclusão de avaliações', problema: 'Queda de conclusão no turno noturno', acao: 'Ajustar janela de atendimento', responsavel: 'Helena SST', prazo: '20/08/2026', prioridade: 'Média', status: 'Planejado', indicador: 'Conclusão mensal', atualizacao: '28/07/2026' },
  ];
  const filtered = plans.filter((plan) => statusFilter === 'todos' || plan.status === statusFilter);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Plano de ação coletivo</CardTitle>
        <div className="flex gap-2">
          <select className="focus-ring h-9 rounded-lg border px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="Planejado">Planejado</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluído">Concluído</option>
          </select>
          <Button size="sm">Nova ação</Button>
        </div>
      </div>
      <div className="grid gap-2">
        {filtered.map((plan, index) => (
          <article key={`${plan.acao}-${index}`} className="rounded-xl border p-3 text-sm">
            <p className="font-semibold">{plan.acao}</p>
            <p>{plan.problema}</p>
            <p className="text-[var(--muted-foreground)]">
              Origem: {plan.origem} • Responsável: {plan.responsavel}
            </p>
            <p>
              Prazo: {plan.prazo} • Prioridade: {plan.prioridade} • Status: {plan.status}
            </p>
            <p>Indicador de acompanhamento: {plan.indicador}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Última atualização: {plan.atualizacao}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline">Editar</Button>
              <Button size="sm" variant="secondary">Atualizar status</Button>
              <Button size="sm" variant="outline">Ver histórico</Button>
            </div>
          </article>
        ))}
      </div>
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
