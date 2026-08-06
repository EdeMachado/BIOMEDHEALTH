import { Navigate, Outlet } from 'react-router';
import { registerAuthenticatedAuthEvent } from '@/domains/audit/authAudit';
import { useAuth } from '@/services/auth/AuthContext';
import { assignedPatientsByProfessional } from '@/services/repositories/demoData';
import type { Role } from '@/shared/types/access';

type GuardProps = {
  allow: Role[];
};

export function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireRole({ allow }: GuardProps) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const activeRoles = user.roles?.length ? user.roles : [user.role];
  const allowed = allow.some((role) => activeRoles.includes(role));
  if (!allowed) {
    registerAuthenticatedAuthEvent({
      code: 'access_denied',
      actorEmail: user.email,
      actorRole: user.role,
      organizationId: user.organizationId,
      result: 'negado',
      provenance: 'application_precheck_denied',
    });
    return <Navigate to="/acesso-negado" replace />;
  }
  return <Outlet />;
}

export function canProfessionalAccessUser(professionalId: string, userId: string): boolean {
  return (assignedPatientsByProfessional[professionalId] ?? []).includes(userId);
}
