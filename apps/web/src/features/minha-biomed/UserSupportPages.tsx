import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Card, CardDescription, CardTitle } from '@/shared/ui/card';
import { ConsentManagementCard } from '@/features/minha-biomed/ConsentManagementCard';
import {
  loadJourneyRuntimeSnapshot,
  registerJourneyActivityProgress,
  type JourneyRuntimeSnapshot,
} from '@/domains/journey/journeyService';
import { useAuth } from '@/services/auth/AuthContext';
import { getSupabaseClient } from '@/services/api/supabaseClient';
import { requestLgpdCapability } from '@/application/lgpd/lgpdRequestService';
import {
  createJourneyRepositoryFactory,
  resolveJourneyRepositoryMode,
} from '@/services/repositories/journey/factory';
import type { JourneyContext } from '@/services/repositories/journey/types';
import type { JourneyRepository } from '@/services/repositories/journey/contracts';
import type { SupabaseJourneyClient } from '@/services/repositories/journey/supabaseJourneyRepository';

type JourneyRuntimeState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  statusMessage: string | null;
  runtime: JourneyRuntimeSnapshot | null;
  isEmpty: boolean;
};

export function UserJourneyPage() {
  const journey = useJourneyRuntime();

  return (
    <Card className="space-y-3">
      <CardTitle>Minha jornada — Bem-estar e Prevenção</CardTitle>
      <CardDescription>
        Publico elegivel: adultos ativos. Duracao: 8 semanas. Proximo marco: reavaliacao preventiva.
      </CardDescription>
      {journey.loading ? (
        <CardDescription>Carregando jornada e progresso persistidos...</CardDescription>
      ) : null}
      {!journey.loading && journey.error ? (
        <CardDescription className="text-red-600">{journey.error}</CardDescription>
      ) : null}
      {!journey.loading && !journey.error && journey.isEmpty ? (
        <CardDescription>Nenhuma jornada preventiva elegivel para seu contexto atual.</CardDescription>
      ) : null}
      {!journey.loading && !journey.error && journey.runtime ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {journey.runtime.weeks.map((item) => (
            <div key={item.week} className="rounded-lg border bg-white p-3 text-sm">
              <p className="font-semibold">Semana {item.week}</p>
              <span
                className={`status-badge mt-2 inline-block ${
                  item.status === 'concluida'
                    ? 'status-success'
                    : item.status === 'em andamento'
                      ? 'status-warning'
                      : 'status-info'
                }`}
              >
                {item.status}
              </span>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                {item.status === 'bloqueada'
                  ? 'Disponivel apos concluir a semana anterior.'
                  : 'Atividades de prevencao e acompanhamento.'}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {journey.statusMessage ? <CardDescription>{journey.statusMessage}</CardDescription> : null}
    </Card>
  );
}

export function UserActivitiesPage() {
  const journey = useJourneyRuntime();
  const pending = journey.runtime?.activities.filter((a) => a.status !== 'Concluída') ?? [];
  const done = journey.runtime?.activities.filter((a) => a.status === 'Concluída') ?? [];

  return (
    <Card className="space-y-3">
      <CardTitle>Atividades da semana</CardTitle>
      <CardDescription>Acompanhamento de progresso da jornada preventiva.</CardDescription>
      {journey.loading ? <CardDescription>Carregando atividades persistidas...</CardDescription> : null}
      {!journey.loading && journey.error ? (
        <CardDescription className="text-red-600">{journey.error}</CardDescription>
      ) : null}
      {!journey.loading && !journey.error && journey.isEmpty ? (
        <CardDescription>Nao ha atividades elegiveis para a jornada atual.</CardDescription>
      ) : null}
      {!journey.loading && !journey.error && journey.runtime ? (
        <>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Pendentes e em andamento</h4>
            <div className="grid gap-2">
              {pending.map((activity) => (
                <article key={activity.id} className="rounded-xl border bg-white p-3 text-sm shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{activity.titulo}</p>
                    <span className={`status-badge ${activity.status === 'Pendente' ? 'status-info' : 'status-warning'}`}>
                      {activity.status}
                    </span>
                  </div>
                  <p className="text-[var(--muted-foreground)]">{activity.categoria} • {activity.frequencia}</p>
                  <p className="mt-1">{activity.descricao}</p>
                  <div className="mt-2 h-2 rounded-full bg-[var(--muted)]">
                    <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${activity.progresso}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Data prevista: {activity.dataPrevista}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void journey.updateActivity(activity.id, 'complete')}
                      disabled={journey.saving || journey.runtime?.completed === true}
                    >
                      Marcar como concluída
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void journey.updateActivity(activity.id, 'register_today')}
                      disabled={journey.saving || journey.runtime?.completed === true}
                    >
                      Registrar hoje
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Concluídas</h4>
            <div className="grid gap-2">
              {done.map((activity) => (
                <article key={activity.id} className="rounded-xl border bg-[var(--secondary)] p-3 text-sm">
                  <p className="font-semibold">{activity.titulo}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{activity.dataPrevista}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
      {journey.statusMessage ? <CardDescription>{journey.statusMessage}</CardDescription> : null}
    </Card>
  );
}

function useJourneyRuntime() {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const repositoryConfig = useMemo(() => {
    try {
      const mode = resolveJourneyRepositoryMode(import.meta.env);
      if (mode === 'supabase') {
        return {
          repository: createJourneyRepositoryFactory({
            mode,
            supabaseClient: getSupabaseClient() as unknown as SupabaseJourneyClient,
          }),
          error: null,
        };
      }
      return {
        repository: createJourneyRepositoryFactory({ mode }),
        error: null,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao inicializar repositorio de jornada.';
      return { repository: null as JourneyRepository | null, error: message };
    }
  }, []);

  const context = useMemo<JourneyContext | null>(() => {
    if (!user) return null;
    return {
      sessionUserId: user.id,
      userId: user.id,
      organizationId: user.organizationId,
    };
  }, [user]);

  const [state, setState] = useState<JourneyRuntimeState>({
    loading: true,
    saving: false,
    error: null,
    statusMessage: null,
    runtime: null,
    isEmpty: false,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    if (!context) {
      setState((current) => ({
        ...current,
        loading: false,
        error: 'Sessao indisponivel para carregar jornada.',
      }));
      return;
    }
    if (!repositoryConfig.repository) {
      setState((current) => ({
        ...current,
        loading: false,
        error: repositoryConfig.error ?? 'Repositorio de jornada indisponivel.',
      }));
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null, statusMessage: null }));
    void loadJourneyRuntimeSnapshot(repositoryConfig.repository, context).then((result) => {
      if (disposed || !mountedRef.current) return;
      if (!result.ok) {
        setState({
          loading: false,
          saving: false,
          error: toPublicJourneyError(result.error.code),
          statusMessage: null,
          runtime: null,
          isEmpty: false,
        });
        return;
      }
      setState({
        loading: false,
        saving: false,
        error: null,
        statusMessage: result.data?.completed
          ? 'Jornada concluida restaurada com progresso historico.'
          : result.data
            ? 'Jornada em andamento restaurada com progresso persistido.'
            : null,
        runtime: result.data,
        isEmpty: result.data === null,
      });
    });

    return () => {
      disposed = true;
    };
  }, [context, repositoryConfig]);

  const updateActivity = async (activityId: string, intent: 'complete' | 'register_today') => {
    if (!context || !repositoryConfig.repository || !state.runtime) return;
    setState((current) => ({ ...current, saving: true, error: null, statusMessage: null }));
    const result = await registerJourneyActivityProgress(
      repositoryConfig.repository,
      context,
      state.runtime,
      { activityId, intent }
    );
    if (!mountedRef.current) return;
    if (!result.ok) {
      setState((current) => ({
        ...current,
        saving: false,
        error: toPublicJourneyError(result.error.code),
      }));
      return;
    }
    setState((current) => ({
      ...current,
      saving: false,
      runtime: result.data,
      isEmpty: false,
      error: null,
      statusMessage: 'Progresso da atividade persistido com sucesso.',
    }));
  };

  return { ...state, updateActivity };
}

function toPublicJourneyError(code: string): string {
  if (
    code === 'NO_SESSION' ||
    code === 'IDENTITY_MISMATCH' ||
    code === 'NO_ACTIVE_MEMBERSHIP' ||
    code === 'CROSS_TENANT_DATA'
  ) {
    return 'Sessao sem autorizacao para acessar a jornada preventiva.';
  }
  if (
    code === 'JOURNEY_VERSION_NOT_FOUND' ||
    code === 'JOURNEY_VERSION_AMBIGUOUS' ||
    code === 'JOURNEY_VERSION_INELIGIBLE' ||
    code === 'JOURNEY_VERSION_INCOMPATIBLE'
  ) {
    return 'Catalogo de jornada indisponivel para sua organizacao no momento.';
  }
  if (
    code === 'ACTIVITY_NOT_FOUND' ||
    code === 'ACTIVITY_VERSION_MISMATCH' ||
    code === 'USER_JOURNEY_NOT_FOUND'
  ) {
    return 'Atividade incompativel com a jornada em andamento.';
  }
  if (code === 'USER_JOURNEY_COMPLETED') {
    return 'Jornada ja concluida. Atualizacao de atividade bloqueada.';
  }
  return 'Nao foi possivel persistir o progresso da jornada neste momento.';
}

export function UserProfilePrivacyPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');

  function handleLgpdRequest(kind: 'export' | 'correction' | 'preferences') {
    const result = requestLgpdCapability({
      requestKind: kind,
      actorEmail: user?.email,
      actorRole: user?.role,
      organizationId: user?.organizationId,
    });
    setMessage(result.message);
  }

  return (
    <Card className="space-y-3">
      <CardTitle>Perfil e privacidade</CardTitle>
      <CardDescription>
        Histórico de consentimento e direitos LGPD. Exportação, correção e exclusão só são
        anunciadas quando houver fluxo persistente autorizado — sem simulação de sucesso.
      </CardDescription>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border p-3">
          <h4 className="font-semibold">Preferências de comunicação</h4>
          <p className="text-sm text-[var(--muted-foreground)]">
            Persistência de preferências ainda não disponível neste ambiente.
          </p>
          <Button size="sm" className="mt-2" variant="outline" onClick={() => handleLgpdRequest('preferences')}>
            Solicitar alteração de preferências
          </Button>
        </section>
        <ConsentManagementCard onMessage={setMessage} />
        <section className="rounded-xl border p-3">
          <h4 className="font-semibold">Direitos LGPD</h4>
          <p className="text-sm text-[var(--muted-foreground)]">
            Exportação e correção: indisponíveis até política jurídica e pipeline seguro.
            Apagamento irreversível não é oferecido (retenção legal).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => handleLgpdRequest('export')}>
              Solicitar exportação
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleLgpdRequest('correction')}>
              Solicitar correção
            </Button>
          </div>
        </section>
        <section className="rounded-xl border p-3">
          <h4 className="font-semibold">Segurança da conta</h4>
          <p className="text-sm text-[var(--muted-foreground)]">
            Sessão gerida pelo provedor de autenticação do ambiente ativo.
          </p>
        </section>
      </div>
      {message ? <p className="rounded-lg bg-[var(--secondary)] p-2 text-sm">{message}</p> : null}
    </Card>
  );
}

export function UserAgendaPage() {
  return (
    <Card className="space-y-2">
      <CardTitle>Agenda</CardTitle>
      <CardDescription>Solicitação, confirmação e histórico de atendimentos preventivos.</CardDescription>
      <ul className="space-y-2 text-sm">
        <li className="rounded-lg border p-2">12/08 - 14:00 - Consulta preventiva - confirmado</li>
        <li className="rounded-lg border p-2">26/08 - 09:00 - Reavaliação de rotina - solicitado</li>
      </ul>
    </Card>
  );
}
