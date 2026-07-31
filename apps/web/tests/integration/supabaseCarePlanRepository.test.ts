import { describe, expect, it } from 'vitest';
import {
  closeLinkedCarePlan,
  createLinkedCarePlan,
  createLinkedCarePlanAction,
  loadOpenCarePlan,
  updateLinkedCarePlan,
} from '@/domains/carePlan/carePlanService';
import {
  createSupabaseCarePlanRepository,
  type SupabaseCarePlanClient,
} from '@/services/repositories/carePlan/supabaseCarePlanRepository';
import type { CarePlanContext } from '@/services/repositories/carePlan/types';

type FakeError = { message?: string; code?: string };
type Row = Record<string, unknown>;

function context(overrides: Partial<CarePlanContext> = {}): CarePlanContext {
  return {
    sessionUserId: 'pro-1',
    professionalUserId: 'pro-1',
    organizationId: 'org-1',
    ...overrides,
  };
}

function now() {
  return '2026-07-31T12:00:00.000Z';
}

class FakeCarePlanClient {
  authUserId: string | null = 'pro-1';
  canManage = true;
  linkedPatients = new Set(['usr-1']);
  plans: Row[] = [];
  actions: Row[] = [];
  events: Row[] = [];
  deleted = false;

  auth = {
    getUser: () =>
      Promise.resolve({
        data: { user: this.authUserId ? { id: this.authUserId } : null },
        error: null,
      }),
  };

  rpc(fn: string, args?: Record<string, unknown>) {
    if (fn === 'can_manage_clinical_care_plan') {
      return Promise.resolve({ data: this.canManage, error: null });
    }
    if (fn === 'can_access_linked_patient_journey') {
      const raw = args?.['p_patient_user_id'];
      const patientId = typeof raw === 'string' ? raw : '';
      return Promise.resolve({ data: this.linkedPatients.has(patientId), error: null });
    }
    return Promise.resolve({ data: null, error: { code: '42883', message: `missing ${fn}` } });
  }

  from(table: string) {
    return {
      select: () => new SelectBuilder(this, table),
      insert: (values: Row) => new InsertBuilder(this, table, values),
      update: (values: Row) => new UpdateBuilder(this, table, values),
      delete: () => {
        this.deleted = true;
        return {
          eq: () => Promise.resolve({ data: null, error: { code: '42501', message: 'delete denied' } }),
        };
      },
    };
  }
}

class SelectBuilder {
  private filters: Array<{ column: string; value: unknown; op: 'eq' | 'in' }> = [];
  private ascending = true;
  private orderColumn: string | null = null;

  constructor(
    private readonly client: FakeCarePlanClient,
    private readonly table: string
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, value, op: 'eq' });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, value: values, op: 'in' });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.ascending = options?.ascending !== false;
    return this;
  }

  maybeSingle() {
    return this.run().then((result) => ({
      data: result.data[0] ?? null,
      error: result.error,
    }));
  }

  then<TResult1 = { data: Row[]; error: FakeError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: FakeError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.run().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private run() {
    const rows = this.tableRows();
    let filtered = rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.op === 'in') {
          return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
        }
        return row[filter.column] === filter.value;
      })
    );
    if (this.orderColumn) {
      const column = this.orderColumn;
      filtered = [...filtered].sort((a, b) => {
        const left = typeof a[column] === 'string' ? a[column] : '';
        const right = typeof b[column] === 'string' ? b[column] : '';
        return this.ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }
    return Promise.resolve({ data: filtered, error: null as FakeError | null });
  }

  private tableRows(): Row[] {
    if (this.table === 'care_plans') return this.client.plans;
    if (this.table === 'care_plan_actions') return this.client.actions;
    if (this.table === 'care_plan_events') return this.client.events;
    return [];
  }
}

class InsertBuilder {
  constructor(
    private readonly client: FakeCarePlanClient,
    private readonly table: string,
    private readonly values: Row
  ) {}

  select() {
    return {
      maybeSingle: () => this.maybeSingle(),
    };
  }

  maybeSingle() {
    if (this.table === 'care_plans') {
      const openExists = this.client.plans.some(
        (item) =>
          item['organization_id'] === this.values['organization_id'] &&
          item['professional_id'] === this.values['professional_id'] &&
          item['user_id'] === this.values['user_id'] &&
          item['status'] === 'ativo' &&
          (item['plan_status'] === 'planejado' || item['plan_status'] === 'em_andamento')
      );
      if (openExists) {
        return Promise.resolve({
          data: null,
          error: { code: '23505', message: 'care_plans_one_open_per_triplet' },
        });
      }
      if (this.values['professional_id'] !== this.client.authUserId) {
        return Promise.resolve({
          data: null,
          error: { code: '42501', message: 'professional_id forged' },
        });
      }
      const row: Row = {
        id: `cp-${this.client.plans.length + 1}`,
        created_at: now(),
        updated_at: now(),
        closed_at: null,
        closed_by: null,
        suspension_reason: null,
        last_reassessed_at: null,
        ...this.values,
      };
      this.client.plans.push(row);
      this.client.events.push({
        id: `cpe-${this.client.events.length + 1}`,
        care_plan_id: row['id'],
        care_plan_action_id: null,
        organization_id: row['organization_id'],
        user_id: row['user_id'],
        professional_id: row['professional_id'],
        event_kind: 'create',
        event_category: 'structural',
        payload: {},
        note: null,
        version_before: null,
        version_after: 1,
        authored_by: row['created_by'],
        created_at: now(),
      });
      return Promise.resolve({ data: row, error: null });
    }

    if (this.table === 'care_plan_actions') {
      const row: Row = {
        id: `cpa-${this.client.actions.length + 1}`,
        created_at: now(),
        updated_at: now(),
        completed_at: null,
        ...this.values,
      };
      this.client.actions.push(row);
      return Promise.resolve({ data: row, error: null });
    }

    if (this.table === 'care_plan_events') {
      const row: Row = {
        id: `cpe-${this.client.events.length + 1}`,
        created_at: now(),
        care_plan_action_id: null,
        version_before: null,
        version_after: null,
        ...this.values,
      };
      this.client.events.push(row);
      return Promise.resolve({ data: row, error: null });
    }

    return Promise.resolve({ data: null, error: { code: '42P01', message: 'unknown table' } });
  }
}

