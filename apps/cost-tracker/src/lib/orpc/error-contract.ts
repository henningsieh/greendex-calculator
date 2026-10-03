import { z } from "zod";

export const situationCatalog = {
  unauthenticated: {
    code: "UNAUTHORIZED",
    status: 401,
    reason: "SESSION_REQUIRED",
    message: "Your session is missing or has expired. Sign in to continue.",
  },
  invalidCredentials: {
    code: "UNAUTHORIZED",
    status: 401,
    reason: "INVALID_CREDENTIALS",
    message: "Incorrect email or password.",
  },
  selectOrganization: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "ACTIVE_ORGANIZATION_REQUIRED",
    message: "Select an active Organization before accessing Cost Tracker data.",
  },
  notMember: {
    code: "FORBIDDEN",
    status: 403,
    reason: "ORGANIZATION_MEMBERSHIP_REQUIRED",
    message: "Membership in the active Organization is required.",
  },
  incompleteProfile: {
    code: "UNPROCESSABLE_CONTENT",
    status: 422,
    reason: "PARTICIPANT_PROFILE_REQUIRED",
    message: "Complete your Participant profile before accessing Projects.",
  },
  agreementRequired: {
    code: "FORBIDDEN",
    status: 403,
    reason: "PARTICIPANT_AGREEMENT_REQUIRED",
    message:
      "Accept the current Participant agreement before accessing Projects.",
  },
  verifyEmail: {
    code: "FORBIDDEN",
    status: 403,
    reason: "EMAIL_VERIFICATION_REQUIRED",
    message: "Verify your email before continuing.",
  },
  hostCoordinationRequired: {
    code: "FORBIDDEN",
    status: 403,
    reason: "HOST_COORDINATION_REQUIRED",
    message:
      "You need Hosting Organization staff access or an assignment to this Project.",
  },
  projectNotFound: {
    code: "NOT_FOUND",
    status: 404,
    reason: "PROJECT_NOT_FOUND",
    message: "Project not found in scope.",
  },
  partnershipNotFound: {
    code: "NOT_FOUND",
    status: 404,
    reason: "PROJECT_PARTNERSHIP_NOT_FOUND",
    message: "Project Partnership not found in scope.",
  },
  organizationManagementRequired: {
    code: "FORBIDDEN",
    status: 403,
    reason: "ORGANIZATION_MANAGEMENT_REQUIRED",
    message:
      "You need Organization Owner or Admin access to manage this Organization.",
  },
  partnerCoordinationRequired: {
    code: "FORBIDDEN",
    status: 403,
    reason: "PARTNER_COORDINATION_REQUIRED",
    message:
      "You need Partner Organization staff access or an assignment to this Project Partnership.",
  },
  coordinatorSelectionRequired: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "ELIGIBLE_COORDINATOR_REQUIRED",
    message:
      "Select an Owner, Admin, or Project Coordinator in the Partner Organization.",
  },
  invalidProjectCursor: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "INVALID_PROJECT_CURSOR",
    message: "The Project page cursor is invalid for these filters.",
  },
  projectReadRequired: {
    code: "FORBIDDEN",
    status: 403,
    reason: "PROJECT_READ_REQUIRED",
    message: "The active Organization role cannot read this Project.",
  },
  hostingStaffRequired: {
    code: "FORBIDDEN",
    status: 403,
    reason: "HOSTING_STAFF_REQUIRED",
    message:
      "You need Hosting Organization Owner, Admin, or Project Coordinator access.",
  },
  hostingSideRequired: {
    code: "FORBIDDEN",
    status: 403,
    reason: "HOSTING_SIDE_REQUIRED",
    message: "Only the Hosting Organization can assign this Project.",
  },
  selfPartnership: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "SELF_PARTNERSHIP",
    message: "The Hosting Organization cannot be its own Partner Organization.",
  },
  partnerOrganizationNotFound: {
    code: "NOT_FOUND",
    status: 404,
    reason: "PARTNER_ORGANIZATION_NOT_FOUND",
    message: "Partner Organization not found.",
  },
  partnershipAlreadyAssigned: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "PARTNERSHIP_ALREADY_ASSIGNED",
    message: "This Organization is already assigned to the Project.",
  },
  partnershipInvariant: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "PARTNERSHIP_INVARIANT",
    message:
      "This Project Partnership cannot be created with the selected Organizations.",
  },
  partnershipReferenced: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "PARTNERSHIP_REFERENCED",
    message:
      "Remove or reassign represented Project Participations before removing this Project Partnership.",
  },
  projectAlreadyCompleted: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "PROJECT_ALREADY_COMPLETED",
    message: "Project is already completed.",
  },
  setupLinkNotFound: {
    code: "NOT_FOUND",
    status: 404,
    reason: "SETUP_LINK_NOT_FOUND",
    message: "Setup link not found.",
  },
  setupLinkWrongEmail: {
    code: "FORBIDDEN",
    status: 403,
    reason: "SETUP_LINK_WRONG_EMAIL",
    message: "This setup link belongs to another email address.",
  },
  setupLinkDisabled: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "SETUP_LINK_DISABLED",
    message: "This setup link is disabled.",
  },
  setupLinkExpired: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "SETUP_LINK_EXPIRED",
    message: "This setup link has expired.",
  },
  organizationOwnerRequired: {
    code: "FORBIDDEN",
    status: 403,
    reason: "ORGANIZATION_OWNER_REQUIRED",
    message: "You must be an Owner of the selected Organization.",
  },
  setupLinkUsed: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "SETUP_LINK_USED",
    message: "This setup link has already been used.",
  },
  staffInvitationRoleTooHigh: {
    code: "FORBIDDEN",
    status: 403,
    reason: "STAFF_INVITATION_ROLE_TOO_HIGH",
    message: "This invitation would grant a role above your own.",
  },
  staffInvitationNotFound: {
    code: "NOT_FOUND",
    status: 404,
    reason: "STAFF_INVITATION_NOT_FOUND",
    message: "Organization Invitation not found.",
  },
  staffInvitationWrongKind: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "STAFF_INVITATION_WRONG_KIND",
    message: "This invitation is not an Organization staff invitation.",
  },
  staffInvitationClosed: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "STAFF_INVITATION_CLOSED",
    message: "Organization Invitation is no longer pending.",
  },
  staffInvitationExpired: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "STAFF_INVITATION_EXPIRED",
    message: "Organization Invitation has expired.",
  },
  staffInvitationWrongEmail: {
    code: "FORBIDDEN",
    status: 403,
    reason: "STAFF_INVITATION_WRONG_EMAIL",
    message: "Sign in with the invited email address.",
  },
  invalidOrganizationRole: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "INVALID_ORGANIZATION_ROLE",
    message:
      'The "member" role is forbidden in Cost Tracker. Use a defined Organization role.',
  },
  badInput: {
    code: "BAD_REQUEST",
    status: 400,
    reason: "INVALID_INPUT",
    message:
      "We could not complete that request. Check your details and try again.",
  },
  accessDenied: {
    code: "FORBIDDEN",
    status: 403,
    reason: "ACCESS_DENIED",
    message: "You do not have permission to access this resource.",
  },
  notFound: {
    code: "NOT_FOUND",
    status: 404,
    reason: "RESOURCE_NOT_FOUND",
    message: "Resource not found in scope.",
  },
  conflict: {
    code: "CONFLICT",
    status: 409,
    reason: "STATE_CONFLICT",
    message:
      "The resource state conflicts with this request. Reload and try again.",
  },
  unprocessable: {
    code: "UNPROCESSABLE_CONTENT",
    status: 422,
    reason: "UNPROCESSABLE_REQUEST",
    message: "The request cannot be completed with the current details.",
  },
  rateLimited: {
    code: "TOO_MANY_REQUESTS",
    status: 429,
    reason: "RATE_LIMITED",
    message: "Too many requests were sent. Wait a moment and try again.",
  },
  unavailable: {
    code: "SERVICE_UNAVAILABLE",
    status: 503,
    reason: "SERVICE_UNAVAILABLE",
    message: "The service is temporarily unavailable. Try again later.",
  },
  internalFailure: {
    code: "INTERNAL_SERVER_ERROR",
    status: 500,
    reason: "INTERNAL_FAILURE",
    message: "Internal server error",
  },
} as const;

