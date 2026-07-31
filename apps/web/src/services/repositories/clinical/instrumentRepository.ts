/**
 * SUP-C04.2 — instrument clinical repository operations; never silent mock fallback (C04.2a).
 */

import {
  DEFAULT_CLINICAL_FALLBACK_POLICY,
  evaluateClinicalFallback,
  type ClinicalFallbackPolicy,
  type ClinicalOperationKind,
} from '@/services/repositories/clinical/fallbackPolicy';
import {
  createConsoleClinicalObservabilitySink,
  createCorrelationId,
  isClinicalResultLike,
  type ClinicalObservabilitySink,
} from '@/services/repositories/clinical/observability';
import type { ClinicalRepositoryMode, ClinicalRepositoryModule } from '@/services/repositories/clinical/repositoryMode';

export type ClinicalRepositoryInstrumentationOptions = {
  module: ClinicalRepositoryModule;
  mode: ClinicalRepositoryMode;
  operationKinds: Readonly<Record<string, ClinicalOperationKind>>;
  fallbackPolicy?: ClinicalFallbackPolicy;
  sink?: ClinicalObservabilitySink;
  now?: () => number;
  createCorrelationId?: () => string;
};

export function instrumentClinicalRepository<T extends object>(
  repository: T,
  options: ClinicalRepositoryInstrumentationOptions
): T {
  const policy = options.fallbackPolicy ?? DEFAULT_CLINICAL_FALLBACK_POLICY;
  const sink = options.sink ?? createConsoleClinicalObservabilitySink();
  const now = options.now ?? (() => performance.now());
  const newCorrelationId = options.createCorrelationId ?? createCorrelationId;

  return new Proxy(repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string' || typeof value !== 'function') {
        return value;
      }

      const operationKind = options.operationKinds[property];
      if (!operationKind) {
        return (...args: unknown[]) => Reflect.apply(value as (...a: unknown[]) => unknown, target, args);
      }

      return async (...args: unknown[]) => {
        const correlationId = newCorrelationId();
        const startedAt = now();

        sink({
          type: 'repository_op_start',
          severity: 'info',
          module: options.module,
          operation: property,
          operationKind,
          mode: options.mode,
          correlationId,
          timestamp: new Date().toISOString(),
        });

        let result: unknown;
        try {
          result = await Reflect.apply(value as (...a: unknown[]) => unknown, target, args);
        } catch (error: unknown) {
          const durationMs = Math.max(0, Math.round(now() - startedAt));
          sink({
            type: 'repository_op_error',
            severity: 'error',
            module: options.module,
            operation: property,
            operationKind,
            mode: options.mode,
            correlationId,
            durationMs,
            errorCode: 'UNEXPECTED_THROW',
            errorKind: 'technical',
            transient: false,
            outcome: 'error',
            timestamp: new Date().toISOString(),
          });
          throw error;
        }

        const durationMs = Math.max(0, Math.round(now() - startedAt));

        if (!isClinicalResultLike(result)) {
          sink({
            type: 'repository_op_end',
            severity: 'info',
            module: options.module,
            operation: property,
            operationKind,
            mode: options.mode,
            correlationId,
            durationMs,
            outcome: 'ok',
            timestamp: new Date().toISOString(),
          });
          return result;
        }

        if (result.ok) {
          sink({
            type: 'repository_op_end',
            severity: 'info',
            module: options.module,
            operation: property,
            operationKind,
            mode: options.mode,
            correlationId,
            durationMs,
            outcome: 'ok',
            timestamp: new Date().toISOString(),
          });
          return result;
        }

        const errorCode = result.error?.code ?? 'TECHNICAL_ERROR';
        const transient = result.error?.transient;
        const decision = evaluateClinicalFallback({
          errorCode,
          transient,
          operationKind,
          policy,
        });

        sink({
          type: 'repository_op_error',
          severity: 'error',
          module: options.module,
          operation: property,
          operationKind,
          mode: options.mode,
          correlationId,
          durationMs,
          errorCode,
          errorKind: result.error?.kind,
          transient,
          outcome: 'error',
          timestamp: new Date().toISOString(),
        });

        // C04.2a: never switch backends; keep original Result and record the block reason.
        sink({
          type: 'fallback_blocked',
          severity: 'warn',
          module: options.module,
          operation: property,
          operationKind,
          mode: options.mode,
          correlationId,
          durationMs,
          errorCode,
          errorKind: result.error?.kind,
          transient,
          blockReason: decision.allow ? 'data_switch_not_implemented' : decision.reason,
          timestamp: new Date().toISOString(),
        });

        return result;
      };
    },
  });
}
