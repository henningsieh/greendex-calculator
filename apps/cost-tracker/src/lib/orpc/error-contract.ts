import { z } from "zod";

import { getErrorStatus } from "@/lib/orpc/error-status";

export const situationCatalog = {
  unauthenticated: {
    code: "UNAUTHORIZED",
    reason: "SESSION_REQUIRED",
    message: "Your session is missing or has expired. Sign in to continue.",
  },
  organizationSlugTakenBeforeCreation: {
    code: "BAD_REQUEST",
    reason: "ORGANIZATION_SLUG_TAKEN_BEFORE_CREATION",
    message: "This Organization name is already in use. Choose another name.",
  },
  organizationNameTakenBeforeCreation: {
    code: "BAD_REQUEST",
    reason: "ORGANIZATION_NAME_TAKEN_BEFORE_CREATION",
    message: "This Organization name is already in use. Choose another name.",
  },
  organizationCreationDeniedBeforeCreation: {
    code: "FORBIDDEN",
    reason: "ORGANIZATION_CREATION_DENIED_BEFORE_CREATION",
    message:
      "Organization creation is unavailable. Check your invitations and Organization Memberships before continuing.",
  },
  invalidCredentials: {
    code: "UNAUTHORIZED",
    reason: "INVALID_CREDENTIALS",
    message: "Incorrect email or password.",
  },
  selectOrganization: {
    code: "BAD_REQUEST",
    reason: "ACTIVE_ORGANIZATION_REQUIRED",
    message: "Select an active Organization before accessing Cost Tracker data.",
  },
  notMember: {
    code: "FORBIDDEN",
    reason: "ORGANIZATION_MEMBERSHIP_REQUIRED",
    message: "Membership in the active Organization is required.",
  },
  incompleteProfile: {
    code: "UNPROCESSABLE_CONTENT",
    reason: "PARTICIPANT_PROFILE_REQUIRED",
    message: "Complete your Participant profile before accessing Projects.",
  },
  agreementRequired: {
    code: "FORBIDDEN",
    reason: "PARTICIPANT_AGREEMENT_REQUIRED",
    message:
      "Accept the current Participant agreement before accessing Projects.",
  },
  verifyEmail: {
    code: "FORBIDDEN",
    reason: "EMAIL_VERIFICATION_REQUIRED",
    message: "Verify your email before continuing.",
  },
  hostCoordinationRequired: {
    code: "FORBIDDEN",
    reason: "HOST_COORDINATION_REQUIRED",
    message:
      "You need Hosting Organization staff access or an assignment to this Project.",
  },
  projectNotFound: {
    code: "NOT_FOUND",
    reason: "PROJECT_NOT_FOUND",
    message: "Project not found in scope.",
  },
  partnershipNotFound: {
    code: "NOT_FOUND",
    reason: "PROJECT_PARTNERSHIP_NOT_FOUND",
    message: "Project Partnership not found in scope.",
  },
  organizationManagementRequired: {
    code: "FORBIDDEN",
    reason: "ORGANIZATION_MANAGEMENT_REQUIRED",
    message:
      "You need Organization Owner or Admin access to manage this Organization.",
  },
  partnerCoordinationRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_COORDINATION_REQUIRED",
    message:
      "You need Partner Organization staff access or an assignment to this Project Partnership.",
  },
  partnerEntryRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_ENTRY_REQUIRED",
    message:
      "Only the Partner Organization of this Project Partnership may issue participant entry points.",
  },
  coordinatorSelectionRequired: {
    code: "BAD_REQUEST",
    reason: "ELIGIBLE_COORDINATOR_REQUIRED",
    message:
      "Select an Owner, Admin, or Project Coordinator in the Partner Organization.",
  },
  invalidProjectCursor: {
    code: "BAD_REQUEST",
    reason: "INVALID_PROJECT_CURSOR",
    message: "The Project page cursor is invalid for these filters.",
  },
  projectReadRequired: {
    code: "FORBIDDEN",
    reason: "PROJECT_READ_REQUIRED",
    message: "The active Organization role cannot read this Project.",
  },
  hostingStaffRequired: {
    code: "FORBIDDEN",
    reason: "HOSTING_STAFF_REQUIRED",
    message:
      "You need Hosting Organization Owner, Admin, or Project Coordinator access.",
  },
  hostingSideRequired: {
    code: "FORBIDDEN",
    reason: "HOSTING_SIDE_REQUIRED",
    message: "Only the Hosting Organization can assign this Project.",
  },
  selfPartnership: {
    code: "BAD_REQUEST",
    reason: "SELF_PARTNERSHIP",
    message: "The Hosting Organization cannot be its own Partner Organization.",
  },
  partnerOrganizationNotFound: {
    code: "NOT_FOUND",
    reason: "PARTNER_ORGANIZATION_NOT_FOUND",
    message: "Partner Organization not found.",
  },
  partnershipAlreadyAssigned: {
    code: "CONFLICT",
    reason: "PARTNERSHIP_ALREADY_ASSIGNED",
    message: "This Organization is already assigned to the Project.",
  },
  partnershipInvariant: {
    code: "BAD_REQUEST",
    reason: "PARTNERSHIP_INVARIANT",
    message:
      "This Project Partnership cannot be created with the selected Organizations.",
  },
  partnershipReferenced: {
    code: "CONFLICT",
    reason: "PARTNERSHIP_REFERENCED",
    message:
      "Remove or reassign represented Project Participations before removing this Project Partnership.",
  },
  projectAlreadyCompleted: {
    code: "CONFLICT",
    reason: "PROJECT_ALREADY_COMPLETED",
    message: "Project is already completed.",
  },
  projectCompletionBlocked: {
    code: "CONFLICT",
    reason: "PROJECT_COMPLETION_BLOCKED",
    // Composed per request from the blocking Claims, so the declared copy is
    // only the prefix and clients never present it as a finished sentence.
    message: "Cannot complete Project:",
    composedCopy: true,
  },
  setupLinkNotFound: {
    code: "NOT_FOUND",
    reason: "SETUP_LINK_NOT_FOUND",
    message: "Setup link not found.",
  },
  setupLinkWrongEmail: {
    code: "FORBIDDEN",
    reason: "SETUP_LINK_WRONG_EMAIL",
    message: "This setup link belongs to another email address.",
  },
  setupLinkDisabled: {
    code: "CONFLICT",
    reason: "SETUP_LINK_DISABLED",
    message: "This setup link is disabled.",
  },
  setupLinkExpired: {
    code: "CONFLICT",
    reason: "SETUP_LINK_EXPIRED",
    message: "This setup link has expired.",
  },
  organizationOwnerRequired: {
    code: "FORBIDDEN",
    reason: "ORGANIZATION_OWNER_REQUIRED",
    message: "You must be an Owner of the selected Organization.",
  },
  setupLinkUsed: {
    code: "CONFLICT",
    reason: "SETUP_LINK_USED",
    message: "This setup link has already been used.",
  },
  staffInvitationRoleTooHigh: {
    code: "FORBIDDEN",
    reason: "STAFF_INVITATION_ROLE_TOO_HIGH",
    message: "This invitation would grant a role above your own.",
  },
  staffInvitationNotFound: {
    code: "NOT_FOUND",
    reason: "STAFF_INVITATION_NOT_FOUND",
    message: "Organization Invitation not found.",
  },
  staffInvitationWrongKind: {
    code: "BAD_REQUEST",
    reason: "STAFF_INVITATION_WRONG_KIND",
    message: "This invitation is not an Organization staff invitation.",
  },
  staffInvitationClosed: {
    code: "CONFLICT",
    reason: "STAFF_INVITATION_CLOSED",
    message: "Organization Invitation is no longer pending.",
  },
  staffInvitationRejected: {
    code: "CONFLICT",
    reason: "STAFF_INVITATION_REJECTED",
    message: "Organization Invitation was rejected.",
  },
  staffInvitationWithdrawn: {
    code: "CONFLICT",
    reason: "STAFF_INVITATION_WITHDRAWN",
    message: "Organization Invitation was withdrawn.",
  },
  staffInvitationAccepted: {
    code: "CONFLICT",
    reason: "STAFF_INVITATION_ACCEPTED",
    message:
      "Organization Invitation was accepted. Check your current Organization access.",
  },
  staffInvitationExpired: {
    code: "CONFLICT",
    reason: "STAFF_INVITATION_EXPIRED",
    message: "Organization Invitation has expired.",
  },
  staffInvitationWrongEmail: {
    code: "FORBIDDEN",
    reason: "STAFF_INVITATION_WRONG_EMAIL",
    message: "Sign in with the invited email address.",
  },
  invalidOrganizationRole: {
    code: "BAD_REQUEST",
    reason: "INVALID_ORGANIZATION_ROLE",
    message: "Use a defined Organization role.",
  },
  registrationLinkNotFound: {
    code: "NOT_FOUND",
    reason: "REGISTRATION_LINK_NOT_FOUND",
    message: "Registration link not found.",
  },
  registrationLinkClosed: {
    code: "CONFLICT",
    reason: "REGISTRATION_LINK_CLOSED",
    message: "Registration link is closed.",
  },
  participantInvitationNotFound: {
    code: "NOT_FOUND",
    reason: "PARTICIPANT_INVITATION_NOT_FOUND",
    message: "Participant Invitation not found.",
  },
  participantInvitationWrongAccount: {
    code: "FORBIDDEN",
    reason: "PARTICIPANT_INVITATION_WRONG_ACCOUNT",
    message: "Invitation is not for this account.",
  },
  participantInvitationClosed: {
    code: "CONFLICT",
    reason: "PARTICIPANT_INVITATION_CLOSED",
    message: "Invitation is closed.",
  },
  participantInvitationExpired: {
    code: "CONFLICT",
    reason: "PARTICIPANT_INVITATION_EXPIRED",
    message: "Participant Invitation has expired.",
  },
  participantAlreadyParticipates: {
    code: "CONFLICT",
    reason: "PARTICIPANT_ALREADY_PARTICIPATES",
    message: "This person already participates in this Project.",
  },
  participantAlreadyInvited: {
    code: "CONFLICT",
    reason: "PARTICIPANT_ALREADY_INVITED",
    message: "This person already has an invitation to this Project.",
  },
  joinedOtherPartner: {
    code: "CONFLICT",
    reason: "JOINED_OTHER_PARTNER",
    message:
      "You already joined this Project through another Partner Organization.",
  },
  membershipChanged: {
    code: "CONFLICT",
    reason: "MEMBERSHIP_CHANGED",
    message: "Membership changed; please retry onboarding.",
  },
  participationIdentityConflict: {
    code: "CONFLICT",
    reason: "PARTICIPATION_IDENTITY_CONFLICT",
    message: "This identity already participates in this Project.",
  },
  participantInvitationAccepted: {
    code: "CONFLICT",
    reason: "PARTICIPANT_INVITATION_ACCEPTED",
    message: "Accepted invitations cannot be changed.",
  },
  registrationClaimLocked: {
    code: "CONFLICT",
    reason: "REGISTRATION_CLAIM_LOCKED",
    message: "A non-editable Claim prevents reopening registration.",
  },
  agreementUnavailable: {
    code: "SERVICE_UNAVAILABLE",
    reason: "PARTICIPANT_AGREEMENT_UNAVAILABLE",
    message: "Participant agreement is not yet available.",
  },
  partnerClaimEditRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_CLAIM_EDIT_REQUIRED",
    message: "Only the Partner Organization may edit its Claim.",
  },
  payoutSelectionLocked: {
    code: "CONFLICT",
    reason: "PAYOUT_SELECTION_LOCKED",
    message:
      "Payout Account selection is locked while the Claim is not editable.",
  },
  partnerPayoutSelectionRequired: {
    code: "BAD_REQUEST",
    reason: "PARTNER_PAYOUT_SELECTION_REQUIRED",
    message: "Select a Payout Account belonging to the Partner Organization.",
  },
  payoutAccountRequired: {
    code: "BAD_REQUEST",
    reason: "PAYOUT_ACCOUNT_REQUIRED",
    message: "Select a Partner Payout Account before saving the Claim.",
  },
  claimNotEditable: {
    code: "CONFLICT",
    reason: "CLAIM_NOT_EDITABLE",
    message: "Claim is not editable.",
  },
  claimRequiredForCosts: {
    code: "BAD_REQUEST",
    reason: "CLAIM_REQUIRED_FOR_COSTS",
    message: "Save an editable Claim before adding costs.",
  },
  partnerCostsRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_COSTS_REQUIRED",
    message: "Only the Partner Organization may manage Claim costs.",
  },
  allocationParticipationRequired: {
    code: "BAD_REQUEST",
    reason: "ALLOCATION_PARTICIPATION_REQUIRED",
    message:
      "Each allocation must reference a Participation in this Project Partnership.",
  },
  costEntryRequired: {
    code: "BAD_REQUEST",
    reason: "COST_ENTRY_REQUIRED",
    message: "Cost entry does not belong to this Claim.",
  },
  claimDocumentReferencesRequired: {
    code: "BAD_REQUEST",
    reason: "CLAIM_DOCUMENT_REFERENCES_REQUIRED",
    message: "Cost entry and Proof Document must belong to this Claim.",
  },
  partnerJourneysRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_JOURNEYS_REQUIRED",
    message: "Only the Partner Organization may manage Participant Journeys.",
  },
  journeysLocked: {
    code: "CONFLICT",
    reason: "JOURNEYS_LOCKED",
    message: "Claim is locked; Participant Journeys cannot change.",
  },
  participationSelectionRequired: {
    code: "BAD_REQUEST",
    reason: "PARTICIPATION_SELECTION_REQUIRED",
    message: "Select a Participation in this Project Partnership.",
  },
  journeyAlreadyExists: {
    code: "CONFLICT",
    reason: "JOURNEY_ALREADY_EXISTS",
    message: "This Participation already has a Participant Journey.",
  },
  claimRequiredForJourney: {
    code: "BAD_REQUEST",
    reason: "CLAIM_REQUIRED_FOR_JOURNEY",
    message: "Save an editable Claim before updating a Participant Journey.",
  },
  journeySelectionRequired: {
    code: "BAD_REQUEST",
    reason: "JOURNEY_SELECTION_REQUIRED",
    message:
      "Select an existing Participant Journey in this Project Partnership.",
  },
  partnerOnboardingProgressRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_ONBOARDING_PROGRESS_REQUIRED",
    message:
      "Only the Partner Organization may read Participant onboarding progress.",
  },
  partnerParticipantSearchRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_PARTICIPANT_SEARCH_REQUIRED",
    message: "Only the Partner Organization may search onboarded Participants.",
  },
  partnerParticipationCreateRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_PARTICIPATION_CREATE_REQUIRED",
    message: "Only the Partner Organization may create its Participation.",
  },
  participationCreateLocked: {
    code: "CONFLICT",
    reason: "PARTICIPATION_CREATE_LOCKED",
    message: "Locked Claim prevents Participation creation.",
  },
  eligibleParticipantRequired: {
    code: "BAD_REQUEST",
    reason: "ELIGIBLE_PARTICIPANT_REQUIRED",
    message: "Select an eligible onboarded User or use a Participant invitation.",
  },
  participationDuplicate: {
    code: "CONFLICT",
    reason: "PARTICIPATION_DUPLICATE",
    message:
      "Identity already participates in this Project; request merge review.",
  },
  participationRepresentationConflict: {
    code: "BAD_REQUEST",
    reason: "PARTICIPATION_REPRESENTATION_CONFLICT",
    message: "Participation cannot be created for this Project Partnership.",
  },
  partnerParticipationUpdateRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_PARTICIPATION_UPDATE_REQUIRED",
    message: "Only the Partner Organization may update its Participation.",
  },
  participationUpdateLocked: {
    code: "CONFLICT",
    reason: "PARTICIPATION_UPDATE_LOCKED",
    message: "Locked Claim prevents Participation changes.",
  },
  participationNotFound: {
    code: "NOT_FOUND",
    reason: "PARTICIPATION_NOT_FOUND",
    message: "Participation not found in scope.",
  },
  partnerParticipationRemoveRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_PARTICIPATION_REMOVE_REQUIRED",
    message: "Only the Partner Organization may remove its Participation.",
  },
  participationRemoveLocked: {
    code: "CONFLICT",
    reason: "PARTICIPATION_REMOVE_LOCKED",
    message: "Locked Claim prevents Participation removal.",
  },
  participationJourneyOrCostReferenced: {
    code: "CONFLICT",
    reason: "PARTICIPATION_JOURNEY_OR_COST_REFERENCED",
    message:
      "Participation is referenced by a Participant Journey or Cost Allocation; request review instead.",
  },
  participationReferenced: {
    code: "CONFLICT",
    reason: "PARTICIPATION_REFERENCED",
    message: "Participation is referenced; request review instead.",
  },
  partnerDuplicateReviewRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_DUPLICATE_REVIEW_REQUIRED",
    message: "Only the Partner Organization may review duplicate identities.",
  },
  reviewTaskNotFound: {
    code: "NOT_FOUND",
    reason: "REVIEW_TASK_NOT_FOUND",
    message: "Review Task not found in scope.",
  },
  reviewTaskNotOpen: {
    code: "CONFLICT",
    reason: "REVIEW_TASK_NOT_OPEN",
    message: "Review Task is not open.",
  },
  reviewTaskNotAssigned: {
    code: "CONFLICT",
    reason: "REVIEW_TASK_NOT_ASSIGNED",
    message: "Review Task must be assigned before resolution.",
  },
  reviewTaskAssigneeRequired: {
    code: "FORBIDDEN",
    reason: "REVIEW_TASK_ASSIGNEE_REQUIRED",
    message: "Only the assigned reviewer may resolve this Review Task.",
  },
  reviewTaskSurvivorRequired: {
    code: "BAD_REQUEST",
    reason: "REVIEW_TASK_SURVIVOR_REQUIRED",
    message: "Review Task cannot be resolved with this survivor.",
  },
  partnerClaimPreviewRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_CLAIM_PREVIEW_REQUIRED",
    message: "Only the Partner Organization may preview its Claim.",
  },
  partnerClaimSubmitRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_CLAIM_SUBMIT_REQUIRED",
    message: "Only the Partner Organization may submit its Claim.",
  },
  claimRequiredForSubmission: {
    code: "BAD_REQUEST",
    reason: "CLAIM_REQUIRED_FOR_SUBMISSION",
    message: "Save an editable Claim before submitting.",
  },
  reviewReasonRequired: {
    code: "BAD_REQUEST",
    reason: "REVIEW_REASON_REQUIRED",
    message: "A review reason is required.",
  },
  hostingClaimReviewRequired: {
    code: "FORBIDDEN",
    reason: "HOSTING_CLAIM_REVIEW_REQUIRED",
    message: "Only Hosting staff may review Claims.",
  },
  claimNotFound: {
    code: "NOT_FOUND",
    reason: "CLAIM_NOT_FOUND",
    message: "Claim not found in scope.",
  },
  claimSubmittedRequired: {
    code: "CONFLICT",
    reason: "CLAIM_SUBMITTED_REQUIRED",
    message: "Claim must be submitted for this review decision.",
  },
  claimRejectedRequired: {
    code: "CONFLICT",
    reason: "CLAIM_REJECTED_REQUIRED",
    message: "Claim must be rejected for this review decision.",
  },
  claimReviewUnavailable: {
    code: "CONFLICT",
    reason: "CLAIM_REVIEW_UNAVAILABLE",
    message: "No submitted Claim is available for review.",
  },
  hostingPaymentRequired: {
    code: "FORBIDDEN",
    reason: "HOSTING_PAYMENT_REQUIRED",
    message: "Only Hosting staff may record payment.",
  },
  hostingPaymentCorrectionRequired: {
    code: "FORBIDDEN",
    reason: "HOSTING_PAYMENT_CORRECTION_REQUIRED",
    message: "Only Hosting staff may correct payment.",
  },
  claimApprovalRequired: {
    code: "CONFLICT",
    reason: "CLAIM_APPROVAL_REQUIRED",
    message: "Claim must be approved to record payment.",
  },
  fullTransferRequired: {
    code: "BAD_REQUEST",
    reason: "FULL_TRANSFER_REQUIRED",
    message: "Transfer must equal the full approved EUR amount.",
  },
  claimPaidRequired: {
    code: "CONFLICT",
    reason: "CLAIM_PAID_REQUIRED",
    message: "Only a paid Claim can have its paid flag corrected.",
  },
  journeyDistanceOutsideBands: {
    code: "BAD_REQUEST",
    reason: "JOURNEY_DISTANCE_OUTSIDE_BANDS",
    message: "Journey distance must have exactly one frozen funding band.",
  },
  submissionIncomplete: {
    code: "BAD_REQUEST",
    reason: "CLAIM_SUBMISSION_INCOMPLETE",
    message: "Claim submission checklist is incomplete.",
  },
  partnerDocumentsRequired: {
    code: "FORBIDDEN",
    reason: "PARTNER_DOCUMENTS_REQUIRED",
    message: "Only the Partner Organization may manage Proof Documents.",
  },
  proofNotFound: {
    code: "NOT_FOUND",
    reason: "PROOF_DOCUMENT_NOT_FOUND",
    message: "Proof Document not found in scope.",
  },
  proofSelectionRequired: {
    code: "BAD_REQUEST",
    reason: "PROOF_SELECTION_REQUIRED",
    message: "Select a file and Project Partnership.",
  },
  proofMediaUnsupported: {
    code: "UNSUPPORTED_MEDIA_TYPE",
    reason: "PROOF_MEDIA_UNSUPPORTED",
    message: "Choose a PDF, JPEG, or PNG Proof Document.",
  },
  proofFileTooLarge: {
    code: "PAYLOAD_TOO_LARGE",
    reason: "PROOF_FILE_TOO_LARGE",
    message: "Choose a Proof Document no larger than 10 MB.",
  },
  proofFileEmpty: {
    code: "BAD_REQUEST",
    reason: "PROOF_FILE_EMPTY",
    message: "Choose a non-empty Proof Document.",
  },
  proofFileNameRequired: {
    code: "BAD_REQUEST",
    reason: "PROOF_FILE_NAME_REQUIRED",
    message: "Choose a Proof Document with a file name.",
  },
  claimRequiredForProof: {
    code: "BAD_REQUEST",
    reason: "CLAIM_REQUIRED_FOR_PROOF",
    message: "Save an editable Claim before uploading a Proof Document.",
  },
  proofOriginDenied: {
    code: "FORBIDDEN",
    reason: "PROOF_ORIGIN_DENIED",
    message: "Invalid upload origin.",
  },
  proofTransportTooLarge: {
    code: "PAYLOAD_TOO_LARGE",
    reason: "PROOF_TRANSPORT_TOO_LARGE",
    message: "The upload request is too large.",
  },
  proofMultipartInvalid: {
    code: "BAD_REQUEST",
    reason: "PROOF_MULTIPART_INVALID",
    message: "Invalid multipart upload.",
  },
  proofUploadFailed: {
    code: "INTERNAL_SERVER_ERROR",
    reason: "PROOF_UPLOAD_FAILED",
    message: "Upload failed. Please try again.",
  },
  proofDownloadFailed: {
    code: "INTERNAL_SERVER_ERROR",
    reason: "PROOF_DOWNLOAD_FAILED",
    message: "Download failed. Please try again.",
  },
  badInput: {
    code: "BAD_REQUEST",
    reason: "INVALID_INPUT",
    message:
      "We could not complete that request. Check your details and try again.",
  },
  accessDenied: {
    code: "FORBIDDEN",
    reason: "ACCESS_DENIED",
    message: "You do not have permission to access this resource.",
  },
  notFound: {
    code: "NOT_FOUND",
    reason: "RESOURCE_NOT_FOUND",
    message: "Resource not found in scope.",
  },
  conflict: {
    code: "CONFLICT",
    reason: "STATE_CONFLICT",
    message:
      "The resource state conflicts with this request. Reload and try again.",
  },
  unprocessable: {
    code: "UNPROCESSABLE_CONTENT",
    reason: "UNPROCESSABLE_REQUEST",
    message: "The request cannot be completed with the current details.",
  },
  rateLimited: {
    code: "TOO_MANY_REQUESTS",
    reason: "RATE_LIMITED",
    message: "Too many requests were sent. Wait a moment and try again.",
  },
  unavailable: {
    code: "SERVICE_UNAVAILABLE",
    reason: "SERVICE_UNAVAILABLE",
    message: "The service is temporarily unavailable. Try again later.",
  },
  internalFailure: {
    code: "INTERNAL_SERVER_ERROR",
    reason: "INTERNAL_FAILURE",
    message: "Internal server error",
  },
} as const;

