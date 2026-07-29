import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { evaluatePreventiveRisk } from '@/domains/risk/riskEngine';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { useAuth } from '@/services/auth/AuthContext';

const assessmentSchema = z.object({
  consentAccepted: z.boolean().refine((value) => value, 'Você precisa aceitar o consentimento.'),
  sleepHours: z.number().min(1).max(12),
  activityDays: z.number().min(0).max(7),
  stressLevel: z.number().min(0).max(10),
  sleepQuality: z.enum(['baixa', 'regular', 'boa']),
  sittingHours: z.number().min(0).max(16),
  hydration: z.enum(['baixa', 'moderada', 'adequada']),
  energyLevel: z.number().min(0).max(10),
  preventiveInterest: z.enum(['sono', 'movimento', 'estresse', 'rotina']),
});

type AssessmentForm = z.infer<typeof assessmentSchema>;

export function UserDashboardPage() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState<AssessmentForm | null>(null);
  const [step, setStep] = useState(0);
  const form = useForm<AssessmentForm>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      consentAccepted: false,
      sleepHours: 7,
      activityDays: 3,
      stressLevel: 4,
      sleepQuality: 'regular',
      sittingHours: 7,
      hydration: 'moderada',
      energyLevel: 6,
      preventiveInterest: 'rotina',
    },
  });
  const progressPercent = Math.round(((step + 1) / 5) * 100);
  const steps = useMemo(
    () => ['Hábitos e rotina', 'Sono e recuperação', 'Movimento', 'Bem-estar percebido', 'Revisão e consentimento'],
    []
  );

  const riskResult = submitted
    ? evaluatePreventiveRisk({
        sleepHours: submitted.sleepHours,
        activityDays: submitted.activityDays,
        stressLevel: submitted.stressLevel,
      })
    : null;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Olá, {user?.nome.split(' ')[0] ?? 'você'}. Vamos cuidar da sua saúde hoje?</CardTitle>
            <CardDescription>
              Sua jornada preventiva está ativa. Pequenas ações consistentes geram evolução.
            </CardDescription>
          </div>
          <Badge>Próxima ação recomendada: atualizar atividade de hoje</Badge>
        </div>
        <div className="h-2 rounded-full bg-[var(--muted)]">
          <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: '45%' }} />
        </div>
        <CardDescription>Progresso total da jornada: 45%</CardDescription>
        <CardDescription>
          Onboarding, consentimento versionado, avaliação inicial e jornada preventiva.
        </CardDescription>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Progresso da jornada" value="45%" />
          <Metric label="Próxima consulta" value="12/08 - 14:00" />
          <Metric label="Atividades da semana" value="3 de 5" />
          <Metric label="Status de privacidade" value="Consentimento ativo" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/minha-biomed/jornada">Continuar minha jornada</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/minha-biomed/agenda">Ver agenda</Link>
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Avaliação inicial demonstrativa</CardTitle>
        <CardDescription>
          Linguagem orientativa. Sem diagnóstico automático e sem promessas clínicas.
        </CardDescription>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Etapa {step + 1} de 5</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--muted)]">
            <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-sm font-medium">{steps[step]}</p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            void form.handleSubmit((data) => setSubmitted(data))(event);
          }}
        >
          {step === 0 ? (
            <>
              <label className="space-y-1 text-sm">
                <span>Interesse principal na jornada preventiva</span>
                <select className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('preventiveInterest')}>
                  <option value="rotina">Organizar rotina</option>
                  <option value="sono">Melhorar sono</option>
                  <option value="movimento">Aumentar movimento</option>
                  <option value="estresse">Reduzir estresse</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Tempo sentado por dia (horas)</span>
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('sittingHours', { valueAsNumber: true })} />
              </label>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <label className="space-y-1 text-sm">
                <span>Horas médias de sono</span>
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('sleepHours', { valueAsNumber: true })} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Qualidade percebida do sono</span>
                <select className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('sleepQuality')}>
                  <option value="baixa">Baixa</option>
                  <option value="regular">Regular</option>
                  <option value="boa">Boa</option>
                </select>
              </label>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <label className="space-y-1 text-sm">
                <span>Dias de atividade física por semana</span>
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('activityDays', { valueAsNumber: true })} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Hidratação percebida</span>
                <select className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('hydration')}>
                  <option value="baixa">Baixa</option>
                  <option value="moderada">Moderada</option>
                  <option value="adequada">Adequada</option>
                </select>
              </label>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <label className="space-y-1 text-sm">
                <span>Nível de estresse (0 a 10)</span>
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('stressLevel', { valueAsNumber: true })} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Disposição durante o dia (0 a 10)</span>
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('energyLevel', { valueAsNumber: true })} />
              </label>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <div className="rounded-xl border bg-[var(--secondary)] p-3 text-sm sm:col-span-2">
                <p className="font-semibold">Resumo da avaliação</p>
                <p>Rotina de sono: {form.getValues('sleepHours')}h, atividade: {form.getValues('activityDays')} dias/semana.</p>
                <p>Nível de estresse: {form.getValues('stressLevel')}.</p>
              </div>
              <label className="flex items-center gap-2 rounded-xl border p-3 text-sm sm:col-span-2">
                <input type="checkbox" {...form.register('consentAccepted')} />
                Aceito o aviso de privacidade e o consentimento versionado v1.0 para finalidade preventiva.
              </label>
            </>
          ) : null}
          <div className="sm:col-span-2 flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Voltar
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))}>
                Continuar
              </Button>
            ) : (
              <Button type="submit">Gerar resultado orientativo</Button>
            )}
          </div>
        </form>
      </Card>

      {riskResult ? (
        <Card className="space-y-2">
          <CardTitle>Resultado orientativo</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm">Nível:</span>
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
    <div className="rounded-xl border bg-[var(--secondary)] p-3 shadow-[var(--shadow-card)]">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-base font-semibold text-[var(--card-foreground)]">{value}</p>
    </div>
  );
}