export const ErrorReasonSchema = z.enum([
  "SESSION_REQUIRED",
  "INVALID_CREDENTIALS",
  "ACTIVE_ORGANIZATION_REQUIRED",
  "ORGANIZATION_MEMBERSHIP_REQUIRED",
  "PARTICIPANT_PROFILE_REQUIRED",
  "PARTICIPANT_AGREEMENT_REQUIRED",
  "EMAIL_VERIFICATION_REQUIRED",
  "HOST_COORDINATION_REQUIRED",
  "PROJECT_NOT_FOUND",
  "PROJECT_PARTNERSHIP_NOT_FOUND",
  "ORGANIZATION_MANAGEMENT_REQUIRED",
  "PARTNER_COORDINATION_REQUIRED",
  "ELIGIBLE_COORDINATOR_REQUIRED",
  "INVALID_PROJECT_CURSOR",
  "PROJECT_READ_REQUIRED",
  "HOSTING_STAFF_REQUIRED",
  "HOSTING_SIDE_REQUIRED",
  "SELF_PARTNERSHIP",
  "PARTNER_ORGANIZATION_NOT_FOUND",
  "PARTNERSHIP_ALREADY_ASSIGNED",
  "PARTNERSHIP_INVARIANT",
  "PARTNERSHIP_REFERENCED",
  "PROJECT_ALREADY_COMPLETED",
  "SETUP_LINK_NOT_FOUND",
  "SETUP_LINK_WRONG_EMAIL",
  "SETUP_LINK_DISABLED",
  "SETUP_LINK_EXPIRED",
  "ORGANIZATION_OWNER_REQUIRED",
  "SETUP_LINK_USED",
  "STAFF_INVITATION_ROLE_TOO_HIGH",
  "STAFF_INVITATION_NOT_FOUND",
  "STAFF_INVITATION_WRONG_KIND",
  "STAFF_INVITATION_CLOSED",
  "STAFF_INVITATION_EXPIRED",
  "STAFF_INVITATION_WRONG_EMAIL",
  "INVALID_ORGANIZATION_ROLE",
  "PROJECT_COMPLETION_BLOCKED",
  "INVALID_INPUT",
  "ACCESS_DENIED",
  "RESOURCE_NOT_FOUND",
  "STATE_CONFLICT",
  "UNPROCESSABLE_REQUEST",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_FAILURE",
]);
export const SafeErrorDataSchema = z
  .object({ reason: ErrorReasonSchema })
  .strict();
export const errorDefinitions = {
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

export function getSafeErrorSituation(error: {
  code: string;
  status: number;
  data?: unknown;
}) {
  const parsed = SafeErrorDataSchema.safeParse(error.data);
  if (!parsed.success) return undefined;
  return Object.values(situationCatalog).find(
    (s) =>
      s.reason === parsed.data.reason &&
      s.code === error.code &&
      s.status === error.status,
  );
}
