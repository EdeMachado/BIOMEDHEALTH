import { z } from 'zod';

export const assessmentFormSchema = z.object({
  consentAccepted: z.boolean(),
  sleepHours: z.number().min(1).max(12),
  activityDays: z.number().min(0).max(7),
  stressLevel: z.number().min(0).max(10),
  sleepQuality: z.enum(['baixa', 'regular', 'boa']),
  sittingHours: z.number().min(0).max(16),
  hydration: z.enum(['baixa', 'moderada', 'adequada']),
  energyLevel: z.number().min(0).max(10),
  preventiveInterest: z.enum(['sono', 'movimento', 'estresse', 'rotina']),
});

export const assessmentCompletionSchema = assessmentFormSchema.refine(
  (value) => value.consentAccepted === true,
  {
    message: 'Voce precisa aceitar o consentimento.',
    path: ['consentAccepted'],
  }
);

export type AssessmentFormData = z.infer<typeof assessmentFormSchema>;

export const assessmentFormDefaultValues: AssessmentFormData = {
  consentAccepted: false,
  sleepHours: 7,
  activityDays: 3,
  stressLevel: 4,
  sleepQuality: 'regular',
  sittingHours: 7,
  hydration: 'moderada',
  energyLevel: 6,
  preventiveInterest: 'rotina',
};

export const assessmentStepTitles = [
  'Habitos e rotina',
  'Sono e recuperacao',
  'Movimento',
  'Bem-estar percebido',
  'Revisao e consentimento',
] as const;

export const assessmentStepFields: Array<Array<keyof AssessmentFormData>> = [
  ['preventiveInterest', 'sittingHours'],
  ['sleepHours', 'sleepQuality'],
  ['activityDays', 'hydration'],
  ['stressLevel', 'energyLevel'],
  ['consentAccepted'],
];
