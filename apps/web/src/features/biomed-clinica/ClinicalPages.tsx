import { useState } from 'react';
import { NavLink } from 'react-router';
import { canProfessionalAccessUser } from '@/app/routes/guards';
import { useAuth } from '@/services/auth/AuthContext';
import { clinicalPatients } from '@/services/repositories/demoData';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';

export function ClinicalOverviewPage() {
  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader />
      <Card className="space-y-3">
      <CardTitle>Painel profissional</CardTitle>
      <CardDescription>Agenda, carteira de usuários vinculados e plano de cuidado.</CardDescription>
      <div className="grid gap-2 sm:grid-cols-3">
        <Info label="Atendimentos hoje" value="4" />
        <Info label="Usuários vinculados" value="4" />
        <Info label="Reavaliações pendentes" value="2" />
      </div>
      <div className="rounded-xl border p-3">
        <p className="text-sm font-semibold">Próximos atendimentos</p>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="flex items-center justify-between rounded-lg bg-[var(--secondary)] p-2">
            <span>09:00 • Ana Demo • Reavaliação preventiva</span>
            <span className="status-badge status-warning">Confirmado</span>
          </li>
          <li className="flex items-center justify-between rounded-lg bg-[var(--secondary)] p-2">
            <span>11:00 • Carlos Exemplo • Acompanhamento de rotina</span>
            <span className="status-badge status-info">Solicitado</span>
          </li>
        </ul>
      </div>
      </Card>
    </div>
  );
}

export function ClinicalAgendaPage() {
  const [dateFilter, setDateFilter] = useState('hoje');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [message, setMessage] = useState('');
  const agendaRows = [
    { hora: '09:00', usuario: 'Ana Demo', tipo: 'Consulta preventiva', status: 'Confirmado' },
    { hora: '11:00', usuario: 'Carlos Exemplo', tipo: 'Reavaliação', status: 'Solicitado' },
    { hora: '14:30', usuario: 'Elisa Fictícia', tipo: 'Acompanhamento', status: 'Concluído' },
  ];

  const rows = agendaRows.filter((row) => {
    const statusMatch = statusFilter === 'todos' || row.status.toLowerCase() === statusFilter;
    const typeMatch = typeFilter === 'todos' || row.tipo.toLowerCase().includes(typeFilter);
    return statusMatch && typeMatch;
  });

  return (
    <Card className="space-y-3">
      <CardTitle>Agenda</CardTitle>
      <CardDescription>Estados: Solicitado, Confirmado, Concluído, Cancelado e Ausência.</CardDescription>
      <div className="grid gap-2 sm:grid-cols-3">
        <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="hoje">Hoje</option>
          <option value="semana">Esta semana</option>
        </select>
        <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="solicitado">Solicitado</option>
          <option value="confirmado">Confirmado</option>
          <option value="concluído">Concluído</option>
        </select>
        <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          <option value="preventiva">Preventiva</option>
          <option value="reavaliação">Reavaliação</option>
          <option value="acompanhamento">Acompanhamento</option>
        </select>
      </div>
      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={`${row.hora}-${row.usuario}`} className="rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {row.hora} • {row.usuario}
              </p>
              <span className={`status-badge ${row.status === 'Concluído' ? 'status-success' : row.status === 'Confirmado' ? 'status-warning' : 'status-info'}`}>
                {row.status}
              </span>
            </div>
            <p className="text-[var(--muted-foreground)]">{row.tipo}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setMessage(`Atendimento de ${row.usuario} aberto em modo demonstração.`)}>
                Ver atendimento
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMessage(`Status de ${row.usuario} atualizado em modo demonstração.`)}>
                Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMessage(`Reagendamento de ${row.usuario} registrado em modo demonstração.`)}>
                Reagendar
              </Button>
              <Button size="sm" onClick={() => setMessage(`Registro de atendimento iniciado para ${row.usuario}.`)}>
                Registrar atendimento
              </Button>
            </div>
          </div>
        ))}
      </div>
      {message ? <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm">{message}</p> : null}
    </Card>
  );
}

