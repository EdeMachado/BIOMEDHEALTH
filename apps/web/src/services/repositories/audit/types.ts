import type { AuditEvent } from '@/domains/audit/types';

export type AuditRegisterInput = Omit<AuditEvent, 'id' | 'timestamp'>;

export interface AuditTrail {
  readonly mode: 'mock' | 'supabase';
  register(event: AuditRegisterInput): void;
  /** Sync snapshot for demo/tests. Supabase returns [] — use `list()` for persistence. */
  listSync(): AuditEvent[];
  list(): Promise<AuditEvent[]>;
}

export interface SupabaseAuditClient {
  auth: {
    getUser(): PromiseLike<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  };
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        order(column: string, options?: { ascending?: boolean }): {
          limit(count: number): PromiseLike<{
            data: Array<Record<string, unknown>> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