/**
 * Refusals the client seam may render as generic transport copy. The grouping
 * lives here so consumers derive codes from the catalog instead of restating
 * them; presentation overrides stay at the seam that renders them.
 */
export const genericClientRefusalNames = [
  "badInput",
  "unauthenticated",
  "accessDenied",
  "notFound",
  "conflict",
  "proofTransportTooLarge",
  "proofMediaUnsupported",
  "unprocessable",
  "rateLimited",
  "internalFailure",
  "unavailable",
] as const;

/** Catalog members whose Better Auth failure means server misconfiguration. */
export const membershipMisconfigurationNames = [
  "unauthenticated",
  "accessDenied",
  "notFound",
] as const;

// Declared reasons are the only reasons a client may send back. A duplicated
// reason would make a refusal's code ambiguous, so they are collapsed.
export const situationReasons = [
  ...new Set(
    Object.values(situationCatalog).map((situation) => situation.reason),
  ),
];
export const ErrorReasonSchema = z.enum(situationReasons);
export const fieldIssueCatalog = {
  journeyDistanceOutsideBands:
    "Journey distance must have exactly one frozen funding band.",
  payoutAccountRequired: "Select a Partner Payout Account.",
  entryRequired: "Add at least one Travel Cost Entry.",
  entryRequiredForCheck: "Add a Travel Cost Entry to check this requirement.",
  participationOutsidePartnership:
    "Covered Participation must belong to this Project Partnership.",
  journeyRequired: "Add a Participant Journey.",
  journeyOriginRequired: "Enter a Journey origin.",
  journeyDestinationRequired: "Enter a Journey destination.",
  journeyTripTypeRequired: "Select a Journey trip type.",
  journeyDistanceRequired: "Enter a positive exact Erasmus distance.",
  transportProfileOutsideRules:
    "Transport choice is not in this Project's frozen rules; replace the entry.",
  entryAmountRequired: "Entry amount must be positive exact EUR.",
  allocationRequired: "Allocate this entry to at least one Participation.",
  allocationSharesInvalid:
    "Use positive exact shares of the chosen method that total the entry amount (or 100%).",
  proofDocumentRequired: "Link a Proof Document belonging to this Claim.",
  fundingRulesRequired:
    "Project has no complete frozen funding rules; save a Participant Journey first.",
} as const;

