/**
 * Operation kind maps for clinical repository instrumentation (SUP-C04.2).
 */

import type { ClinicalOperationKind } from '@/services/repositories/clinical/fallbackPolicy';

export const CLINICAL_AGENDA_OPERATION_KINDS = {
  listLinkedClinicalAppointments: 'read',
  createClinicalAppointment: 'write',
  updateClinicalAppointment: 'write',
} as const satisfies Record<string, ClinicalOperationKind>;

export const CLINICAL_PORTFOLIO_OPERATION_KINDS = {
  listLinkedClinicalPatients: 'read',
} as const satisfies Record<string, ClinicalOperationKind>;

export const CLINICAL_RECORD_OPERATION_KINDS = {
  getLinkedClinicalRecord: 'read',
  listClinicalRecordVersions: 'read',
  saveClinicalRecordDraft: 'write',
  concludeClinicalRecord: 'write',
  reopenClinicalRecord: 'write',
} as const satisfies Record<string, ClinicalOperationKind>;

export const CLINICAL_CARE_PLAN_OPERATION_KINDS = {
  listCarePlans: 'read',
  getOpenCarePlan: 'read',
  getCarePlanBundle: 'read',
  listCarePlanEvents: 'read',
  createCarePlan: 'write',
  updateCarePlan: 'write',
  createCarePlanAction: 'write',
  updateCarePlanAction: 'write',
  closeCarePlan: 'write',
  addCarePlanNote: 'write',
} as const satisfies Record<string, ClinicalOperationKind>;
