import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { registerAuditEvent } from '@/domains/audit/auditTrail';
import { demoUsers, getRoleHomePath } from '@/services/repositories/demoData';
import type { SessionUser } from '@/shared/types/access';

type LoginInput = {
  email: string;
  password: string;
  organizationId: string;
};

type AuthContextValue = {
  user: SessionUser | null;
  login: (input: LoginInput) => { ok: boolean; message?: string; redirectTo?: string };
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_STORAGE_KEY = 'biomed_demo_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login(input) {
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
            reason: 'Credenciais invalidas',
          });
          return { ok: false, message: 'Credenciais invalidas para este ambiente demonstrativo.' };
        }

        const sessionUser: SessionUser = {
          id: found.id,
          nome: found.nome,
          email: found.email,
          role: found.role,
          organizationId: found.organizationId,
        };
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
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
      logout() {
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
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