export const FieldIssueIdSchema = z.enum(
  Object.keys(fieldIssueCatalog) as [
    keyof typeof fieldIssueCatalog,
    ...(keyof typeof fieldIssueCatalog)[],
  ],
);
export const SafeFieldIssueSchema = z
  .object({
    id: FieldIssueIdSchema,
    path: z.array(z.string()),
    message: z.string(),
  })
  .strict()
  .refine((issue) => issue.message === fieldIssueCatalog[issue.id]);
export type SafeFieldIssue = z.infer<typeof SafeFieldIssueSchema>;

export function createSafeFieldIssue(
  id: keyof typeof fieldIssueCatalog,
  path: string[],
): SafeFieldIssue {
  return { id, path, message: fieldIssueCatalog[id] };
}

export const ProjectCompletionBlockerSchema = z
  .object({
    name: z.string().min(1),
    status: z
      .enum([
        "editable",
        "correction_requested",
        "submitted",
        "approved",
        "rejected",
        "paid",
      ])
      .nullable(),
  })
  .strict();
export type ProjectCompletionBlocker = z.infer<
  typeof ProjectCompletionBlockerSchema
>;

export const SafeErrorDataSchema = z
  .object({
    reason: ErrorReasonSchema,
    issues: z.array(SafeFieldIssueSchema).optional(),
    blockers: z.array(ProjectCompletionBlockerSchema).optional(),
  })
  .strict()
  .superRefine((data, context) => {
    if (
      (data.issues !== undefined &&
        ![
          "CLAIM_SUBMISSION_INCOMPLETE",
          "JOURNEY_DISTANCE_OUTSIDE_BANDS",
        ].includes(data.reason)) ||
      (data.blockers !== undefined &&
        data.reason !== "PROJECT_COMPLETION_BLOCKED")
    )
      context.addIssue({
        code: "custom",
        message: "Details do not match the refusal.",
      });
  });
