import {
  assignedPatientsByProfessional,
  clinicalPatients,
} from '@/services/repositories/demoData';
import { fail, ok } from '@/services/repositories/clinicalPortfolio/errors';
import type { ClinicalPortfolioRepository } from '@/services/repositories/clinicalPortfolio/contracts';
import type {
  ClinicalPortfolioContext,
  ClinicalPortfolioPatient,
  ClinicalPortfolioResult,
} from '@/services/repositories/clinicalPortfolio/types';

type MockClinicalAssignment = {
  organizationId: string;
  professionalId: string;
  userId: string;
  status: 'ativo' | 'inativo';
  assignmentReason: string;
};

type MockState = {
  clinicalAssignments: MockClinicalAssignment[];
};

function defaultAssignments(): MockClinicalAssignment[] {
  return Object.entries(assignedPatientsByProfessional).flatMap(([professionalId, userIds]) =>
    userIds.map((userId) => ({
      organizationId: 'org-1',
      professionalId,
      userId,
      status: 'ativo' as const,
      assignmentReason: 'acompanhamento',
    }))
  );
}

function displayNameFor(patientId: string): string {
  return clinicalPatients.find((item) => item.id === patientId)?.nome ?? 'Paciente';
}

function sortPatients(items: ClinicalPortfolioPatient[]): ClinicalPortfolioPatient[] {
  return [...items].sort((a, b) => {
    const byName = a.displayName.localeCompare(b.displayName);
    if (byName !== 0) return byName;
    return a.patientId.localeCompare(b.patientId);
  });
}

function validateContext(context: ClinicalPortfolioContext): ClinicalPortfolioResult<true> {
  if (!context.sessionUserId || !context.professionalUserId) return fail('NO_SESSION');
  if (context.sessionUserId !== context.professionalUserId) return fail('IDENTITY_MISMATCH');
  if (!context.organizationId) return fail('NO_ACTIVE_MEMBERSHIP');
  return ok(true);
}

export function createMockClinicalPortfolioRepository(
  input: { seed?: Partial<MockState> } = {}
): ClinicalPortfolioRepository {
  const state: MockState = {
    clinicalAssignments: input.seed?.clinicalAssignments ?? defaultAssignments(),
  };

  return {
    listLinkedClinicalPatients({ context }) {
      const validation = validateContext(context);
      if (!validation.ok) return Promise.resolve(validation);

      // Fail-closed for unknown professional without clinical mock role surface:
      // only professionals present in assignment map (or seed) may list.
      const hasAnyAssignmentRow = state.clinicalAssignments.some(
        (item) => item.professionalId === context.professionalUserId
      );
      const isKnownDemoProfessional = Object.prototype.hasOwnProperty.call(
        assignedPatientsByProfessional,
        context.professionalUserId
      );
      if (!hasAnyAssignmentRow && !isKnownDemoProfessional) {
        return Promise.resolve(fail('CLINICAL_ACCESS_DENIED'));
      }

      const patients = sortPatients(
        state.clinicalAssignments
          .filter(
            (item) =>
              item.organizationId === context.organizationId &&
              item.professionalId === context.professionalUserId &&
              item.status === 'ativo'
          )
          .map((item) => ({
            patientId: item.userId,
            displayName: displayNameFor(item.userId),
            organizationId: item.organizationId,
            assignmentStatus: item.status,
            assignmentReason: item.assignmentReason,
          }))
      );

      return Promise.resolve(ok(patients));
    },
  };
}
