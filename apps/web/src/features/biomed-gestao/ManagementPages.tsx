import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { listAuditEvents } from '@/domains/audit/auditTrail';
import { collectiveIndicators, riskDistribution } from '@/services/repositories/demoData';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { Alert } from '@/shared/ui/alert';

export function ManagementOverviewPage() {
  return (
    <div className="space-y-4">
      <Alert>
        Gestao institucional acessa somente indicadores coletivos. Dados clinicos individuais sao
        bloqueados.
      </Alert>
      <Card className="space-y-2">
        <CardTitle>Painel executivo</CardTitle>
        <CardDescription>Visao coletiva de adesao e engajamento.</CardDescription>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {collectiveIndicators.map((indicator) => (
            <div key={indicator.label} className="rounded-lg border bg-[var(--secondary)] p-3">
              <p className="text-xs text-[var(--muted-foreground)]">{indicator.label}</p>
              <p className="text-xl font-semibold">{indicator.value}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="space-y-2">
        <CardTitle>Distribuicao agregada de risco</CardTitle>
        <CardDescription>Grafico acompanhado de leitura textual acessivel.</CardDescription>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="faixa" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="quantidade" fill="#075E54" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Baixo: 280, Moderado: 170, Atencao: 47 (dados ficticios).
        </p>
      </Card>
    </div>
  );
}

export function ManagementCampaignsPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Campanhas</CardTitle>
      <CardDescription>Estados: rascunho, agendada, ativa, encerrada, cancelada.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">Semana do Sono - ativa</li>
        <li className="rounded-lg border p-2">Movimente-se com Saude - agendada</li>
      </ul>
    </Card>
  );
}

export function ManagementActionPlanPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Plano de acao</CardTitle>
      <CardDescription>Origem: indicador de baixa adesao no programa cardiovascular.</CardDescription>
      <p className="text-sm">
        Acao: reforcar comunicacao preventiva por unidade. Responsavel: gestao de saude. Prazo: 30
        dias. Situacao: em andamento.
      </p>
    </Card>
  );
}

export function ManagementAuditPage() {
  const events = listAuditEvents();
  return (
    <Card className="space-y-2">
      <CardTitle>Auditoria (somente leitura)</CardTitle>
      <CardDescription>
        Eventos de demonstracao: login, logout, negacao de rota e falhas de autenticacao.
      </CardDescription>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Data/hora</th>
              <th className="p-2">Usuario</th>
              <th className="p-2">Perfil</th>
              <th className="p-2">Acao</th>
              <th className="p-2">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td className="p-2 text-[var(--muted-foreground)]" colSpan={5}>
                  Nenhum evento de auditoria registrado nesta sessao.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="border-b">
                  <td className="p-2">{new Date(event.timestamp).toLocaleString('pt-BR')}</td>
                  <td className="p-2">{event.actorEmail}</td>
                  <td className="p-2">{event.actorRole}</td>
                  <td className="p-2">{event.action}</td>
                  <td className="p-2">{event.result}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
