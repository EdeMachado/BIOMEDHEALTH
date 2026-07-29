import { canProfessionalAccessUser } from '@/app/routes/guards';
import { useAuth } from '@/services/auth/AuthContext';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';

export function ClinicalOverviewPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Painel profissional</CardTitle>
      <CardDescription>Agenda, carteira de usuarios vinculados e plano de cuidado.</CardDescription>
      <div className="grid gap-2 sm:grid-cols-3">
        <Info label="Atendimentos hoje" value="4" />
        <Info label="Usuarios vinculados" value="1" />
        <Info label="Reavaliacoes pendentes" value="2" />
      </div>
    </Card>
  );
}

export function ClinicalAgendaPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Agenda</CardTitle>
      <CardDescription>Estados: solicitado, confirmado, concluido, cancelado, ausencia.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">09:00 - Ana Demo - confirmado</li>
        <li className="rounded-lg border p-2">11:00 - Reavaliacao preventiva - solicitado</li>
      </ul>
    </Card>
  );
}

export function ClinicalPortfolioPage() {
  const { user } = useAuth();
  const canViewAssigned = user ? canProfessionalAccessUser(user.id, 'usr-1') : false;
  const canViewNotAssigned = user ? canProfessionalAccessUser(user.id, 'usr-999') : false;

  return (
    <Card className="space-y-2">
      <CardTitle>Minha carteira</CardTitle>
      <CardDescription>Segregacao por vinculo profissional-usuario.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">
          Ana Demo (vinculada): {canViewAssigned ? 'acesso permitido' : 'acesso negado'}
        </li>
        <li className="rounded-lg border p-2">
          Usuario nao vinculado: {canViewNotAssigned ? 'acesso permitido' : 'acesso negado'}
        </li>
      </ul>
    </Card>
  );
}

export function ClinicalRecordPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Ficha clinica demonstrativa</CardTitle>
      <CardDescription>Visualizacao restrita a profissional vinculado.</CardDescription>
      <p className="text-sm">
        Avaliacao: acompanhamento preventivo recomendado. Plano de cuidado: rotina de sono, orientacao
        educativa e reavaliacao em 30 dias.
      </p>
    </Card>
  );
}

export function ClinicalAssessmentPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Avaliacoes do usuario vinculado</CardTitle>
      <CardDescription>Historico orientativo com reavaliacao preventiva.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">Avaliacao inicial v1 - concluida - 29/07/2026</li>
        <li className="rounded-lg border p-2">Reavaliacao programada - 26/08/2026</li>
      </ul>
    </Card>
  );
}

export function ClinicalCarePlanPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Plano de cuidado</CardTitle>
      <CardDescription>Objetivos, acoes, responsavel e reavaliacao.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">Objetivo: melhorar rotina de sono</li>
        <li className="rounded-lg border p-2">Acao: reforco educativo semanal</li>
        <li className="rounded-lg border p-2">Responsavel: equipe clinica demo</li>
      </ul>
    </Card>
  );
}

export function ClinicalAttendanceRecordPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Registro de atendimento</CardTitle>
      <CardDescription>Registro assistencial demonstrativo sem dado sensivel real.</CardDescription>
      <p className="text-sm">
        Evolucao ficticia: usuario orientado sobre habitos de sono e agendada reavaliacao preventiva.
      </p>
    </Card>
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
