import { describe, expect, it, vi } from 'vitest';
import { bootstrapAssessmentRepository } from '@/application/assessment';
import { bootstrapConsentRepository } from '@/application/consent';
import { bootstrapAuditTrail } from '@/application/audit';

describe('WP-03.2 application bootstraps fail-closed', () => {
  it('assessment never falls back to mock when supabase client is missing', () => {
    const result = bootstrapAssessmentRepository({
      env: { VITE_ENABLE_SUPABASE_AUTH: 'true' } as ImportMetaEnv,
      getClient: () => null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/fail-closed/i);
  });

  it('consent never falls back to mock when supabase client is missing', () => {
    const result = bootstrapConsentRepository({
      env: { VITE_ENABLE_SUPABASE_AUTH: 'true' } as ImportMetaEnv,
      getClient: () => null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/fail-closed/i);
  });

  it('audit adapter fails closed without silent sessionStorage fallback', () => {
    const result = bootstrapAuditTrail({
      env: { VITE_ENABLE_SUPABASE_AUTH: 'true' } as ImportMetaEnv,
      getClient: () => null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/fail-closed/i);
  });

  it('audit adapter injects supabase client when provided', () => {
    const client = {
      rpc: vi.fn(() => Promise.resolve({ data: 'id', error: null })),
      from: vi.fn(),
      auth: { getUser: vi.fn() },
    };
    const result = bootstrapAuditTrail({
      env: { VITE_AUDIT_TRAIL_MODE: 'supabase' } as ImportMetaEnv,
      getClient: () => client,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe('supabase');
  });
});
