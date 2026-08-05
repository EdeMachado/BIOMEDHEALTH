import { describe, expect, it } from 'vitest';
import {
  canWriteCollective,
  formatCollectivePeriod,
  formatCollectiveScopeLabel,
  sanitizeCollectiveMessage,
} from '@/domains/collective';
import { collectiveError } from '@/services/repositories/collective/errors';

describe('collective domain policy', () => {
  it('permite escrita somente aos papeis institucionais autorizados', () => {
    expect(canWriteCollective('gestor_institucional')).toBe(true);
    expect(canWriteCollective('sst')).toBe(true);
    expect(canWriteCollective('admin_cliente')).toBe(true);
    expect(canWriteCollective('admin_biomed')).toBe(true);
    expect(canWriteCollective('auditor')).toBe(false);
    expect(canWriteCollective('medico')).toBe(false);
    expect(canWriteCollective('usuario')).toBe(false);
    expect(canWriteCollective(null)).toBe(false);
  });

  it('nao expoe detalhes internos em erros de isolamento', () => {
    const message = sanitizeCollectiveMessage(
      collectiveError('CROSS_TENANT_DATA', {
        cause: { source: 'repository', code: '42501', message: 'private table name' },
      })
    );

    expect(message).toBe('Operacao nao autorizada para este recurso coletivo.');
    expect(message).not.toMatch(/42501|private|table/i);
  });

  it('formata escopos coletivos de forma deterministica', () => {
    expect(formatCollectiveScopeLabel({ scopeType: 'unit', unitId: 'unidade-norte' })).toBe(
      'Unidade unidade-norte'
    );
    expect(
      formatCollectiveScopeLabel({
        scopeType: 'organization',
        unitApplicability: 'selected_units',
      })
    ).toBe('Organizacao (unidades selecionadas)');
    expect(formatCollectiveScopeLabel({ scopeType: 'organization' })).toBe(
      'Organizacao (todas as unidades)'
    );
  });

  it('formata periodo sem depender da camada React', () => {
    expect(formatCollectivePeriod('2026-07-01', '2026-07-31')).toBe(
      '2026-07-01 a 2026-07-31'
    );
  });
});
