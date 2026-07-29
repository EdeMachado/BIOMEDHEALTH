import type { Organization, Role, SessionUser } from '@/shared/types/access';

export const organizations: Organization[] = [
  { id: 'org-1', nome: 'BioVale Energia' },
  { id: 'org-2', nome: 'Prefeitura Municipal Aurora' },
  { id: 'org-3', nome: 'Instituto Horizonte Tech' },
];

export const demoUsers: Array<SessionUser & { password: string }> = [
  {
    id: 'usr-1',
    nome: 'Ana Demo',
    email: 'usuario.demo@biomed.health',
    password: 'Demo@123',
    role: 'usuario',
    organizationId: 'org-1',
  },
  {
    id: 'pro-1',
    nome: 'Dr. Lucas Demo',
    email: 'medico.demo@biomed.health',
    password: 'Demo@123',
    role: 'medico',
    organizationId: 'org-1',
  },
  {
    id: 'pro-2',
    nome: 'Carla Profissional',
    email: 'profissional.demo@biomed.health',
    password: 'Demo@123',
    role: 'profissional_saude',
    organizationId: 'org-1',
  },
  {
    id: 'gcl-1',
    nome: 'Rafael Gestor Clinico',
    email: 'gestor.clinico@biomed.health',
    password: 'Demo@123',
    role: 'gestor_clinico',
    organizationId: 'org-1',
  },
  {
    id: 'gest-1',
    nome: 'Marina Gestora',
    email: 'gestor.demo@biomed.health',
    password: 'Demo@123',
    role: 'gestor_institucional',
    organizationId: 'org-1',
  },
  {
    id: 'sst-1',
    nome: 'Helena SST',
    email: 'sst.demo@biomed.health',
    password: 'Demo@123',
    role: 'sst',
    organizationId: 'org-1',
  },
  {
    id: 'adm-cli-1',
    nome: 'Paulo Admin Cliente',
    email: 'admin.cliente@biomed.health',
    password: 'Demo@123',
    role: 'admin_cliente',
    organizationId: 'org-1',
  },
  {
    id: 'adm-bio-1',
    nome: 'Sofia Admin BioMed',
    email: 'admin.biomed@biomed.health',
    password: 'Demo@123',
    role: 'admin_biomed',
    organizationId: 'org-1',
  },
  {
    id: 'aud-1',
    nome: 'Otavio Auditor',
    email: 'auditor.demo@biomed.health',
    password: 'Demo@123',
    role: 'auditor',
    organizationId: 'org-1',
  },
  {
    id: 'usr-2',
    nome: 'Bruno Demo',
    email: 'usuario.org2@biomed.health',
    password: 'Demo@123',
    role: 'usuario',
    organizationId: 'org-2',
  },
];

export const assignedPatientsByProfessional: Record<string, string[]> = {
  'pro-1': ['usr-1'],
  'pro-2': ['usr-1'],
};

export type CollectiveIndicator = {
  label: string;
  value: number;
};

export const collectiveIndicators: CollectiveIndicator[] = [
  { label: 'Populacao elegivel', value: 1250 },
  { label: 'Usuarios cadastrados', value: 842 },
  { label: 'Usuarios ativos', value: 611 },
  { label: 'Avaliacoes concluidas', value: 497 },
];

export const riskDistribution = [
  { faixa: 'Baixo', quantidade: 280 },
  { faixa: 'Moderado', quantidade: 170 },
  { faixa: 'Atencao', quantidade: 47 },
];

export function getRoleHomePath(role: Role): string {
  if (role === 'usuario') return '/minha-biomed';
  if (role === 'medico' || role === 'profissional_saude' || role === 'gestor_clinico') return '/clinica';
  return '/gestao';
}
