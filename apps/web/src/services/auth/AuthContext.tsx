import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { registerAuditEvent } from '@/domains/audit/auditTrail';
import { getSupabaseClient, isSupabaseAuthEnabled, validateSupabaseConfiguration } from '@/services/api/supabaseClient';
import { demoUsers, getRoleHomePath } from '@/services/repositories/demoData';
import { readSessionItem, removeSessionItem, writeSessionItem } from '@/shared/lib/sessionStorage';
import type { Role, SessionUser } from '@/shared/types/access';

type LoginInput = {
  email: string;
  password: string;
  organizationId: string;
};

type LoginResult = { ok: boolean; message?: string; redirectTo?: string };

type AuthContextValue = {
  user: SessionUser | null;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_STORAGE_KEY = 'biomed_demo_session';
const SUPABASE_ORG_STORAGE_KEY = 'biomed_supabase_org_selection';
type SessionRoleBinding = {
  role: Role;
  unitId: string | null;
};

const ROLE_PRIORITY: Role[] = [
  'admin_biomed',
  'admin_cliente',
  'gestor_clinico',
  'medico',
  'profissional_saude',
  'gestor_institucional',
  'sst',
  'auditor',
  'usuario',
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseEnabled = isSupabaseAuthEnabled();
  const supabaseConfigError = validateSupabaseConfiguration();
  const supabaseClient = supabaseEnabled && !supabaseConfigError ? getSupabaseClient() : null;

  const [user, setUser] = useState<SessionUser | null>(() => {
    if (supabaseEnabled) return null;
    const raw = readSessionItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      return normalizeSessionUser(JSON.parse(raw));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!supabaseClient) return;
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(() => {
      void hydrateSupabaseUser(supabaseClient, setUser);
    });

    void hydrateSupabaseUser(supabaseClient, setUser);
    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(input) {
        if (supabaseEnabled) {
          if (supabaseConfigError || !supabaseClient) {
            return {
              ok: false,
              message: 'Autenticação Supabase habilitada sem configuração válida.',
            };
          }

          const { error } = await supabaseClient.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });

          if (error) {
            registerAuditEvent({
              actorEmail: input.email,
              actorRole: 'nao_autenticado',
              organizationId: input.organizationId,
              action: 'login',
              entity: 'auth',
              result: 'falha',
              reason: 'Falha no Supabase Auth',
            });
            return { ok: false, message: 'Credenciais inválidas para este ambiente demonstrativo.' };
          }

          writeSessionItem(SUPABASE_ORG_STORAGE_KEY, input.organizationId);
          const sessionUser = await resolveSupabaseSessionUser(supabaseClient, input.organizationId);
          if (!sessionUser) {
            await supabaseClient.auth.signOut();
            registerAuditEvent({
              actorEmail: input.email,
              actorRole: 'nao_autenticado',
              organizationId: input.organizationId,
              action: 'login',
              entity: 'auth',
              result: 'negado',
              reason: 'Usuário sem vínculo ativo na organização selecionada',
            });
            return { ok: false, message: 'Seu usuário não possui vínculo ativo nesta organização.' };
          }

          setUser(sessionUser);
          registerAuditEvent({
            actorEmail: sessionUser.email,
            actorRole: sessionUser.role,
            organizationId: sessionUser.organizationId,
            action: 'login',
            entity: 'auth',
            result: 'sucesso',
          });
          return { ok: true, redirectTo: getRoleHomePath(sessionUser.role) };
        }

        const found = demoUsers.find(
          (candidate) =>
            candidate.email === input.email &&
            candidate.password === input.password &&
            candidate.organizationId === input.organizationId
        );

        if (!found) {
          registerAuditEvent({
            actorEmail: input.email,
            actorRole: 'nao_autenticado',
            organizationId: input.organizationId,
            action: 'login',
            entity: 'auth',
            result: 'falha',
            reason: 'Credenciais inválidas',
          });
          return { ok: false, message: 'Credenciais inválidas para este ambiente demonstrativo.' };
        }

        const sessionUser: SessionUser = {
          id: found.id,
          nome: found.nome,
          email: found.email,
          role: found.role,
          roles: [found.role],
          organizationId: found.organizationId,
        };
        writeSessionItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
        registerAuditEvent({
          actorEmail: sessionUser.email,
          actorRole: sessionUser.role,
          organizationId: sessionUser.organizationId,
          action: 'login',
          entity: 'auth',
          result: 'sucesso',
        });
        setUser(sessionUser);
        return { ok: true, redirectTo: getRoleHomePath(found.role) };
      },
      async logout() {
        if (user) {
          registerAuditEvent({
            actorEmail: user.email,
            actorRole: user.role,
            organizationId: user.organizationId,
            action: 'logout',
            entity: 'auth',
            result: 'sucesso',
          });
        }
        if (supabaseClient) {
          await supabaseClient.auth.signOut();
          removeSessionItem(SUPABASE_ORG_STORAGE_KEY);
        }
        removeSessionItem(AUTH_STORAGE_KEY);
        setUser(null);
      },
    }),
    [supabaseClient, supabaseConfigError, supabaseEnabled, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}

