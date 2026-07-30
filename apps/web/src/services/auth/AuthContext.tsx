import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { registerAuditEvent } from '@/domains/audit/auditTrail';
import { getSupabaseClient, validateSupabaseConfiguration } from '@/services/api/supabaseClient';
import { demoUsers, getRoleHomePath } from '@/services/repositories/demoData';
import {
  createAccessContextRepositoryFactory,
  resolveAccessRepositoryMode,
  resolveRuntimeEnvironment,
  type AccessRepositoryMode,
} from '@/services/repositories/access/factory';
import type { SupabaseAccessClient } from '@/services/repositories/access/supabaseAccessRepository';
import { readSessionItem, removeSessionItem, writeSessionItem } from '@/shared/lib/sessionStorage';
import type { Role, SessionUser } from '@/shared/types/access';
import type { AccessContext, AccessErrorCode, AccessIdentity } from '@/services/repositories/access/types';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const resolutionNonceRef = useRef(0);

  const modeResolution = useMemo(() => {
    try {
      return {
        mode: resolveAccessRepositoryMode(import.meta.env),
        error: null as string | null,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Modo de acesso inválido.';
      return {
        mode: null as AccessRepositoryMode | null,
        error: message,
      };
    }
  }, []);

  const mode = modeResolution.mode;
  const modeResolutionError = modeResolution.error;
  const [user, setUser] = useState<SessionUser | null>(() => {
    if (mode !== 'mock') return null;
    const raw = readSessionItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      return normalizeSessionUser(JSON.parse(raw));
    } catch {
      return null;
    }
  });

  const supabaseConfigError = mode === 'supabase' ? validateSupabaseConfiguration() : null;
  const supabaseClient = mode === 'supabase' && !supabaseConfigError ? getSupabaseClient() : null;

  const accessRepository = useMemo(() => {
    if (!mode) return null;
    const injectedSupabaseClient = supabaseClient as unknown as SupabaseAccessClient | null;
    try {
      return createAccessContextRepositoryFactory({
        mode,
        supabaseClient: injectedSupabaseClient,
        fallbackPolicy: {
          enableTransientFallback: false,
          runtime: resolveRuntimeEnvironment(import.meta.env),
        },
      });
    } catch {
      return null;
    }
  }, [mode, supabaseClient]);

  useEffect(() => {
    if (!accessRepository || !mode) {
      setUser(null);
      return;
    }

    const nonce = beginResolution(resolutionNonceRef);
    let disposed = false;

    const applyResolvedUser = (resolvedUser: SessionUser | null) => {
      if (disposed || !isResolutionCurrent(resolutionNonceRef, nonce)) return;
      setUser(resolvedUser);
    };

    const hydrate = async () => {
      if (mode === 'mock') {
        const restored = await hydrateMockUser(accessRepository);
        applyResolvedUser(restored);
        return;
      }

      if (!supabaseClient) {
        applyResolvedUser(null);
        return;
      }

      const selectedOrganizationId = readSessionItem(SUPABASE_ORG_STORAGE_KEY);
      if (!selectedOrganizationId) {
        applyResolvedUser(null);
        return;
      }

      const authSession = await supabaseClient.auth.getUser();
      const authUser = authSession.data.user;
      if (!authUser?.id) {
        applyResolvedUser(null);
        return;
      }

      const identity: AccessIdentity = {
        sessionUserId: authUser.id,
        userId: authUser.id,
        organizationId: selectedOrganizationId,
        selectedUnitId: null,
      };
      const resolved = await accessRepository.resolveAccessContext(identity);
      if (!resolved.ok) {
        applyResolvedUser(null);
        return;
      }

      const sessionUser = buildSessionUserFromAccessContext({
        context: resolved.data,
        nome: resolveDisplayName(authUser.email ?? '', authUser.user_metadata),
        email: authUser.email ?? '',
      });
      applyResolvedUser(sessionUser);
    };

    void hydrate();

    if (!supabaseClient || mode !== 'supabase') {
      return () => {
        disposed = true;
        invalidateResolution(resolutionNonceRef);
      };
    }

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange(() => {
      void hydrate();
    });

    return () => {
      disposed = true;
      invalidateResolution(resolutionNonceRef);
      subscription.unsubscribe();
    };
  }, [accessRepository, mode, supabaseClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(input) {
        if (modeResolutionError || !mode || !accessRepository) {
          return {
            ok: false,
            message: modeResolutionError ?? 'Não foi possível inicializar o resolvedor de acesso.',
          };
        }

        const nonce = beginResolution(resolutionNonceRef);

        if (mode === 'supabase') {
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

          const authSession = await supabaseClient.auth.getUser();
          const authUser = authSession.data.user;
          if (!authUser?.id) {
            await supabaseClient.auth.signOut();
            removeSessionItem(SUPABASE_ORG_STORAGE_KEY);
            return { ok: false, message: 'Sessão Supabase inválida após autenticação.' };
          }

          const identity: AccessIdentity = {
            sessionUserId: authUser.id,
            userId: authUser.id,
            organizationId: input.organizationId,
            selectedUnitId: null,
          };
          const resolved = await accessRepository.resolveAccessContext(identity);
          if (!resolved.ok) {
            await supabaseClient.auth.signOut();
            removeSessionItem(SUPABASE_ORG_STORAGE_KEY);
            registerAuditEvent({
              actorEmail: input.email,
              actorRole: 'nao_autenticado',
              organizationId: input.organizationId,
              action: 'login',
              entity: 'auth',
              result: 'negado',
              reason: resolved.error.code,
            });
            return {
              ok: false,
              message: toPublicAccessFailureMessage(resolved.error.code),
            };
          }

          const sessionUser = buildSessionUserFromAccessContext({
            context: resolved.data,
            nome: resolveDisplayName(authUser.email ?? input.email, authUser.user_metadata),
            email: authUser.email ?? input.email,
          });
          if (!isResolutionCurrent(resolutionNonceRef, nonce)) {
            return { ok: false, message: 'Sessão alterada durante autenticação.' };
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

        const foundCredentialUser = demoUsers.find(
          (candidate) =>
            candidate.email === input.email &&
            candidate.password === input.password &&
            candidate.organizationId === input.organizationId
        );

        if (!foundCredentialUser) {
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

        const identity: AccessIdentity = {
          sessionUserId: foundCredentialUser.id,
          userId: foundCredentialUser.id,
          organizationId: foundCredentialUser.organizationId,
          selectedUnitId: null,
        };
        const resolved = await accessRepository.resolveAccessContext(identity);
        if (!resolved.ok) {
          registerAuditEvent({
            actorEmail: input.email,
            actorRole: 'nao_autenticado',
            organizationId: input.organizationId,
            action: 'login',
            entity: 'auth',
            result: 'negado',
            reason: resolved.error.code,
          });
          return {
            ok: false,
            message: toPublicAccessFailureMessage(resolved.error.code),
          };
        }

        const sessionUser = buildSessionUserFromAccessContext({
          context: resolved.data,
          nome: foundCredentialUser.nome,
          email: foundCredentialUser.email,
        });

        if (!isResolutionCurrent(resolutionNonceRef, nonce)) {
          return { ok: false, message: 'Sessão alterada durante autenticação.' };
        }

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
        return { ok: true, redirectTo: getRoleHomePath(foundCredentialUser.role) };
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

        const nonce = beginResolution(resolutionNonceRef);
        removeSessionItem(AUTH_STORAGE_KEY);
        removeSessionItem(SUPABASE_ORG_STORAGE_KEY);
        setUser(null);

        if (supabaseClient) await supabaseClient.auth.signOut();
        if (!isResolutionCurrent(resolutionNonceRef, nonce)) return;
      },
    }),
    [accessRepository, mode, modeResolutionError, supabaseClient, supabaseConfigError, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function hydrateMockUser(
  accessRepository: NonNullable<ReturnType<typeof createAccessContextRepositoryFactory>>
): Promise<SessionUser | null> {
  const raw = readSessionItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  let restored: SessionUser | null = null;
  try {
    restored = normalizeSessionUser(JSON.parse(raw));
  } catch {
    restored = null;
  }

  if (!restored) {
    removeSessionItem(AUTH_STORAGE_KEY);
    return null;
  }

  const identity: AccessIdentity = {
    sessionUserId: restored.id,
    userId: restored.id,
    organizationId: restored.organizationId,
    selectedUnitId: null,
  };

  const resolved = await accessRepository.resolveAccessContext(identity);
  if (!resolved.ok) {
    removeSessionItem(AUTH_STORAGE_KEY);
    return null;
  }

  const source = demoUsers.find((item) => item.id === restored.id);
  return buildSessionUserFromAccessContext({
    context: resolved.data,
    nome: source?.nome ?? restored.nome,
    email: source?.email ?? restored.email,
  });
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}

function buildSessionUserFromAccessContext(input: {
  context: AccessContext;
  nome: string;
  email: string;
}): SessionUser {
  return {
    id: input.context.identity.userId as string,
    nome: input.nome,
    email: input.email,
    role: input.context.effectiveRole,
    roles: input.context.roles,
    organizationId: input.context.organization.id,
  };
}

function resolveDisplayName(email: string, metadata: unknown): string {
  if (metadata && typeof metadata === 'object') {
    const source = metadata as Record<string, unknown>;
    if (typeof source['nome'] === 'string' && source['nome'].length > 0) return source['nome'];
  }
  return email.split('@')[0] ?? 'Usuário';
}

function beginResolution(resolutionNonceRef: { current: number }): number {
  resolutionNonceRef.current += 1;
  return resolutionNonceRef.current;
}

function invalidateResolution(resolutionNonceRef: { current: number }) {
  resolutionNonceRef.current += 1;
}

function isResolutionCurrent(resolutionNonceRef: { current: number }, nonce: number): boolean {
  return resolutionNonceRef.current === nonce;
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

function toPublicAccessFailureMessage(errorCode: AccessErrorCode): string {
  if (
    errorCode === 'NO_ACTIVE_MEMBERSHIP' ||
    errorCode === 'MEMBERSHIP_INACTIVE' ||
    errorCode === 'NO_ACTIVE_ROLES'
  ) {
    return 'Seu usuário não possui vínculo ativo nesta organização.';
  }
  return 'Não foi possível resolver seu acesso para a organização selecionada.';
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