export function ClinicalPortfolioPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'todos' | 'Em acompanhamento' | 'Atenção' | 'Estável'>('todos');

  const allowedIds = user ? clinicalPatients.filter((p) => canProfessionalAccessUser(user.id, p.id)).map((p) => p.id) : [];
  const list = clinicalPatients
    .filter((p) => allowedIds.includes(p.id))
    .filter((p) => p.nome.toLowerCase().includes(query.toLowerCase()))
    .filter((p) => status === 'todos' || p.statusAcompanhamento === status);

  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader />
      <Card className="space-y-3">
      <CardTitle>Minha carteira</CardTitle>
      <CardDescription>Exibe apenas usuários vinculados ao profissional logado.</CardDescription>
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <input
          className="focus-ring h-10 rounded-xl border px-3 text-sm"
          placeholder="Buscar usuário vinculado"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="focus-ring h-10 rounded-xl border px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="todos">Todos os status</option>
          <option value="Em acompanhamento">Em acompanhamento</option>
          <option value="Atenção">Atenção</option>
          <option value="Estável">Estável</option>
        </select>
      </div>
      <div className="grid gap-2">
        {list.map((patient) => (
          <article key={patient.id} className="rounded-xl border bg-white p-3 text-sm shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{patient.nome}</p>
              <span className={`status-badge ${patient.statusAcompanhamento === 'Atenção' ? 'status-warning' : patient.statusAcompanhamento === 'Estável' ? 'status-success' : 'status-info'}`}>
                {patient.statusAcompanhamento}
              </span>
            </div>
            <p className="text-[var(--muted-foreground)]">
              Faixa etária: {patient.faixaEtaria} • Jornada: {patient.jornadaAtiva}
            </p>
            <p className="text-[var(--muted-foreground)]">Última avaliação: {patient.ultimaAvaliacao}</p>
            <p>Próxima ação: {patient.proximaAcao}</p>
            <Button className="mt-2" size="sm" asChild>
              <NavLink to="/clinica/avaliacoes">Abrir acompanhamento</NavLink>
            </Button>
          </article>
        ))}
      </div>
      </Card>
    </div>
  );
}

export function ClinicalRecordPage() {
  const [editing, setEditing] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader />
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Ficha clínica demonstrativa</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Visualizar' : 'Editar ficha'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(false);
                setSavedMessage('Registro concluído em modo demonstração.');
              }}
            >
              Concluir registro
            </Button>
          </div>
        </div>
        <CardDescription>Última atualização: 29/07/2026 • Dados fictícios.</CardDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Identificação', 'Usuário fictício, jornada preventiva ativa.'],
            ['Motivo do acompanhamento', 'Reforçar rotina de sono e autocuidado.'],
            ['Hábitos e rotina', 'Relata rotina parcialmente organizada.'],
            ['Sono', 'Média de 6h por noite com variação semanal.'],
            ['Atividade física', 'Caminhadas 2 a 3 vezes por semana.'],
            ['Alimentação percebida', 'Busca regularidade de horários.'],
            ['Bem-estar', 'Estresse moderado em períodos de trabalho intenso.'],
            ['Conduta orientativa', 'Acompanhamento preventivo e conteúdo educativo.'],
          ].map(([title, value]) => (
            <section key={title} className="rounded-xl border p-3 text-sm">
              <p className="font-semibold">{title}</p>
              {editing ? (
                <textarea className="focus-ring mt-2 min-h-20 w-full rounded-lg border p-2" defaultValue={value} />
              ) : (
                <p className="mt-1 text-[var(--muted-foreground)]">{value}</p>
              )}
            </section>
          ))}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSavedMessage('Rascunho salvo em memória para demonstração.')}>
              Salvar rascunho
            </Button>
          </div>
        ) : null}
        {savedMessage ? <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm">{savedMessage}</p> : null}
      </Card>
    </div>
  );
}

export function ClinicalAssessmentPage() {
  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader />
      <Card className="space-y-2">
        <CardTitle>Avaliações do usuário vinculado</CardTitle>
        <CardDescription>Histórico orientativo com reavaliação preventiva.</CardDescription>
        <div className="space-y-2 text-sm">
          <article className="rounded-lg border p-2">
            <p className="font-semibold">Avaliação inicial — versão 1.0</p>
            <p>Data: 29/07/2026 • Profissional: Dr. Lucas Demo • Status: Concluída</p>
            <p>Resultado orientativo: acompanhamento preventivo recomendado.</p>
            <Button size="sm" className="mt-2" variant="outline">Ver detalhes</Button>
          </article>
          <article className="rounded-lg border p-2">
            <p className="font-semibold">Reavaliação de rotina — versão 1.0</p>
            <p>Data prevista: 26/08/2026 • Status: Programada</p>
          </article>
        </div>
      </Card>
    </div>
  );
}

