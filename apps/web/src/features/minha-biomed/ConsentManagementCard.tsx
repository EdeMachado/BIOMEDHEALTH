import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { CardDescription } from '@/shared/ui/card';
import { useAuth } from '@/services/auth/AuthContext';
import { bootstrapConsentRepository } from '@/application/consent';
import type { ConsentContext, ConsentHistoryItem } from '@/services/repositories/consent/types';
import {
  loadConsentOverview,
  registerConsentAcceptance,
  registerConsentRevocation,
} from '@/domains/consent/consentService';
import { createNoopConsentAuditSink } from '@/domains/consent/consentAudit';

type ConsentManagementCardProps = {
  onMessage: (message: string) => void;
};

export function ConsentManagementCard({ onMessage }: ConsentManagementCardProps) {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const bootstrap = useMemo(
    () => bootstrapConsentRepository({ env: import.meta.env }),
    []
  );
  const repository = bootstrap.ok ? bootstrap.repository : null;
  const auditSink = useMemo(() => createNoopConsentAuditSink(), []);

  const [state, setState] = useState<{
    loading: boolean;
    actionLoading: boolean;
    error: string | null;
    data: {
      eligibleDocuments: Array<ConsentHistoryItem['document']>;
      history: ConsentHistoryItem[];
      activeConsent: ConsentHistoryItem | null;
    } | null;
  }>({
    loading: true,
    actionLoading: false,
    error: null,
    data: null,
  });

  const context = useMemo<ConsentContext | null>(() => {
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
    if (!bootstrap.ok || !repository) {
      setState({
        loading: false,
        actionLoading: false,
        error: bootstrap.ok ? 'Consentimentos indisponiveis.' : bootstrap.message,
        data: null,
      });
      return;
    }
    if (!context) {
      setState({ loading: false, actionLoading: false, error: 'Sessao indisponivel.', data: null });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: null }));
    void loadConsentOverview(repository, context).then((result) => {
      if (disposed) return;
      if (!result.ok) {
        setState({ loading: false, actionLoading: false, error: toPublicConsentError(result.error.code), data: null });
        return;
      }
      setState({ loading: false, actionLoading: false, error: null, data: result.data });
    });
    return () => {
      disposed = true;
    };
  }, [bootstrap, context, repository]);

  async function refresh() {
    if (!context || !repository) return;
    if (!mountedRef.current) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    const result = await loadConsentOverview(repository, context);
    if (!mountedRef.current) return;
    if (!result.ok) {
      setState((current) => ({
        ...current,
        loading: false,
        error: toPublicConsentError(result.error.code),
      }));
      return;
    }
    setState((current) => ({
      ...current,
      loading: false,
      error: null,
      data: result.data,
    }));
  }

  async function acceptCurrentDocument() {
    if (!context || !repository || !state.data) return;
    const target = state.data.eligibleDocuments[0];
    if (!target) return;
    setState((current) => ({ ...current, actionLoading: true, error: null }));
    const result = await registerConsentAcceptance(
      repository,
      {
        context,
        consentDocumentId: target.id,
        source: 'web',
      },
      auditSink
    );
    if (!mountedRef.current) return;
    if (!result.ok) {
      setState((current) => ({
        ...current,
        actionLoading: false,
        error: toPublicConsentError(result.error.code),
      }));
      return;
    }
    onMessage(`Consentimento ${target.documentVersion} aceito com sucesso.`);
    await refresh();
    if (!mountedRef.current) return;
    setState((current) => ({ ...current, actionLoading: false }));
  }

  async function revokeActiveConsent() {
    if (!context || !repository || !state.data?.activeConsent) return;
    const confirmed = window.confirm(
      'Revogar o consentimento pode limitar funcionalidades preventivas. Deseja continuar?'
    );
    if (!confirmed) return;

    setState((current) => ({ ...current, actionLoading: true, error: null }));
    const result = await registerConsentRevocation(
      repository,
      {
        context,
        consentId: state.data.activeConsent.consent.id,
        revokedSource: 'web',
        revokedReason: 'Solicitacao do titular via Minha Biomed',
      },
      auditSink
    );
    if (!mountedRef.current) return;
    if (!result.ok) {
      setState((current) => ({
        ...current,
        actionLoading: false,
        error: toPublicConsentError(result.error.code),
      }));
      return;
    }
    onMessage('Consentimento revogado com registro historico preservado.');
    await refresh();
    if (!mountedRef.current) return;
    setState((current) => ({ ...current, actionLoading: false }));
  }

  if (state.loading) {
    return (
      <section className="rounded-xl border p-3">
        <h4 className="font-semibold">Consentimentos</h4>
        <CardDescription>Carregando consentimentos elegiveis e historico do titular...</CardDescription>
      </section>
    );
  }

  return (
    <section className="rounded-xl border p-3">
      <h4 className="font-semibold">Consentimentos</h4>
      <CardDescription>
        Consulta, aceite e revogacao com historico versionado sem exclusao de registros.
      </CardDescription>
      {state.error ? <Alert className="mt-3">{state.error}</Alert> : null}
      <div className="mt-3 grid gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-sm font-semibold">Estado atual</p>
          {state.data?.activeConsent ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Ativo: {state.data.activeConsent.document.title} v{state.data.activeConsent.document.documentVersion}
            </p>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">Sem consentimento ativo no momento.</p>
          )}
          {state.data?.eligibleDocuments.length ? (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Documento elegivel atual: {state.data.eligibleDocuments[0]?.documentVersion}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Nenhum documento elegivel disponivel para novo aceite.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void refresh();
              }}
              disabled={state.actionLoading}
            >
              Atualizar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void acceptCurrentDocument();
              }}
              disabled={state.actionLoading || !state.data?.eligibleDocuments.length || !!state.data?.activeConsent}
            >
              Aceitar documento vigente
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void revokeActiveConsent();
              }}
              disabled={state.actionLoading || !state.data?.activeConsent}
            >
              Revogar consentimento
            </Button>
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-semibold">Historico do titular</p>
          {state.data?.history.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {state.data.history.map((item) => (
                <li key={item.consent.id} className="rounded-lg bg-[var(--secondary)] p-2">
                  <p className="font-medium">
                    {item.document.title} v{item.document.documentVersion}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Aceito em {formatDateTime(item.consent.acceptedAt)} via {item.consent.source}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {item.consent.revokedAt
                      ? `Revogado em ${formatDateTime(item.consent.revokedAt)} (${item.consent.revokedSource ?? 'n/a'})`
                      : 'Ativo'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Nenhum registro de consentimento encontrado para este titular.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function toPublicConsentError(code: string): string {
  if (code === 'INELIGIBLE_DOCUMENT') return 'Documento de consentimento nao esta elegivel para aceite.';
  if (code === 'CONSENT_ALREADY_ACTIVE') return 'Ja existe consentimento ativo para este documento.';
  if (code === 'CONSENT_NOT_FOUND') return 'Consentimento nao localizado para o titular atual.';
  if (code === 'CONSENT_ALREADY_REVOKED') return 'Consentimento ja estava revogado.';
  if (code === 'CROSS_TENANT_DATA' || code === 'IDENTITY_MISMATCH') {
    return 'Sessao sem autorizacao para esta operacao de consentimento.';
  }
  return 'Nao foi possivel concluir a operacao de consentimento.';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
