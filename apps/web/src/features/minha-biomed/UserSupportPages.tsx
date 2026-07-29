import { Card, CardDescription, CardTitle } from '@/shared/ui/card';

export function UserJourneyPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Minha jornada - Bem-estar e Prevencao</CardTitle>
      <CardDescription>
        Publico elegivel: adultos ativos. Duracao: 8 semanas. Status: em andamento.
      </CardDescription>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Leitura de conteudo educativo</li>
        <li>Registro de hidratacao</li>
        <li>Lembrete de consulta preventiva</li>
      </ul>
    </Card>
  );
}

export function UserActivitiesPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Atividades da semana</CardTitle>
      <CardDescription>Acompanhamento de progresso da jornada preventiva.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">Concluida: Conteudo sobre sono</li>
        <li className="rounded-lg border p-2">Concluida: Registro de hidratacao (3 dias)</li>
        <li className="rounded-lg border p-2">Pendente: Atualizacao da avaliacao inicial</li>
      </ul>
    </Card>
  );
}

export function UserProfilePrivacyPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Perfil e privacidade</CardTitle>
      <CardDescription>
        Historico de consentimento, solicitacao de exportacao e correcao de dados.
      </CardDescription>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Consentimento v1.0 aceito em 29/07/2026</li>
        <li>Canal de comunicacao: e-mail</li>
        <li>Solicitacao de exportacao: disponivel</li>
        <li>Revogacao de consentimento: disponivel</li>
      </ul>
    </Card>
  );
}

export function UserAgendaPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Agenda</CardTitle>
      <CardDescription>Solicitacao, confirmacao e historico de atendimentos preventivos.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">12/08 - 14:00 - Consulta preventiva - confirmado</li>
        <li className="rounded-lg border p-2">26/08 - 09:00 - Reavaliacao de rotina - solicitado</li>
      </ul>
    </Card>
  );
}
