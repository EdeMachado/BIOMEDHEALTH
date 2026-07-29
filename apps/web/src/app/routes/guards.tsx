import { Navigate, Outlet } from 'react-router-dom';
import { registerAuditEvent } from '@/domains/audit/auditTrail';
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
  if (!allow.includes(user.role)) {
    registerAuditEvent({
      actorEmail: user.email,
      actorRole: user.role,
      organizationId: user.organizationId,
      action: 'rota_negada',
      entity: 'autorizacao',
      result: 'negado',
      reason: 'Perfil sem permissao para a rota',
    });
    return <Navigate to="/acesso-negado" replace />;
  }
  return <Outlet />;
}

export function canProfessionalAccessUser(professionalId: string, userId: string): boolean {
  return (assignedPatientsByProfessional[professionalId] ?? []).includes(userId);
}
