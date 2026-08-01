import { describe, expect, it } from 'vitest';
import {
  canWriteCollective,
  sanitizeCollectiveUiMessage,
} from '@/features/biomed-gestao/collectiveUi';
import { collectiveError } from '@/services/repositories/collective/errors';

describe('collectiveUi helpers', () => {
  it('autoriza escrita apenas para papeis gerenciais', () => {
    expect(canWriteCollective('gestor_institucional')).toBe(true);
    expect(canWriteCollective('sst')).toBe(true);
    expect(canWriteCollective('admin_cliente')).toBe(true);
    expect(canWriteCollective('admin_biomed')).toBe(true);
    expect(canWriteCollective('auditor')).toBe(false);
    expect(canWriteCollective('medico')).toBe(false);
    expect(canWriteCollective('usuario')).toBe(false);
  });

  it('sanitiza mensagens sem expor detalhes tecnicos', () => {
    const msg = sanitizeCollectiveUiMessage(
      collectiveError('CROSS_TENANT_DATA', {
        cause: { source: 'repository', code: '42501', message: 'secret table dump' },
      })
    );
    expect(msg).not.toMatch(/secret|42501|table/i);
    expect(msg).toMatch(/nao autorizada/i);
  });
});
