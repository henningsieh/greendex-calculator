import { ORPCError } from "@orpc/server";

import { SafeErrorDataSchema, situationCatalog } from "@/lib/orpc/error-contract";

type Situation = (typeof situationCatalog)[keyof typeof situationCatalog];
export type SituationErrorConstructors = {
  [Code in Situation["code"]]: (options: {
    message: string;
    data: { reason: string };
  }) => ORPCError<string, unknown>;
};

export function createSituationErrors(
  overrides: Partial<SituationErrorConstructors> = {},
) {
  const errors: SituationErrorConstructors = {
    BAD_REQUEST: (options) => new ORPCError("BAD_REQUEST", options),
    UNAUTHORIZED: (options) => new ORPCError("UNAUTHORIZED", options),
    FORBIDDEN: (options) => new ORPCError("FORBIDDEN", options),
    NOT_FOUND: (options) => new ORPCError("NOT_FOUND", options),
    CONFLICT: (options) => new ORPCError("CONFLICT", options),
    UNPROCESSABLE_CONTENT: (options) =>
      new ORPCError("UNPROCESSABLE_CONTENT", options),
    TOO_MANY_REQUESTS: (options) => new ORPCError("TOO_MANY_REQUESTS", options),
    SERVICE_UNAVAILABLE: (options) =>
      new ORPCError("SERVICE_UNAVAILABLE", options),
    INTERNAL_SERVER_ERROR: (options) =>
      new ORPCError("INTERNAL_SERVER_ERROR", options),
    ...overrides,
  };
  return {
    unauthenticated: () =>
      errors.UNAUTHORIZED({
        message: situationCatalog.unauthenticated.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.unauthenticated.reason,
        }),
      }),
    invalidCredentials: () =>
      errors.UNAUTHORIZED({
        message: situationCatalog.invalidCredentials.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.invalidCredentials.reason,
        }),
      }),
    selectOrganization: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.selectOrganization.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.selectOrganization.reason,
        }),
      }),
    notMember: () =>
      errors.FORBIDDEN({
        message: situationCatalog.notMember.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.notMember.reason,
        }),
      }),
    incompleteProfile: () =>
      errors.UNPROCESSABLE_CONTENT({
        message: situationCatalog.incompleteProfile.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.incompleteProfile.reason,
        }),
      }),
    agreementRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.agreementRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.agreementRequired.reason,
        }),
      }),
    verifyEmail: () =>
      errors.FORBIDDEN({
        message: situationCatalog.verifyEmail.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.verifyEmail.reason,
        }),
      }),
    hostCoordinationRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.hostCoordinationRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.hostCoordinationRequired.reason,
        }),
      }),
    projectNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.projectNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.projectNotFound.reason,
        }),
      }),
    partnershipNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.partnershipNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnershipNotFound.reason,
        }),
      }),
    organizationManagementRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.organizationManagementRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.organizationManagementRequired.reason,
        }),
      }),
    partnerCoordinationRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerCoordinationRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerCoordinationRequired.reason,
        }),
      }),
    coordinatorSelectionRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.coordinatorSelectionRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.coordinatorSelectionRequired.reason,
        }),
      }),
    badInput: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.badInput.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.badInput.reason,
        }),
      }),
    accessDenied: () =>
      errors.FORBIDDEN({
        message: situationCatalog.accessDenied.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.accessDenied.reason,
        }),
      }),
    notFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.notFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.notFound.reason,
        }),
      }),
    conflict: () =>
      errors.CONFLICT({
        message: situationCatalog.conflict.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.conflict.reason,
        }),
      }),
    unprocessable: () =>
      errors.UNPROCESSABLE_CONTENT({
        message: situationCatalog.unprocessable.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.unprocessable.reason,
        }),
      }),
    rateLimited: () =>
      errors.TOO_MANY_REQUESTS({
        message: situationCatalog.rateLimited.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.rateLimited.reason,
        }),
      }),
    unavailable: () =>
      errors.SERVICE_UNAVAILABLE({
        message: situationCatalog.unavailable.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.unavailable.reason,
        }),
      }),
    internalFailure: () =>
      errors.INTERNAL_SERVER_ERROR({
        message: situationCatalog.internalFailure.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.internalFailure.reason,
        }),
      }),
  };
}

export type ScopeErrorConstructors = Partial<
  Pick<SituationErrorConstructors, "BAD_REQUEST" | "NOT_FOUND">
> & {
  FORBIDDEN: (options: {
    message: string;
    data?: { reason: string };
  }) => ORPCError<string, unknown>;
};
