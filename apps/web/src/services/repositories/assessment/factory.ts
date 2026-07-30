import { createMockAssessmentRepository } from '@/services/repositories/assessment/mockAssessmentRepository';
import {
  createSupabaseAssessmentRepository,
  type SupabaseAssessmentClient,
} from '@/services/repositories/assessment/supabaseAssessmentRepository';
import type { AssessmentRepository } from '@/services/repositories/assessment/contracts';

type AssessmentRepositoryMode = 'mock' | 'supabase';
type AssessmentRepositoryModeEnvironment = { VITE_ENABLE_SUPABASE_AUTH?: string };

export function resolveAssessmentRepositoryMode(
  env: AssessmentRepositoryModeEnvironment
): AssessmentRepositoryMode {
  const value = env.VITE_ENABLE_SUPABASE_AUTH;
  if (value === undefined || value === 'false') return 'mock';
  if (value === 'true') return 'supabase';
  throw new Error(`Valor invalido para VITE_ENABLE_SUPABASE_AUTH: "${value}"`);
}

export function createAssessmentRepositoryFactory(input: {
  mode: AssessmentRepositoryMode;
  supabaseClient?: SupabaseAssessmentClient | null;
}): AssessmentRepository {
  if (input.mode === 'mock') return createMockAssessmentRepository();
  if (!input.supabaseClient) throw new Error('Modo Supabase exige client por injecao.');
  return createSupabaseAssessmentRepository({ client: input.supabaseClient });
}
