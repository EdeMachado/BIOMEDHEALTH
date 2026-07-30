import { describe, expect, it } from 'vitest';
import {
  createMockConsentRepository,
  isConsentDocumentEligible,
} from '@/services/repositories/consent/mockConsentRepository';
import type { ConsentContext } from '@/services/repositories/consent/types';
import {
  loadConsentOverview,
  registerConsentAcceptance,
  registerConsentRevocation,
} from '@/domains/consent/consentService';
import { createNoopConsentAuditSink } from '@/domains/consent/consentAudit';
import type { ConsentRepository } from '@/services/repositories/consent/contracts';

function context(overrides: Partial<ConsentContext> = {}): ConsentContext {
  return {
    sessionUserId: 'usr-1',
    userId: 'usr-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

describe('mock consent repository and consent service', () => {
  it('mapeia documento elegivel com base em status/vigencia/expiracao', () => {
    const now = new Date('2026-08-01T00:00:00.000Z');
    expect(
      isConsentDocumentEligible(
        {
          id: 'd1',
          organizationId: 'org-1',
          code: 'lgpd',
          title: 'Termo',
          purpose: 'Teste',
          legalBasis: 'Consentimento',
          documentVersion: '1.0',
          contentHash: 'legacy-id:non-verifiable:11111111-1111-1111-1111-111111111111',
          status: 'ativo',
          effectiveAt: '2026-01-01T00:00:00.000Z',
          expiresAt: null,
        },
        now
      )
    ).toBe(true);
    expect(
      isConsentDocumentEligible(
        {
          id: 'd2',
          organizationId: 'org-1',
          code: 'lgpd',
          title: 'Termo',
          purpose: 'Teste',
          legalBasis: 'Consentimento',
          documentVersion: '2.0',
          contentHash: 'legacy-id:non-verifiable:22222222-2222-2222-2222-222222222222',
          status: 'ativo',
          effectiveAt: '2099-01-01T00:00:00.000Z',
          expiresAt: null,
        },
        now
      )
    ).toBe(false);
    expect(
      isConsentDocumentEligible(
        {
          id: 'd3',
          organizationId: 'org-1',
          code: 'lgpd',
          title: 'Termo',
          purpose: 'Teste',
          legalBasis: 'Consentimento',
          documentVersion: '0.9',
          contentHash: 'legacy-id:non-verifiable:33333333-3333-3333-3333-333333333333',
          status: 'inativo',
          effectiveAt: '2026-01-01T00:00:00.000Z',
          expiresAt: null,
        },
        now
      )
    ).toBe(false);
    expect(
      isConsentDocumentEligible(
        {
          id: 'd4',
          organizationId: 'org-1',
          code: 'lgpd',
          title: 'Termo',
          purpose: 'Teste',
          legalBasis: 'Consentimento',
          documentVersion: '0.8',
          contentHash: 'legacy-id:non-verifiable:44444444-4444-4444-4444-444444444444',
          status: 'ativo',
          effectiveAt: '2025-01-01T00:00:00.000Z',
          expiresAt: '2025-12-31T00:00:00.000Z',
        },
        now
      )
    ).toBe(false);
  });

  it('registra aceite vinculado ao documento/versionamento e consulta historico', async () => {
    sessionStorage.clear();
    const repository = createMockConsentRepository({
      now: () => new Date('2026-08-01T10:30:00.000Z'),
    });
    const auditSink = createNoopConsentAuditSink();
    const acceptance = await registerConsentAcceptance(
      repository,
      {
        context: context(),
        consentDocumentId: 'doc-lgpd-v1-org1',
        source: 'web',
      },
      auditSink
    );
    expect(acceptance.ok).toBe(true);

    const overview = await loadConsentOverview(repository, context());
    expect(overview.ok).toBe(true);
    if (!overview.ok) return;

    expect(overview.data.activeConsent?.document.documentVersion).toBe('1.0');
    expect(overview.data.history).toHaveLength(1);
    expect(overview.data.history[0]?.consent.revokedAt).toBeNull();
  });

  it('registra revogacao sem apagar historico', async () => {
    sessionStorage.clear();
    const repository = createMockConsentRepository({
      now: () => new Date('2026-08-01T10:30:00.000Z'),
    });
    const auditSink = createNoopConsentAuditSink();
    const accepted = await registerConsentAcceptance(
      repository,
      {
        context: context(),
        consentDocumentId: 'doc-lgpd-v1-org1',
        source: 'web',
      },
      auditSink
    );
    if (!accepted.ok) throw new Error('pre-condicao invalida');

    const revoked = await registerConsentRevocation(
      repository,
      {
        context: context(),
        consentId: accepted.data.id,
        revokedSource: 'web',
        revokedReason: 'Titular solicitou revogacao',
      },
      auditSink
    );
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(revoked.data.revokedAt).not.toBeNull();
    expect(revoked.data.version).toBe(2);

    const history = await repository.listConsentHistory(context());
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.data).toHaveLength(1);
    expect(history.data[0]?.consent.revokedAt).not.toBeNull();
  });

  it('retorna erro de sessao/identidade quando contexto e invalido', async () => {
    sessionStorage.clear();
    const repository = createMockConsentRepository();
    const noSessionResult = await repository.listEligibleDocuments(
      context({ sessionUserId: null, userId: null })
    );
    expect(noSessionResult.ok).toBe(false);
    if (noSessionResult.ok) return;
    expect(noSessionResult.error.code).toBe('NO_SESSION');

    const mismatchResult = await repository.listConsentHistory(
      context({ sessionUserId: 'usr-9', userId: 'usr-1' })
    );
    expect(mismatchResult.ok).toBe(false);
    if (mismatchResult.ok) return;
    expect(mismatchResult.error.code).toBe('IDENTITY_MISMATCH');
  });

  it('propaga erro tecnico do repositorio na camada de operacao', async () => {
    const failingRepository: ConsentRepository = {
      listEligibleDocuments: () =>
        Promise.resolve({
        ok: false,
        error: {
          code: 'TECHNICAL_ERROR',
          kind: 'technical',
          message: 'Falha simulada',
          transient: true,
        },
      }),
      listConsentHistory: () => Promise.resolve({ ok: true, data: [] }),
      acceptConsent: () => Promise.resolve({ ok: true, data: {} as never }),
      revokeConsent: () => Promise.resolve({ ok: true, data: {} as never }),
    };
    const result = await loadConsentOverview(failingRepository, context());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TECHNICAL_ERROR');
  });
});
