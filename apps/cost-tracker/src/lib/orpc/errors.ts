import { ORPCError } from "@orpc/server";

import { SafeErrorDataSchema, situationCatalog } from "@/lib/orpc/error-contract";

type Situation = (typeof situationCatalog)[keyof typeof situationCatalog];
export type SituationErrorConstructors = {
  [Code in Situation["code"]]: (options: {
    message: string;
    data: { reason: string; issues?: { path: string[]; message: string }[] };
  }) => ORPCError<string, unknown>;
};

export function createSituationErrors(
  overrides: Partial<SituationErrorConstructors> = {},
) {
  const errors: SituationErrorConstructors = {
    PAYLOAD_TOO_LARGE: (options) => new ORPCError("PAYLOAD_TOO_LARGE", options),
    UNSUPPORTED_MEDIA_TYPE: (options) =>
      new ORPCError("UNSUPPORTED_MEDIA_TYPE", options),
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
    partnerClaimEditRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerClaimEditRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerClaimEditRequired.reason,
        }),
      }),
    payoutSelectionLocked: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.payoutSelectionLocked.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.payoutSelectionLocked.reason,
        }),
      }),
    partnerPayoutSelectionRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.partnerPayoutSelectionRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerPayoutSelectionRequired.reason,
        }),
      }),
    payoutAccountRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.payoutAccountRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.payoutAccountRequired.reason,
        }),
      }),
    claimNotEditable: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimNotEditable.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimNotEditable.reason,
        }),
      }),
    claimRequiredForCosts: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimRequiredForCosts.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimRequiredForCosts.reason,
        }),
      }),
    partnerCostsRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerCostsRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerCostsRequired.reason,
        }),
      }),
    allocationParticipationRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.allocationParticipationRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.allocationParticipationRequired.reason,
        }),
      }),
    costEntryRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.costEntryRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.costEntryRequired.reason,
        }),
      }),
    claimDocumentReferencesRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimDocumentReferencesRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimDocumentReferencesRequired.reason,
        }),
      }),
    partnerJourneysRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerJourneysRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerJourneysRequired.reason,
        }),
      }),
    journeysLocked: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.journeysLocked.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.journeysLocked.reason,
        }),
      }),
    participationSelectionRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationSelectionRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationSelectionRequired.reason,
        }),
      }),
    journeyAlreadyExists: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.journeyAlreadyExists.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.journeyAlreadyExists.reason,
        }),
      }),
    claimRequiredForJourney: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimRequiredForJourney.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimRequiredForJourney.reason,
        }),
      }),
    journeySelectionRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.journeySelectionRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.journeySelectionRequired.reason,
        }),
      }),
    partnerOnboardingProgressRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerOnboardingProgressRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerOnboardingProgressRequired.reason,
        }),
      }),
    partnerParticipantSearchRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerParticipantSearchRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerParticipantSearchRequired.reason,
        }),
      }),
    partnerParticipationCreateRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerParticipationCreateRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerParticipationCreateRequired.reason,
        }),
      }),
    participationCreateLocked: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationCreateLocked.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationCreateLocked.reason,
        }),
      }),
    eligibleParticipantRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.eligibleParticipantRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.eligibleParticipantRequired.reason,
        }),
      }),
    participationDuplicate: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationDuplicate.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationDuplicate.reason,
        }),
      }),
    participationRepresentationConflict: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationRepresentationConflict.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationRepresentationConflict.reason,
        }),
      }),
    partnerParticipationUpdateRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerParticipationUpdateRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerParticipationUpdateRequired.reason,
        }),
      }),
    participationUpdateLocked: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationUpdateLocked.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationUpdateLocked.reason,
        }),
      }),
    participationNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.participationNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationNotFound.reason,
        }),
      }),
    partnerParticipationRemoveRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerParticipationRemoveRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerParticipationRemoveRequired.reason,
        }),
      }),
    participationRemoveLocked: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationRemoveLocked.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationRemoveLocked.reason,
        }),
      }),
    participationJourneyOrCostReferenced: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationJourneyOrCostReferenced.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationJourneyOrCostReferenced.reason,
        }),
      }),
    participationReferenced: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.participationReferenced.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.participationReferenced.reason,
        }),
      }),
    partnerDuplicateReviewRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerDuplicateReviewRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerDuplicateReviewRequired.reason,
        }),
      }),
    reviewTaskNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.reviewTaskNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.reviewTaskNotFound.reason,
        }),
      }),
    reviewTaskNotOpen: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.reviewTaskNotOpen.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.reviewTaskNotOpen.reason,
        }),
      }),
    reviewTaskNotAssigned: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.reviewTaskNotAssigned.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.reviewTaskNotAssigned.reason,
        }),
      }),
    reviewTaskAssigneeRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.reviewTaskAssigneeRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.reviewTaskAssigneeRequired.reason,
        }),
      }),
    reviewTaskSurvivorRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.reviewTaskSurvivorRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.reviewTaskSurvivorRequired.reason,
        }),
      }),
    partnerClaimPreviewRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerClaimPreviewRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerClaimPreviewRequired.reason,
        }),
      }),
    partnerClaimSubmitRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerClaimSubmitRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerClaimSubmitRequired.reason,
        }),
      }),
    claimRequiredForSubmission: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimRequiredForSubmission.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimRequiredForSubmission.reason,
        }),
      }),
    reviewReasonRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.reviewReasonRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.reviewReasonRequired.reason,
        }),
      }),
    hostingClaimReviewRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.hostingClaimReviewRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.hostingClaimReviewRequired.reason,
        }),
      }),
    claimNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.claimNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimNotFound.reason,
        }),
      }),
    claimSubmittedRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimSubmittedRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimSubmittedRequired.reason,
        }),
      }),
    claimRejectedRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimRejectedRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimRejectedRequired.reason,
        }),
      }),
    claimReviewUnavailable: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimReviewUnavailable.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimReviewUnavailable.reason,
        }),
      }),
    hostingPaymentRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.hostingPaymentRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.hostingPaymentRequired.reason,
        }),
      }),
    hostingPaymentCorrectionRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.hostingPaymentCorrectionRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.hostingPaymentCorrectionRequired.reason,
        }),
      }),
    claimApprovalRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimApprovalRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimApprovalRequired.reason,
        }),
      }),
    fullTransferRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.fullTransferRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.fullTransferRequired.reason,
        }),
      }),
    claimPaidRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimPaidRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimPaidRequired.reason,
        }),
      }),
    journeyDistanceOutsideBands: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.journeyDistanceOutsideBands.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.journeyDistanceOutsideBands.reason,
          issues: [
            {
              path: ["erasmusDistanceKm"],
              message: situationCatalog.journeyDistanceOutsideBands.message,
            },
          ],
        }),
      }),
    submissionIncomplete: (issues: { path: string[]; message: string }[]) =>
      errors.BAD_REQUEST({
        message: situationCatalog.submissionIncomplete.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.submissionIncomplete.reason,
          issues,
        }),
      }),
    partnerDocumentsRequired: () =>
      errors.FORBIDDEN({
        message: situationCatalog.partnerDocumentsRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.partnerDocumentsRequired.reason,
        }),
      }),
    proofNotFound: () =>
      errors.NOT_FOUND({
        message: situationCatalog.proofNotFound.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofNotFound.reason,
        }),
      }),
    proofSelectionRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.proofSelectionRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofSelectionRequired.reason,
        }),
      }),
    proofMediaUnsupported: () =>
      errors.UNSUPPORTED_MEDIA_TYPE({
        message: situationCatalog.proofMediaUnsupported.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofMediaUnsupported.reason,
        }),
      }),
    proofFileTooLarge: () =>
      errors.PAYLOAD_TOO_LARGE({
        message: situationCatalog.proofFileTooLarge.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofFileTooLarge.reason,
        }),
      }),
    proofFileEmpty: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.proofFileEmpty.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofFileEmpty.reason,
        }),
      }),
    proofFileNameRequired: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.proofFileNameRequired.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofFileNameRequired.reason,
        }),
      }),
    claimRequiredForProof: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.claimRequiredForProof.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.claimRequiredForProof.reason,
        }),
      }),
    proofOriginDenied: () =>
      errors.FORBIDDEN({
        message: situationCatalog.proofOriginDenied.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofOriginDenied.reason,
        }),
      }),
    proofTransportTooLarge: () =>
      errors.PAYLOAD_TOO_LARGE({
        message: situationCatalog.proofTransportTooLarge.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofTransportTooLarge.reason,
        }),
      }),
    proofMultipartInvalid: () =>
      errors.BAD_REQUEST({
        message: situationCatalog.proofMultipartInvalid.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofMultipartInvalid.reason,
        }),
      }),
    proofUploadFailed: () =>
      errors.INTERNAL_SERVER_ERROR({
        message: situationCatalog.proofUploadFailed.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofUploadFailed.reason,
        }),
      }),
    proofDownloadFailed: () =>
      errors.INTERNAL_SERVER_ERROR({
        message: situationCatalog.proofDownloadFailed.message,
        data: SafeErrorDataSchema.parse({
          reason: situationCatalog.proofDownloadFailed.reason,
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
  FORBIDDEN?: (options: {
    message: string;
    data?: { reason: string };
  }) => ORPCError<string, unknown>;
};