class UpdateBuilder {
  private filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private readonly client: FakeCarePlanClient,
    private readonly table: string,
    private readonly values: Row
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  select() {
    return {
      maybeSingle: () => this.maybeSingle(),
    };
  }

  maybeSingle() {
    const rows =
      this.table === 'care_plans'
        ? this.client.plans
        : this.table === 'care_plan_actions'
          ? this.client.actions
          : this.client.events;
    const index = rows.findIndex((row) => this.filters.every((filter) => row[filter.column] === filter.value));
    if (index < 0) return Promise.resolve({ data: null, error: null });
    const current = rows[index];
    if (
      this.table === 'care_plans' &&
      (current['plan_status'] === 'concluido' || current['plan_status'] === 'suspenso')
    ) {
      return Promise.resolve({ data: null, error: { code: '42501', message: 'plano encerrado imutavel' } });
    }
    rows[index] = { ...current, ...this.values, updated_at: now() };
    return Promise.resolve({ data: rows[index], error: null });
  }
}

describe('supabaseCarePlanRepository integration (fake client; nao prova RLS Postgres)', () => {
  it('persiste plano/acoes, impede segundo aberto e nega sem assignment', async () => {
    const client = new FakeCarePlanClient();
    const repository = createSupabaseCarePlanRepository({
      client: client as unknown as SupabaseCarePlanClient,
    });

    const created = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano sono',
      generalObjective: 'Melhorar sono',
      startsOn: '2026-07-31',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const action = await createLinkedCarePlanAction(repository, context(), {
      planId: created.data.id,
      specificObjective: 'Higiene do sono',
      actionText: 'Sem telas a noite',
      frequency: 'diaria',
    });
    expect(action.ok).toBe(true);

    const duplicate = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Outro',
      generalObjective: 'X',
      startsOn: '2026-07-31',
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error.code).toBe('OPEN_PLAN_EXISTS');

    const closed = await closeLinkedCarePlan(repository, context(), {
      planId: created.data.id,
      expectedVersion: created.data.version,
      mode: 'conclude',
    });
    expect(closed.ok).toBe(true);

    const next = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano 2',
      generalObjective: 'Manutencao',
      startsOn: '2026-08-01',
    });
    expect(next.ok).toBe(true);

    client.linkedPatients.clear();
    const denied = await loadOpenCarePlan(repository, context(), 'usr-1');
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('PATIENT_NOT_IN_PORTFOLIO');
  });

  it('nega gestao clinica e professional_id arbitrario na criacao', async () => {
    const client = new FakeCarePlanClient();
    client.canManage = false;
    const repository = createSupabaseCarePlanRepository({
      client: client as unknown as SupabaseCarePlanClient,
    });
    const denied = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'X',
      generalObjective: 'Y',
      startsOn: '2026-07-31',
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe('CLINICAL_ACCESS_DENIED');

    client.canManage = true;
    const forged = await createLinkedCarePlan(
      repository,
      context({ sessionUserId: 'pro-2', professionalUserId: 'pro-2' }),
      {
        patientId: 'usr-1',
        title: 'X',
        generalObjective: 'Y',
        startsOn: '2026-07-31',
      }
    );
    // authUserId still pro-1 => identity mismatch against context
    expect(forged.ok).toBe(false);
    if (forged.ok) return;
    expect(forged.error.code).toBe('IDENTITY_MISMATCH');
  });

  it('detecta conflito de versao no update', async () => {
    const client = new FakeCarePlanClient();
    const repository = createSupabaseCarePlanRepository({
      client: client as unknown as SupabaseCarePlanClient,
    });
    const created = await createLinkedCarePlan(repository, context(), {
      patientId: 'usr-1',
      title: 'Plano',
      generalObjective: 'Obj',
      startsOn: '2026-07-31',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const conflict = await updateLinkedCarePlan(repository, context(), {
      planId: created.data.id,
      expectedVersion: 99,
      title: 'Novo',
    });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.error.code).toBe('VERSION_CONFLICT');
    expect(client.deleted).toBe(false);
  });
});
