import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { AreaLayout } from '@/app/layouts/AreaLayout';
import { RequireAuth, RequireRole } from '@/app/routes/guards';

const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const UserDashboardPage = lazy(() =>
  import('@/features/minha-biomed/UserDashboardPage').then((m) => ({ default: m.UserDashboardPage }))
);
const UserJourneyPage = lazy(() =>
  import('@/features/minha-biomed/UserSupportPages').then((m) => ({ default: m.UserJourneyPage }))
);
const UserActivitiesPage = lazy(() =>
  import('@/features/minha-biomed/UserSupportPages').then((m) => ({ default: m.UserActivitiesPage }))
);
const UserProfilePrivacyPage = lazy(() =>
  import('@/features/minha-biomed/UserSupportPages').then((m) => ({ default: m.UserProfilePrivacyPage }))
);
const UserAgendaPage = lazy(() =>
  import('@/features/minha-biomed/UserSupportPages').then((m) => ({ default: m.UserAgendaPage }))
);
const ClinicalOverviewPage = lazy(() =>
  import('@/features/biomed-clinica/ClinicalPages').then((m) => ({ default: m.ClinicalOverviewPage }))
);
const ClinicalAgendaPage = lazy(() =>
  import('@/features/biomed-clinica/ClinicalPages').then((m) => ({ default: m.ClinicalAgendaPage }))
);
const ClinicalPortfolioPage = lazy(() =>
  import('@/features/biomed-clinica/ClinicalPages').then((m) => ({ default: m.ClinicalPortfolioPage }))
);
const ClinicalRecordPage = lazy(() =>
  import('@/features/biomed-clinica/ClinicalPages').then((m) => ({ default: m.ClinicalRecordPage }))
);
const ClinicalAssessmentPage = lazy(() =>
  import('@/features/biomed-clinica/ClinicalPages').then((m) => ({ default: m.ClinicalAssessmentPage }))
);
const ClinicalCarePlanPage = lazy(() =>
  import('@/features/biomed-clinica/ClinicalPages').then((m) => ({ default: m.ClinicalCarePlanPage }))
);
const ClinicalAttendanceRecordPage = lazy(() =>
  import('@/features/biomed-clinica/ClinicalPages').then((m) => ({ default: m.ClinicalAttendanceRecordPage }))
);
const ManagementOverviewPage = lazy(() =>
  import('@/features/biomed-gestao/ManagementPages').then((m) => ({ default: m.ManagementOverviewPage }))
);
const ManagementCampaignsPage = lazy(() =>
  import('@/features/biomed-gestao/ManagementPages').then((m) => ({ default: m.ManagementCampaignsPage }))
);
const ManagementActionPlanPage = lazy(() =>
  import('@/features/biomed-gestao/ManagementPages').then((m) => ({ default: m.ManagementActionPlanPage }))
);
const ManagementAuditPage = lazy(() =>
  import('@/features/biomed-gestao/ManagementPages').then((m) => ({ default: m.ManagementAuditPage }))
);

function withLoader(component: ReactElement) {
  return <Suspense fallback={<div className="p-4 text-sm text-[var(--muted-foreground)]">Carregando...</div>}>{component}</Suspense>;
}

function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-lg rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-bold text-[var(--card-foreground)]">Acesso negado</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Seu perfil nao possui permissao para visualizar este recurso.
        </p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: withLoader(<LoginPage />) },
  { path: '/acesso-negado', element: <AccessDeniedPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireRole allow={['usuario']} />,
        children: [
          {
            path: '/minha-biomed',
            element: <AreaLayout area="minha-biomed" title="Minha BioMed" />,
            children: [
              { index: true, element: withLoader(<UserDashboardPage />) },
              { path: 'jornada', element: withLoader(<UserJourneyPage />) },
              { path: 'atividades', element: withLoader(<UserActivitiesPage />) },
              { path: 'agenda', element: withLoader(<UserAgendaPage />) },
              { path: 'perfil', element: withLoader(<UserProfilePrivacyPage />) },
            ],
          },
        ],
      },
      {
        element: <RequireRole allow={['medico', 'profissional_saude', 'gestor_clinico']} />,
        children: [
          {
            path: '/clinica',
            element: <AreaLayout area="clinica" title="BioMed Clinica" />,
            children: [
              { index: true, element: withLoader(<ClinicalOverviewPage />) },
              { path: 'agenda', element: withLoader(<ClinicalAgendaPage />) },
              { path: 'carteira', element: withLoader(<ClinicalPortfolioPage />) },
              { path: 'avaliacoes', element: withLoader(<ClinicalAssessmentPage />) },
              { path: 'ficha', element: withLoader(<ClinicalRecordPage />) },
              { path: 'plano-cuidado', element: withLoader(<ClinicalCarePlanPage />) },
              { path: 'registros', element: withLoader(<ClinicalAttendanceRecordPage />) },
            ],
          },
        ],
      },
      {
        element: <RequireRole allow={['gestor_institucional', 'sst', 'admin_cliente', 'admin_biomed', 'auditor']} />,
        children: [
          {
            path: '/gestao',
            element: <AreaLayout area="gestao" title="BioMed Gestao" />,
            children: [
              { index: true, element: withLoader(<ManagementOverviewPage />) },
              { path: 'campanhas', element: withLoader(<ManagementCampaignsPage />) },
              { path: 'indicadores', element: withLoader(<ManagementOverviewPage />) },
              { path: 'plano-acao', element: withLoader(<ManagementActionPlanPage />) },
              { path: 'auditoria', element: withLoader(<ManagementAuditPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
