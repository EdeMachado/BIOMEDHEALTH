import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import {
  assessmentFormDefaultValues,
  assessmentFormSchema,
  assessmentStepFields,
  assessmentStepTitles,
  type AssessmentFormData,
} from '@/domains/assessment/formSchema';
import {
  completeAssessment,
  loadAssessmentRuntimeSnapshot,
  persistAssessmentDraft,
  type AssessmentRuntimeSnapshot,
} from '@/domains/assessment/assessmentService';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { useAuth } from '@/services/auth/AuthContext';
import { getSupabaseClient } from '@/services/api/supabaseClient';
import {
  createAssessmentRepositoryFactory,
  resolveAssessmentRepositoryMode,
} from '@/services/repositories/assessment/factory';
import type { AssessmentContext } from '@/services/repositories/assessment/types';
import type { SupabaseAssessmentClient } from '@/services/repositories/assessment/supabaseAssessmentRepository';

export function UserDashboardPage() {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const repository = useMemo(() => {
    try {
      const mode = resolveAssessmentRepositoryMode(import.meta.env);
      const supabaseClient =
        mode === 'supabase' ? (getSupabaseClient() as unknown as SupabaseAssessmentClient | null) : null;
      return createAssessmentRepositoryFactory({
        mode,
        supabaseClient,
      });
    } catch {
      return createAssessmentRepositoryFactory({ mode: 'mock' });
    }
  }, []);
  const [runtime, setRuntime] = useState<AssessmentRuntimeSnapshot | null>(null);
  const [state, setState] = useState<{
    loading: boolean;
    saving: boolean;
    submitting: boolean;
    error: string | null;
    statusMessage: string | null;
  }>({
    loading: true,
    saving: false,
    submitting: false,
    error: null,
    statusMessage: null,
  });
  const [step, setStep] = useState(0);
  const form = useForm<AssessmentFormData>({
    resolver: zodResolver(assessmentFormSchema),
    defaultValues: assessmentFormDefaultValues,
  });
  const progressPercent = Math.round(((step + 1) / 5) * 100);
  const steps = useMemo(() => [...assessmentStepTitles], []);

  const context = useMemo<AssessmentContext | null>(() => {
    if (!user) return null;
    return {
      sessionUserId: user.id,
      userId: user.id,
      organizationId: user.organizationId,
    };
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    if (!context) {
      setState({ loading: false, saving: false, submitting: false, error: 'Sessao indisponivel.', statusMessage: null });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: null, statusMessage: null }));
    void loadAssessmentRuntimeSnapshot(repository, context).then((result) => {
      if (disposed || !mountedRef.current) return;
      if (!result.ok) {
        setState({
          loading: false,
          saving: false,
          submitting: false,
          error: toPublicAssessmentError(result.error.code),
          statusMessage: null,
        });
        return;
      }
      form.reset(result.data.draft);
      setStep(result.data.step);
      setRuntime(result.data);
      setState({
        loading: false,
        saving: false,
        submitting: false,
        error: null,
        statusMessage:
          result.data.completed
            ? 'Avaliacao concluida e restaurada com resultado orientativo.'
            : result.data.assessment
              ? 'Avaliacao incompleta restaurada para continuidade segura.'
              : null,
      });
    });
    return () => {
      disposed = true;
    };
  }, [context, repository, form]);

  async function persistCurrentFormDraft(nextStep: number | null = null) {
    if (!runtime || !context || runtime.completed) return;
    const parsed = assessmentFormSchema.safeParse(form.getValues());
    if (!parsed.success) {
      setState((current) => ({
        ...current,
        error: 'Revise os campos da etapa atual antes de salvar.',
      }));
      return;
    }
    setState((current) => ({ ...current, saving: true, error: null, statusMessage: null }));
    const fieldsToPersist = assessmentStepFields
      .slice(0, step + 1)
      .flat();
    const result = await persistAssessmentDraft(repository, context, runtime, parsed.data, {
      fields: fieldsToPersist,
    });
    if (!mountedRef.current) return;
    if (!result.ok) {
      setState((current) => ({
        ...current,
        saving: false,
        error: toPublicAssessmentError(result.error.code),
      }));
      return;
    }
    setRuntime(result.data);
    if (nextStep !== null) {
      setStep(nextStep);
    }
    setState((current) => ({
      ...current,
      saving: false,
      error: null,
      statusMessage: 'Progresso salvo com sucesso.',
    }));
  }

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
        <CardTitle>Avaliacao inicial</CardTitle>
        <CardDescription>
          Linguagem orientativa. Sem diagnostico automatico e sem promessas clinicas.
        </CardDescription>
        {state.loading ? (
          <CardDescription>Carregando avaliacao e respostas persistidas...</CardDescription>
        ) : null}
        {!state.loading && state.error ? (
          <CardDescription className="text-red-600">{state.error}</CardDescription>
        ) : null}
        {!state.loading && state.statusMessage ? (
          <CardDescription>{state.statusMessage}</CardDescription>
        ) : null}
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
            event.preventDefault();
            if (!runtime || !context) return;
            void form.handleSubmit(async (data) => {
              setState((current) => ({ ...current, submitting: true, error: null, statusMessage: null }));
              const result = await completeAssessment(repository, context, runtime, data);
              if (!mountedRef.current) return;
              if (!result.ok) {
                setState((current) => ({
                  ...current,
                  submitting: false,
                  error: toPublicAssessmentError(result.error.code),
                }));
                return;
              }
              setRuntime(result.data);
              form.reset(result.data.draft);
              setStep(4);
              setState((current) => ({
                ...current,
                submitting: false,
                error: null,
                statusMessage: 'Resultado orientativo persistido com historico da avaliacao.',
              }));
            })(event);
          }}
        >
          {step === 0 ? (
            <>
              <label className="space-y-1 text-sm">
                <span>Interesse principal na jornada preventiva</span>
                <select className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('preventiveInterest')} disabled={state.loading || state.saving || state.submitting || runtime?.completed}>
                  <option value="rotina">Organizar rotina</option>
                  <option value="sono">Melhorar sono</option>
                  <option value="movimento">Aumentar movimento</option>
                  <option value="estresse">Reduzir estresse</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Tempo sentado por dia (horas)</span>
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('sittingHours', { valueAsNumber: true })} disabled={state.loading || state.saving || state.submitting || runtime?.completed} />
              </label>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <label className="space-y-1 text-sm">
                <span>Horas médias de sono</span>
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('sleepHours', { valueAsNumber: true })} disabled={state.loading || state.saving || state.submitting || runtime?.completed} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Qualidade percebida do sono</span>
                <select className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('sleepQuality')} disabled={state.loading || state.saving || state.submitting || runtime?.completed}>
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
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('activityDays', { valueAsNumber: true })} disabled={state.loading || state.saving || state.submitting || runtime?.completed} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Hidratação percebida</span>
                <select className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('hydration')} disabled={state.loading || state.saving || state.submitting || runtime?.completed}>
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
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('stressLevel', { valueAsNumber: true })} disabled={state.loading || state.saving || state.submitting || runtime?.completed} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Disposição durante o dia (0 a 10)</span>
                <input type="number" className="focus-ring h-10 w-full rounded-xl border px-3" {...form.register('energyLevel', { valueAsNumber: true })} disabled={state.loading || state.saving || state.submitting || runtime?.completed} />
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
                <input type="checkbox" {...form.register('consentAccepted')} disabled={state.loading || state.saving || state.submitting || runtime?.completed} />
                Aceito o aviso de privacidade e o consentimento versionado v1.0 para finalidade preventiva.
              </label>
            </>
          ) : null}
          <div className="sm:col-span-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || state.loading || state.saving || state.submitting}
            >
              Voltar
            </Button>
            {step < 4 ? (
              <Button
                type="button"
                onClick={() => {
                  if (runtime?.completed) {
                    setStep((s) => Math.min(4, s + 1));
                    return;
                  }
                  const nextStep = Math.min(4, step + 1);
                  void persistCurrentFormDraft(nextStep);
                }}
                disabled={state.loading || state.saving || state.submitting}
              >
                Continuar
              </Button>
            ) : (
              <Button type="submit" disabled={state.loading || state.saving || state.submitting || runtime?.completed}>
                {runtime?.completed ? 'Avaliacao concluida' : 'Gerar resultado orientativo'}
              </Button>
            )}
          </div>
        </form>
      </Card>

      {runtime?.orientativeResult ? (
        <Card className="space-y-2">
          <CardTitle>Resultado orientativo</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm">Nível:</span>
            <Badge>{runtime.orientativeResult.level.toUpperCase()}</Badge>
          </div>
          <p className="text-sm">{runtime.orientativeResult.message}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted-foreground)]">
            {runtime.orientativeResult.rationale.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted-foreground)]">
            Resultado orientativo para apoio preventivo. Nao corresponde a diagnostico clinico.
          </p>
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

function toPublicAssessmentError(code: string): string {
  if (code === 'VERSION_NOT_FOUND' || code === 'VERSION_INELIGIBLE' || code === 'VERSION_INCOMPATIBLE') {
    return 'Formulario de avaliacao indisponivel para esta organizacao no momento.';
  }
  if (code === 'QUESTION_NOT_IN_VERSION' || code === 'OPTION_NOT_ALLOWED') {
    return 'A resposta enviada nao e compativel com a versao atual da avaliacao.';
  }
  if (code === 'ASSESSMENT_ALREADY_COMPLETED') {
    return 'Avaliacao ja concluida. Inicie nova avaliacao apenas quando uma nova versao estiver elegivel.';
  }
  if (code === 'NO_SESSION' || code === 'IDENTITY_MISMATCH' || code === 'CROSS_TENANT_DATA') {
    return 'Sessao sem autorizacao para persistir avaliacao.';
  }
  return 'Nao foi possivel persistir a avaliacao neste momento.';
}
