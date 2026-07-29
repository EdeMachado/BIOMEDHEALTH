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
  'pro-1': ['usr-1', 'usr-3', 'usr-4', 'usr-5'],
  'pro-2': ['usr-1', 'usr-3', 'usr-4', 'usr-5'],
};

export type CollectiveIndicator = {
  label: string;
  value: number;
  variation: string;
  reference: string;
  description: string;
};

export const collectiveIndicators: CollectiveIndicator[] = [
  {
    label: 'População elegível',
    value: 1250,
    variation: '+4,2%',
    reference: 'Últimos 30 dias',
    description: 'Total de pessoas aptas aos programas de prevenção.',
  },
  {
    label: 'Usuários cadastrados',
    value: 842,
    variation: '+6,8%',
    reference: 'Últimos 30 dias',
    description: 'Pessoas com cadastro ativo no ambiente demonstrativo.',
  },
  {
    label: 'Usuários ativos',
    value: 611,
    variation: '+2,9%',
    reference: 'Últimos 30 dias',
    description: 'Usuários com interação recente em jornadas e atividades.',
  },
  {
    label: 'Avaliações concluídas',
    value: 497,
    variation: '+5,1%',
    reference: 'Últimos 30 dias',
    description: 'Avaliações preventivas finalizadas no período.',
  },
];

export const riskDistribution = [
  { faixa: 'Baixo', quantidade: 280 },
  { faixa: 'Moderado', quantidade: 170 },
  { faixa: 'Atenção', quantidade: 47 },
];

export const trendByMonth = [
  { periodo: 'Jan', adesao: 61, avaliacoes: 44 },
  { periodo: 'Fev', adesao: 64, avaliacoes: 49 },
  { periodo: 'Mar', adesao: 67, avaliacoes: 52 },
  { periodo: 'Abr', adesao: 69, avaliacoes: 56 },
  { periodo: 'Mai', adesao: 73, avaliacoes: 61 },
  { periodo: 'Jun', adesao: 76, avaliacoes: 66 },
];

export const programDistribution = [
  { programa: 'Bem-estar e Prevenção', adesao: 238 },
  { programa: 'Saúde Cardiovascular', adesao: 182 },
  { programa: 'Sono e Recuperação', adesao: 147 },
  { programa: 'Saúde Mental', adesao: 109 },
];

export type ClinicalPatient = {
  id: string;
  nome: string;
  faixaEtaria: string;
  jornadaAtiva: string;
  ultimaAvaliacao: string;
  proximaAcao: string;
  statusAcompanhamento: 'Em acompanhamento' | 'Atenção' | 'Estável';
  profissionalResponsavel: string;
};

export const clinicalPatients: ClinicalPatient[] = [
  {
    id: 'usr-1',
    nome: 'Ana Demo',
    faixaEtaria: '35-44',
    jornadaAtiva: 'Bem-estar e Prevenção',
    ultimaAvaliacao: '29/07/2026',
    proximaAcao: 'Reavaliação em 26/08',
    statusAcompanhamento: 'Em acompanhamento',
    profissionalResponsavel: 'Dr. Lucas Demo',
  },
  {
    id: 'usr-3',
    nome: 'Carlos Exemplo',
    faixaEtaria: '45-54',
    jornadaAtiva: 'Sono e Recuperação',
    ultimaAvaliacao: '22/07/2026',
    proximaAcao: 'Contato educativo semanal',
    statusAcompanhamento: 'Atenção',
    profissionalResponsavel: 'Dr. Lucas Demo',
  },
  {
    id: 'usr-4',
    nome: 'Elisa Fictícia',
    faixaEtaria: '25-34',
    jornadaAtiva: 'Saúde Mental e Autocuidado',
    ultimaAvaliacao: '25/07/2026',
    proximaAcao: 'Ajuste de rotina de sono',
    statusAcompanhamento: 'Estável',
    profissionalResponsavel: 'Carla Profissional',
  },
  {
    id: 'usr-5',
    nome: 'João Demonstrativo',
    faixaEtaria: '55-64',
    jornadaAtiva: 'Saúde Cardiovascular',
    ultimaAvaliacao: '20/07/2026',
    proximaAcao: 'Reforçar hidratação e caminhada',
    statusAcompanhamento: 'Em acompanhamento',
    profissionalResponsavel: 'Carla Profissional',
  },
];

export const carePlanStatuses = ['Planejado', 'Em andamento', 'Concluído', 'Suspenso'] as const;

export function roleLabel(role: Role | 'nao_autenticado'): string {
  const map: Record<Role | 'nao_autenticado', string> = {
    usuario: 'Usuário',
    medico: 'Médico',
    profissional_saude: 'Profissional de saúde',
    gestor_clinico: 'Gestor clínico',
    gestor_institucional: 'Gestor institucional',
    sst: 'SST',
    admin_cliente: 'Administrador do cliente',
    admin_biomed: 'Administrador BioMed',
    auditor: 'Auditor',
    nao_autenticado: 'Não autenticado',
  };
  return map[role];
}

export function getRoleHomePath(role: Role): string {
  if (role === 'usuario') return '/minha-biomed';
  if (role === 'medico' || role === 'profissional_saude' || role === 'gestor_clinico') return '/clinica';
  return '/gestao';
}