export const errorDefinitions = {
  PAYLOAD_TOO_LARGE: { message: "Payload too large" },
  UNSUPPORTED_MEDIA_TYPE: { message: "Unsupported media type" },
  BAD_REQUEST: { message: "Bad request" },
  NOT_FOUND: { message: "Resource not found" },
  FORBIDDEN: { message: "Access forbidden" },
  UNAUTHORIZED: { message: "Unauthorized" },
  TOO_MANY_REQUESTS: { message: "Too many requests" },
  INTERNAL_SERVER_ERROR: { message: "Internal server error" },
  CONFLICT: { message: "Conflict" },
  UNPROCESSABLE_CONTENT: { message: "Unprocessable content" },
  SERVICE_UNAVAILABLE: { message: "Service unavailable" },
};

export type Situation = (typeof situationCatalog)[keyof typeof situationCatalog];

/** Situations whose declared copy is only the prefix of a composed message. */
export function hasComposedCopy(situation: Situation): boolean {
  return "composedCopy" in situation;
}

/** Catalog-derived Response body: never interpolate vendor or raw prose. */
export function safeErrorResponseBody(situation: Situation) {
  return {
    error: situation.message,
    code: situation.code,
    reason: situation.reason,
  };
}

export function toSafeErrorResponse(situation: Situation) {
  return Response.json(safeErrorResponseBody(situation), {
    status: getErrorStatus(situation.code),
  });
}

const situationsByMetadata = new Map(
  Object.values(situationCatalog).map((situation) => [
    `${situation.reason}:${situation.code}`,
    situation,
  ]),
);

export function getSafeErrorSituation(error: { code: string; data?: unknown }) {
  const parsed = SafeErrorDataSchema.safeParse(error.data);
  if (!parsed.success) return undefined;
  return situationsByMetadata.get(`${parsed.data.reason}:${error.code}`);
}