async function hydrateSupabaseUser(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
  setUser: (user: SessionUser | null) => void
) {
  const selectedOrganizationId = readSessionItem(SUPABASE_ORG_STORAGE_KEY);
  if (!selectedOrganizationId) {
    setUser(null);
    return;
  }
  const resolved = await resolveSupabaseSessionUser(client, selectedOrganizationId);
  setUser(resolved);
}

async function resolveSupabaseSessionUser(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
  organizationId: string
): Promise<SessionUser | null> {
  const {
    data: { user: authUser },
  } = await client.auth.getUser();
  if (!authUser) return null;

  const { data: userOrganization } = await client
    .from('user_organizations')
    .select('id, organization_id, status')
    .eq('organization_id', organizationId)
    .eq('user_id', authUser.id)
    .eq('status', 'ativo')
    .maybeSingle();

  if (!userOrganization?.id) return null;

  const { data: roleRows } = await client
    .from('user_roles')
    .select('role_id, status, unit_id, roles(code)')
    .eq('user_organization_id', userOrganization.id)
    .eq('organization_id', organizationId)
    .eq('status', 'ativo');

  const roleBindings = resolveRoleBindings(roleRows ?? []);
  if (roleBindings.length === 0) return null;
  const role = resolveHighestRole(roleBindings);
  if (!role) return null;
  const roles = roleBindings.map((binding) => binding.role);

  const displayName =
    typeof authUser.user_metadata?.['nome'] === 'string' && authUser.user_metadata['nome'].length > 0
      ? authUser.user_metadata['nome']
      : authUser.email?.split('@')[0] ?? 'Usuário';

  return {
    id: authUser.id,
    nome: displayName,
    email: authUser.email ?? '',
    role,
    roles,
    organizationId,
  };
}

function resolveRoleBindings(rows: Array<{ unit_id?: string | null; roles?: { code?: string } | Array<{ code?: string }> }>): SessionRoleBinding[] {
  const entries = rows.flatMap((row) => {
    const unitId = typeof row.unit_id === 'string' ? row.unit_id : null;
    const value = row.roles;
    if (Array.isArray(value)) {
      return value
        .map((item) => item.code)
        .filter(isRoleCode)
        .map((role) => ({ role, unitId }));
    }
    if (value?.code && isKnownRole(value.code)) {
      return [{ role: value.code, unitId }];
    }
    return [];
  });

  const dedup = new Map<string, SessionRoleBinding>();
  for (const entry of entries) {
    dedup.set(`${entry.role}:${entry.unitId ?? 'global'}`, entry);
  }
  return [...dedup.values()];
}

function resolveHighestRole(bindings: SessionRoleBinding[]): Role | null {
  const roleCodes = bindings.map((binding) => binding.role);

  for (const priorityRole of ROLE_PRIORITY) {
    if (roleCodes.includes(priorityRole)) return priorityRole;
  }
  return null;
}

function normalizeSessionUser(raw: unknown): SessionUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<SessionUser> & { roles?: unknown };
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.nome !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.organizationId !== 'string' ||
    typeof candidate.role !== 'string' ||
    !isKnownRole(candidate.role)
  ) {
    return null;
  }
  const roles =
    Array.isArray(candidate.roles) && candidate.roles.length > 0
      ? candidate.roles.filter(isRoleCode)
      : [candidate.role];
  return {
    id: candidate.id,
    nome: candidate.nome,
    email: candidate.email,
    role: candidate.role,
    roles: roles.length > 0 ? roles : [candidate.role],
    organizationId: candidate.organizationId,
  };
}

function isRoleCode(value: string | undefined): value is Role {
  return typeof value === 'string' && isKnownRole(value);
}

function isKnownRole(value: string): value is Role {
  return (
    value === 'usuario' ||
    value === 'medico' ||
    value === 'profissional_saude' ||
    value === 'gestor_clinico' ||
    value === 'gestor_institucional' ||
    value === 'sst' ||
    value === 'admin_cliente' ||
    value === 'admin_biomed' ||
    value === 'auditor'
  );
}
