export const CLINICAL_RECORD_SCHEMA_VERSION = 'clinical_record.v1' as const;

export type ClinicalRecordSchemaVersion = typeof CLINICAL_RECORD_SCHEMA_VERSION;

export type ClinicalRecordStatus = 'rascunho' | 'concluido';

export type ClinicalRecordSectionKey =
  | 'identificacao_contexto'
  | 'motivo_acompanhamento'
  | 'habitos_rotina'
  | 'sono'
  | 'atividade_fisica'
  | 'alimentacao_percebida'
  | 'bem_estar'
  | 'antecedentes_informados'
  | 'alergias_informadas'
  | 'medicamentos_informados'
  | 'sinais_medidas_demonstrativas'
  | 'avaliacao_profissional_orientativa'
  | 'conduta_orientativa'
  | 'plano_acompanhamento';

export type ClinicalRecordSectionValue = {
  value: string;
};

export type ClinicalRecordSections = Partial<Record<ClinicalRecordSectionKey, ClinicalRecordSectionValue>> &
  Record<string, ClinicalRecordSectionValue | undefined>;

export type ClinicalRecordSectionDefinition = {
  key: ClinicalRecordSectionKey;
  label: string;
  /** Quando false, a UI nao exibe o campo, mas valores historicos permanecem no JSON. */
  active: boolean;
  requiredForConclusion: boolean;
};

/** Registro de secoes v1 — provisoriamente sujeito a validacao clinica. */
export const CLINICAL_RECORD_SECTION_DEFINITIONS: ClinicalRecordSectionDefinition[] = [
  { key: 'identificacao_contexto', label: 'Identificação e contexto', active: true, requiredForConclusion: false },
  { key: 'motivo_acompanhamento', label: 'Motivo do acompanhamento', active: true, requiredForConclusion: true },
  { key: 'habitos_rotina', label: 'Hábitos e rotina', active: true, requiredForConclusion: false },
  { key: 'sono', label: 'Sono', active: true, requiredForConclusion: false },
  { key: 'atividade_fisica', label: 'Atividade física', active: true, requiredForConclusion: false },
  { key: 'alimentacao_percebida', label: 'Alimentação percebida', active: true, requiredForConclusion: false },
  { key: 'bem_estar', label: 'Bem-estar', active: true, requiredForConclusion: false },
  { key: 'antecedentes_informados', label: 'Antecedentes informados', active: true, requiredForConclusion: false },
  { key: 'alergias_informadas', label: 'Alergias informadas', active: true, requiredForConclusion: false },
  { key: 'medicamentos_informados', label: 'Medicamentos informados', active: true, requiredForConclusion: false },
  {
    key: 'sinais_medidas_demonstrativas',
    label: 'Sinais e medidas demonstrativas',
    active: true,
    requiredForConclusion: false,
  },
  {
    key: 'avaliacao_profissional_orientativa',
    label: 'Avaliação profissional orientativa',
    active: true,
    requiredForConclusion: true,
  },
  { key: 'conduta_orientativa', label: 'Conduta orientativa', active: true, requiredForConclusion: true },
  { key: 'plano_acompanhamento', label: 'Plano de acompanhamento', active: true, requiredForConclusion: false },
];

export function emptyClinicalRecordSections(): ClinicalRecordSections {
  const sections: ClinicalRecordSections = {};
  for (const definition of CLINICAL_RECORD_SECTION_DEFINITIONS) {
    sections[definition.key] = { value: '' };
  }
  return sections;
}

export function mergeClinicalRecordSections(
  incoming: ClinicalRecordSections | null | undefined
): ClinicalRecordSections {
  const base = emptyClinicalRecordSections();
  if (!incoming || typeof incoming !== 'object') return base;
  for (const [key, raw] of Object.entries(incoming)) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as { value?: unknown };
    const value = typeof record.value === 'string' ? record.value : '';
    base[key] = { value };
  }
  return base;
}

export function sectionText(sections: ClinicalRecordSections, key: ClinicalRecordSectionKey): string {
  return sections[key]?.value?.trim() ?? '';
}

export function missingRequiredConclusionFields(sections: ClinicalRecordSections): ClinicalRecordSectionKey[] {
  return CLINICAL_RECORD_SECTION_DEFINITIONS.filter(
    (item) => item.active && item.requiredForConclusion && !sectionText(sections, item.key)
  ).map((item) => item.key);
}

export function deriveClinicalRecordSummary(sections: ClinicalRecordSections): string {
  const motivo = sectionText(sections, 'motivo_acompanhamento');
  if (motivo) return motivo.slice(0, 200);
  return 'Rascunho clínico';
}