export function ClinicalCarePlanPage() {
  const [items, setItems] = useState([
    {
      id: 'plan-1',
      objetivo: 'Melhorar rotina de sono',
      status: 'Em andamento',
      prazo: '26/08/2026',
      reavaliacao: '30/08/2026',
    },
  ]);

  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader />
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Plano de cuidado</CardTitle>
          <Button size="sm" onClick={() => setItems((current) => [...current, { id: `plan-${current.length + 1}`, objetivo: 'Aumentar frequência de movimento', status: 'Planejado', prazo: '15/09/2026', reavaliacao: '20/09/2026' }])}>
            Adicionar objetivo
          </Button>
        </div>
        <CardDescription>Objetivos, ações, responsável e reavaliação.</CardDescription>
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border p-3 text-sm">
            <p className="font-semibold">{item.objetivo}</p>
            <p className="text-[var(--muted-foreground)]">Responsável: equipe clínica demo</p>
            <p>Status: {item.status} • Prazo: {item.prazo}</p>
            <p>Reavaliação: {item.reavaliacao}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline">Editar</Button>
              <Button size="sm" variant="secondary">Atualizar status</Button>
              <Button size="sm" variant="outline">Registrar evolução</Button>
            </div>
          </article>
        ))}
      </Card>
    </div>
  );
}

export function ClinicalAttendanceRecordPage() {
  const [records, setRecords] = useState([
    {
      id: 'reg-1',
      data: '29/07/2026 09:00',
      profissional: 'Dr. Lucas Demo',
      tipo: 'Acompanhamento preventivo',
      resumo: 'Reforço de rotina de sono e hidratação.',
      proximaAcao: 'Reavaliação em 30 dias',
      status: 'Concluído',
    },
  ]);

  return (
    <div className="space-y-4">
      <ClinicalPatientContextHeader />
      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Registros assistenciais</CardTitle>
          <Button size="sm" onClick={() => setRecords((prev) => [{ id: `reg-${prev.length + 1}`, data: 'Hoje 15:30', profissional: 'Carla Profissional', tipo: 'Contato de acompanhamento', resumo: 'Orientação sobre organização de rotina.', proximaAcao: 'Retorno em 15 dias', status: 'Em andamento' }, ...prev])}>
            Novo registro
          </Button>
        </div>
        <CardDescription>Linha do tempo demonstrativa sem conteúdo sensível real.</CardDescription>
        <div className="space-y-2">
          {records.map((record) => (
            <article key={record.id} className="rounded-xl border p-3 text-sm">
              <p className="font-semibold">{record.data} • {record.tipo}</p>
              <p>{record.resumo}</p>
              <p className="text-[var(--muted-foreground)]">Profissional: {record.profissional}</p>
              <p>Próxima ação: {record.proximaAcao}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className={`status-badge ${record.status === 'Concluído' ? 'status-success' : 'status-warning'}`}>{record.status}</span>
                <Button size="sm" variant="outline">Ver registro</Button>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-[var(--secondary)] p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function ClinicalPatientContextHeader() {
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Dados fictícios</p>
          <h3 className="text-lg font-semibold">Ana Demo • Faixa etária 35-44</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            ID demonstrativo: BM-CLI-001 • Jornada ativa: Bem-estar e Prevenção
          </p>
        </div>
        <span className="status-badge status-info">Acompanhamento ativo</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <NavLink to="/clinica" className={tabLinkClass}>Resumo</NavLink>
        <NavLink to="/clinica/avaliacoes" className={tabLinkClass}>Avaliações</NavLink>
        <NavLink to="/clinica/ficha" className={tabLinkClass}>Ficha clínica</NavLink>
        <NavLink to="/clinica/plano-cuidado" className={tabLinkClass}>Plano de cuidado</NavLink>
        <NavLink to="/clinica/registros" className={tabLinkClass}>Registros</NavLink>
      </div>
    </Card>
  );
}

function tabLinkClass({ isActive }: { isActive: boolean }) {
  return `focus-ring rounded-lg px-3 py-1 text-sm ${
    isActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--secondary)] text-[var(--secondary-foreground)]'
  }`;
}
