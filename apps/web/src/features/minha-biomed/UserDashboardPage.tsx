import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { evaluatePreventiveRisk } from '@/domains/risk/riskEngine';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';

const assessmentSchema = z.object({
  consentAccepted: z.boolean().refine((value) => value, 'Voce precisa aceitar o consentimento.'),
  sleepHours: z.number().min(1).max(12),
  activityDays: z.number().min(0).max(7),
  stressLevel: z.number().min(0).max(10),
});

type AssessmentForm = z.infer<typeof assessmentSchema>;

export function UserDashboardPage() {
  const [submitted, setSubmitted] = useState<AssessmentForm | null>(null);
  const form = useForm<AssessmentForm>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      consentAccepted: false,
      sleepHours: 7,
      activityDays: 3,
      stressLevel: 4,
    },
  });

  const riskResult = submitted
    ? evaluatePreventiveRisk({
        sleepHours: submitted.sleepHours,
        activityDays: submitted.activityDays,
        stressLevel: submitted.stressLevel,
      })
    : null;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <CardTitle>Minha BioMed - Inicio</CardTitle>
        <CardDescription>
          Onboarding, consentimento versionado, avaliacao inicial e jornada preventiva.
        </CardDescription>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Progresso da jornada" value="45%" />
          <Metric label="Proxima consulta" value="12/08 - 14:00" />
          <Metric label="Atividades da semana" value="3 de 5" />
          <Metric label="Status de privacidade" value="Consentimento ativo" />
        </div>
        <div>
          <Button asChild variant="secondary">
            <Link to="/minha-biomed/agenda">Ver agenda</Link>
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Avaliacao inicial demonstrativa</CardTitle>
        <CardDescription>
          Linguagem orientativa. Sem diagnostico automatico e sem promessas clinicas.
        </CardDescription>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            void form.handleSubmit((data) => setSubmitted(data))(event);
          }}
        >
          <label className="space-y-1 text-sm">
            <span>Horas medias de sono</span>
            <input
              type="number"
              className="focus-ring h-10 w-full rounded-xl border px-3"
              {...form.register('sleepHours', { valueAsNumber: true })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Dias de atividade fisica por semana</span>
            <input
              type="number"
              className="focus-ring h-10 w-full rounded-xl border px-3"
              {...form.register('activityDays', { valueAsNumber: true })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Nivel de estresse (0 a 10)</span>
            <input
              type="number"
              className="focus-ring h-10 w-full rounded-xl border px-3"
              {...form.register('stressLevel', { valueAsNumber: true })}
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
            <input type="checkbox" {...form.register('consentAccepted')} />
            Aceito o aviso de privacidade e consentimento v1.0 para finalidade preventiva.
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Gerar resultado orientativo</Button>
          </div>
        </form>
      </Card>

      {riskResult ? (
        <Card className="space-y-2">
          <CardTitle>Resultado orientativo</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm">Nivel:</span>
            <Badge>{riskResult.level.toUpperCase()}</Badge>
          </div>
          <p className="text-sm">{riskResult.message}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted-foreground)]">
            {riskResult.rationale.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-[var(--secondary)] p-3">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-base font-semibold text-[var(--card-foreground)]">{value}</p>
    </div>
  );
}
