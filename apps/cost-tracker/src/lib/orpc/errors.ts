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
    invalidProjectCursor: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.invalidProjectCursor.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.invalidProjectCursor.reason,
        }),
      }),
    projectReadRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.projectReadRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.projectReadRequired.reason,
        }),
      }),
    hostingStaffRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.hostingStaffRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.hostingStaffRequired.reason,
        }),
      }),
    hostingSideRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.hostingSideRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.hostingSideRequired.reason,
        }),
      }),
    selfPartnership: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.selfPartnership.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.selfPartnership.reason,
        }),
      }),
    partnerOrganizationNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.partnerOrganizationNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerOrganizationNotFound.reason,
        }),
      }),
    partnershipAlreadyAssigned: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.partnershipAlreadyAssigned.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnershipAlreadyAssigned.reason,
        }),
      }),
    partnershipInvariant: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.partnershipInvariant.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnershipInvariant.reason,
        }),
      }),
    partnershipReferenced: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.partnershipReferenced.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnershipReferenced.reason,
        }),
      }),
    projectAlreadyCompleted: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.projectAlreadyCompleted.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.projectAlreadyCompleted.reason,
        }),
      }),
    setupLinkNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.setupLinkNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.setupLinkNotFound.reason,
        }),
      }),
    setupLinkWrongEmail: () =>
      errors.FORBIDDEN({
        message: situationCatalog.setupLinkWrongEmail.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.setupLinkWrongEmail.reason,
        }),
      }),
    setupLinkDisabled: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.setupLinkDisabled.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.setupLinkDisabled.reason,
        }),
      }),
    setupLinkExpired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.setupLinkExpired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.setupLinkExpired.reason,
        }),
      }),
    organizationOwnerRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.organizationOwnerRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.organizationOwnerRequired.reason,
        }),
      }),
    setupLinkUsed: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.setupLinkUsed.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.setupLinkUsed.reason,
        }),
      }),
    staffInvitationRoleTooHigh: () =>
      errors.FORBIDDEN({
        message: situationCatalog.staffInvitationRoleTooHigh.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.staffInvitationRoleTooHigh.reason,
        }),
      }),
    staffInvitationNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.staffInvitationNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.staffInvitationNotFound.reason,
        }),
      }),
    staffInvitationWrongKind: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.staffInvitationWrongKind.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.staffInvitationWrongKind.reason,
        }),
      }),
    staffInvitationClosed: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.staffInvitationClosed.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.staffInvitationClosed.reason,
        }),
      }),
    staffInvitationExpired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.staffInvitationExpired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.staffInvitationExpired.reason,
        }),
      }),
    staffInvitationWrongEmail: () =>
      errors.FORBIDDEN({
        message: situationCatalog.staffInvitationWrongEmail.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.staffInvitationWrongEmail.reason,
        }),
      }),
    invalidOrganizationRole: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.invalidOrganizationRole.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.invalidOrganizationRole.reason,
        }),
      }),
    projectCompletionBlocked: (
      blockers: readonly {
        name: string;
        status:
          | "editable"
          | "correction_requested"
          | "submitted"
          | "approved"
          | "rejected"
          | "paid"
          | null;
      }[],
    ) =>
      errors.BAD_REQUEST({
        message: `Cannot complete Project: ${blockers.map(({ name, status }) => `${name} (${status ?? "no Claim"})`).join(", ")}.`,
        data: SafeErrorDataSchema.parse({ reason: "PROJECT_COMPLETION_BLOCKED" }),
      }),
    registrationLinkNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.registrationLinkNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.registrationLinkNotFound.reason,
        }),
      }),
    registrationLinkClosed: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.registrationLinkClosed.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.registrationLinkClosed.reason,
        }),
      }),
    participantInvitationNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.participantInvitationNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participantInvitationNotFound.reason,
        }),
      }),
    participantInvitationWrongAccount: () =>
      errors.FORBIDDEN({
        message: situationCatalog.participantInvitationWrongAccount.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participantInvitationWrongAccount.reason,
        }),
      }),
    participantInvitationClosed: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participantInvitationClosed.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participantInvitationClosed.reason,
        }),
      }),
    participantInvitationExpired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participantInvitationExpired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participantInvitationExpired.reason,
        }),
      }),
    participantAlreadyParticipates: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participantAlreadyParticipates.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participantAlreadyParticipates.reason,
        }),
      }),
    participantAlreadyInvited: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participantAlreadyInvited.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participantAlreadyInvited.reason,
        }),
      }),
    joinedOtherPartner: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.joinedOtherPartner.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.joinedOtherPartner.reason,
        }),
      }),
    membershipChanged: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.membershipChanged.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.membershipChanged.reason,
        }),
      }),
    participationIdentityConflict: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationIdentityConflict.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationIdentityConflict.reason,
        }),
      }),
    participantInvitationAccepted: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participantInvitationAccepted.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participantInvitationAccepted.reason,
        }),
      }),
    registrationClaimLocked: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.registrationClaimLocked.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.registrationClaimLocked.reason,
        }),
      }),
    agreementUnavailable: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.agreementUnavailable.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.agreementUnavailable.reason,
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
