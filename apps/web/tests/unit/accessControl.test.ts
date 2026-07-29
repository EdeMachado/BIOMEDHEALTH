import { describe, expect, it } from 'vitest';
import { canProfessionalAccessUser } from '@/app/routes/guards';

describe('canProfessionalAccessUser', () => {
  it('permite acesso para usuario vinculado', () => {
    expect(canProfessionalAccessUser('pro-1', 'usr-1')).toBe(true);
  });

  it('nega acesso para usuario nao vinculado', () => {
    expect(canProfessionalAccessUser('pro-1', 'usr-999')).toBe(false);
  });
});
