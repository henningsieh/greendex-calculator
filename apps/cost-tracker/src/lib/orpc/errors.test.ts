// @vitest-environment node
import { describe, it, expect } from "vitest";

import { createSituationErrors } from "@/lib/orpc/errors";

describe("named situation errors", () => {
  it("unauthenticated fixes code/status/message/reason", () => {
    expect(createSituationErrors().unauthenticated()).toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Your session is missing or has expired. Sign in to continue.",
      data: { reason: "SESSION_REQUIRED" },
    });
  });
  it("invalidCredentials fixes code/status/message/reason", () => {
    expect(createSituationErrors().invalidCredentials()).toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Incorrect email or password.",
      data: { reason: "INVALID_CREDENTIALS" },
    });
  });
  it("selectOrganization fixes code/status/message/reason", () => {
    expect(createSituationErrors().selectOrganization()).toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      message:
        "Select an active Organization before accessing Cost Tracker data.",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
  });
  it("notMember fixes code/status/message/reason", () => {
    expect(createSituationErrors().notMember()).toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "Membership in the active Organization is required.",
      data: { reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    });
  });
  it("incompleteProfile fixes code/status/message/reason", () => {
    expect(createSituationErrors().incompleteProfile()).toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      status: 422,
      message: "Complete your Participant profile before accessing Projects.",
      data: { reason: "PARTICIPANT_PROFILE_REQUIRED" },
    });
  });
  it("agreementRequired fixes code/status/message/reason", () => {
    expect(createSituationErrors().agreementRequired()).toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message:
        "Accept the current Participant agreement before accessing Projects.",
      data: { reason: "PARTICIPANT_AGREEMENT_REQUIRED" },
    });
  });
  it("verifyEmail fixes code/status/message/reason", () => {
    expect(createSituationErrors().verifyEmail()).toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "Verify your email before continuing.",
      data: { reason: "EMAIL_VERIFICATION_REQUIRED" },
    });
  });
  it("hostCoordinationRequired fixes code/status/message/reason", () => {
    expect(createSituationErrors().hostCoordinationRequired()).toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message:
        "You need Hosting Organization staff access or an assignment to this Project.",
      data: { reason: "HOST_COORDINATION_REQUIRED" },
    });
  });
  it("badInput fixes code/status/message/reason", () => {
    expect(createSituationErrors().badInput()).toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      message:
        "We could not complete that request. Check your details and try again.",
      data: { reason: "INVALID_INPUT" },
    });
  });
  it("accessDenied fixes code/status/message/reason", () => {
    expect(createSituationErrors().accessDenied()).toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "You do not have permission to access this resource.",
      data: { reason: "ACCESS_DENIED" },
    });
  });
  it("notFound fixes code/status/message/reason", () => {
    expect(createSituationErrors().notFound()).toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Resource not found in scope.",
      data: { reason: "RESOURCE_NOT_FOUND" },
    });
  });
  it("conflict fixes code/status/message/reason", () => {
    expect(createSituationErrors().conflict()).toMatchObject({
      code: "CONFLICT",
      status: 409,
      message:
        "The resource state conflicts with this request. Reload and try again.",
      data: { reason: "STATE_CONFLICT" },
    });
  });
  it("unprocessable fixes code/status/message/reason", () => {
    expect(createSituationErrors().unprocessable()).toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      status: 422,
      message: "The request cannot be completed with the current details.",
      data: { reason: "UNPROCESSABLE_REQUEST" },
    });
  });
  it("rateLimited fixes code/status/message/reason", () => {
    expect(createSituationErrors().rateLimited()).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      status: 429,
      message: "Too many requests were sent. Wait a moment and try again.",
      data: { reason: "RATE_LIMITED" },
    });
  });
  it("unavailable fixes code/status/message/reason", () => {
    expect(createSituationErrors().unavailable()).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      message: "The service is temporarily unavailable. Try again later.",
      data: { reason: "SERVICE_UNAVAILABLE" },
    });
  });
  it("internalFailure fixes code/status/message/reason", () => {
    expect(createSituationErrors().internalFailure()).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Internal server error",
      data: { reason: "INTERNAL_FAILURE" },
    });
  });
});

it("projectNotFound fixes code/status/message/reason", () => {
  expect(createSituationErrors().projectNotFound()).toMatchObject({
    code: "NOT_FOUND",
    status: 404,
    message: "Project not found in scope.",
    data: { reason: "PROJECT_NOT_FOUND" },
  });
});

it("partnershipNotFound fixes code/status/message/reason", () => {
  expect(createSituationErrors().partnershipNotFound()).toMatchObject({
    code: "NOT_FOUND",
    status: 404,
    message: "Project Partnership not found in scope.",
    data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
  });
});

it("organizationManagementRequired fixes code/status/message/reason", () => {
  expect(createSituationErrors().organizationManagementRequired()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message:
      "You need Organization Owner or Admin access to manage this Organization.",
    data: { reason: "ORGANIZATION_MANAGEMENT_REQUIRED" },
  });
});

it("partnerCoordinationRequired fixes code/status/message/reason", () => {
  expect(createSituationErrors().partnerCoordinationRequired()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message:
      "You need Partner Organization staff access or an assignment to this Project Partnership.",
    data: { reason: "PARTNER_COORDINATION_REQUIRED" },
  });
});

it("coordinatorSelectionRequired fixes code/status/message/reason", () => {
  expect(createSituationErrors().coordinatorSelectionRequired()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message:
      "Select an Owner, Admin, or Project Coordinator in the Partner Organization.",
    data: { reason: "ELIGIBLE_COORDINATOR_REQUIRED" },
  });
});

it("invalidProjectCursor fixes code/status/message/reason", () => {
  expect(createSituationErrors().invalidProjectCursor()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "The Project page cursor is invalid for these filters.",
    data: { reason: "INVALID_PROJECT_CURSOR" },
  });
});

it("projectReadRequired fixes code/status/message/reason", () => {
  expect(createSituationErrors().projectReadRequired()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message: "The active Organization role cannot read this Project.",
    data: { reason: "PROJECT_READ_REQUIRED" },
  });
});

it("hostingStaffRequired fixes code/status/message/reason", () => {
  expect(createSituationErrors().hostingStaffRequired()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message:
      "You need Hosting Organization Owner, Admin, or Project Coordinator access.",
    data: { reason: "HOSTING_STAFF_REQUIRED" },
  });
});

it("hostingSideRequired fixes code/status/message/reason", () => {
  expect(createSituationErrors().hostingSideRequired()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message: "Only the Hosting Organization can assign this Project.",
    data: { reason: "HOSTING_SIDE_REQUIRED" },
  });
});

it("selfPartnership fixes code/status/message/reason", () => {
  expect(createSituationErrors().selfPartnership()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "The Hosting Organization cannot be its own Partner Organization.",
    data: { reason: "SELF_PARTNERSHIP" },
  });
});

it("partnerOrganizationNotFound fixes code/status/message/reason", () => {
  expect(createSituationErrors().partnerOrganizationNotFound()).toMatchObject({
    code: "NOT_FOUND",
    status: 404,
    message: "Partner Organization not found.",
    data: { reason: "PARTNER_ORGANIZATION_NOT_FOUND" },
  });
});

it("partnershipAlreadyAssigned fixes code/status/message/reason", () => {
  expect(createSituationErrors().partnershipAlreadyAssigned()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "This Organization is already assigned to the Project.",
    data: { reason: "PARTNERSHIP_ALREADY_ASSIGNED" },
  });
});

it("partnershipInvariant fixes code/status/message/reason", () => {
  expect(createSituationErrors().partnershipInvariant()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message:
      "This Project Partnership cannot be created with the selected Organizations.",
    data: { reason: "PARTNERSHIP_INVARIANT" },
  });
});

it("partnershipReferenced fixes code/status/message/reason", () => {
  expect(createSituationErrors().partnershipReferenced()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message:
      "Remove or reassign represented Project Participations before removing this Project Partnership.",
    data: { reason: "PARTNERSHIP_REFERENCED" },
  });
});

it("projectAlreadyCompleted fixes code/status/message/reason", () => {
  expect(createSituationErrors().projectAlreadyCompleted()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Project is already completed.",
    data: { reason: "PROJECT_ALREADY_COMPLETED" },
  });
});

it("setupLinkNotFound fixes code/status/message/reason", () => {
  expect(createSituationErrors().setupLinkNotFound()).toMatchObject({
    code: "NOT_FOUND",
    status: 404,
    message: "Setup link not found.",
    data: { reason: "SETUP_LINK_NOT_FOUND" },
  });
});

it("setupLinkWrongEmail fixes code/status/message/reason", () => {
  expect(createSituationErrors().setupLinkWrongEmail()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message: "This setup link belongs to another email address.",
    data: { reason: "SETUP_LINK_WRONG_EMAIL" },
  });
});

it("setupLinkDisabled fixes code/status/message/reason", () => {
  expect(createSituationErrors().setupLinkDisabled()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "This setup link is disabled.",
    data: { reason: "SETUP_LINK_DISABLED" },
  });
});

it("setupLinkExpired fixes code/status/message/reason", () => {
  expect(createSituationErrors().setupLinkExpired()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "This setup link has expired.",
    data: { reason: "SETUP_LINK_EXPIRED" },
  });
});

it("organizationOwnerRequired fixes code/status/message/reason", () => {
  expect(createSituationErrors().organizationOwnerRequired()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message: "You must be an Owner of the selected Organization.",
    data: { reason: "ORGANIZATION_OWNER_REQUIRED" },
  });
});

it("setupLinkUsed fixes code/status/message/reason", () => {
  expect(createSituationErrors().setupLinkUsed()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "This setup link has already been used.",
    data: { reason: "SETUP_LINK_USED" },
  });
});

it("staffInvitationRoleTooHigh fixes code/status/message/reason", () => {
  expect(createSituationErrors().staffInvitationRoleTooHigh()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message: "This invitation would grant a role above your own.",
    data: { reason: "STAFF_INVITATION_ROLE_TOO_HIGH" },
  });
});

it("staffInvitationNotFound fixes code/status/message/reason", () => {
  expect(createSituationErrors().staffInvitationNotFound()).toMatchObject({
    code: "NOT_FOUND",
    status: 404,
    message: "Organization Invitation not found.",
    data: { reason: "STAFF_INVITATION_NOT_FOUND" },
  });
});

it("staffInvitationWrongKind fixes code/status/message/reason", () => {
  expect(createSituationErrors().staffInvitationWrongKind()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "This invitation is not an Organization staff invitation.",
    data: { reason: "STAFF_INVITATION_WRONG_KIND" },
  });
});

it("staffInvitationClosed fixes code/status/message/reason", () => {
  expect(createSituationErrors().staffInvitationClosed()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Organization Invitation is no longer pending.",
    data: { reason: "STAFF_INVITATION_CLOSED" },
  });
});

it("staffInvitationExpired fixes code/status/message/reason", () => {
  expect(createSituationErrors().staffInvitationExpired()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Organization Invitation has expired.",
    data: { reason: "STAFF_INVITATION_EXPIRED" },
  });
});

it("staffInvitationWrongEmail fixes code/status/message/reason", () => {
  expect(createSituationErrors().staffInvitationWrongEmail()).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message: "Sign in with the invited email address.",
    data: { reason: "STAFF_INVITATION_WRONG_EMAIL" },
  });
});

it("invalidOrganizationRole fixes code/status/message/reason", () => {
  expect(createSituationErrors().invalidOrganizationRole()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message:
      'The "member" role is forbidden in Cost Tracker. Use a defined Organization role.',
    data: { reason: "INVALID_ORGANIZATION_ROLE" },
  });
});

it("projectCompletionBlocked preserves scoped names and statuses without changing 400 policy", () => {
  expect(
    createSituationErrors().projectCompletionBlocked([
      { name: "Group A", status: "submitted" },
      { name: "Group B", status: null },
    ]),
  ).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Cannot complete Project: Group A (submitted), Group B (no Claim).",
    data: { reason: "PROJECT_COMPLETION_BLOCKED" },
  });
});

it("registrationLinkNotFound fixes code/status/message/reason", () => {
  expect(createSituationErrors().registrationLinkNotFound()).toMatchObject({
    code: "NOT_FOUND",
    status: 404,
    message: "Registration link not found.",
    data: { reason: "REGISTRATION_LINK_NOT_FOUND" },
  });
});

it("registrationLinkClosed fixes code/status/message/reason", () => {
  expect(createSituationErrors().registrationLinkClosed()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Registration link is closed.",
    data: { reason: "REGISTRATION_LINK_CLOSED" },
  });
});

it("participantInvitationNotFound fixes code/status/message/reason", () => {
  expect(createSituationErrors().participantInvitationNotFound()).toMatchObject({
    code: "NOT_FOUND",
    status: 404,
    message: "Participant Invitation not found.",
    data: { reason: "PARTICIPANT_INVITATION_NOT_FOUND" },
  });
});

it("participantInvitationWrongAccount fixes code/status/message/reason", () => {
  expect(
    createSituationErrors().participantInvitationWrongAccount(),
  ).toMatchObject({
    code: "FORBIDDEN",
    status: 403,
    message: "Invitation is not for this account.",
    data: { reason: "PARTICIPANT_INVITATION_WRONG_ACCOUNT" },
  });
});

it("participantInvitationClosed fixes code/status/message/reason", () => {
  expect(createSituationErrors().participantInvitationClosed()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Invitation is closed.",
    data: { reason: "PARTICIPANT_INVITATION_CLOSED" },
  });
});

it("participantInvitationExpired fixes code/status/message/reason", () => {
  expect(createSituationErrors().participantInvitationExpired()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Participant Invitation has expired.",
    data: { reason: "PARTICIPANT_INVITATION_EXPIRED" },
  });
});

it("participantAlreadyParticipates fixes code/status/message/reason", () => {
  expect(createSituationErrors().participantAlreadyParticipates()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "This person already participates in this Project.",
    data: { reason: "PARTICIPANT_ALREADY_PARTICIPATES" },
  });
});

it("participantAlreadyInvited fixes code/status/message/reason", () => {
  expect(createSituationErrors().participantAlreadyInvited()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "This person already has an invitation to this Project.",
    data: { reason: "PARTICIPANT_ALREADY_INVITED" },
  });
});

it("joinedOtherPartner fixes code/status/message/reason", () => {
  expect(createSituationErrors().joinedOtherPartner()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message:
      "You already joined this Project through another Partner Organization.",
    data: { reason: "JOINED_OTHER_PARTNER" },
  });
});

it("membershipChanged fixes code/status/message/reason", () => {
  expect(createSituationErrors().membershipChanged()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Membership changed; please retry onboarding.",
    data: { reason: "MEMBERSHIP_CHANGED" },
  });
});

it("participationIdentityConflict fixes code/status/message/reason", () => {
  expect(createSituationErrors().participationIdentityConflict()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "This identity already participates in this Project.",
    data: { reason: "PARTICIPATION_IDENTITY_CONFLICT" },
  });
});

it("participantInvitationAccepted fixes code/status/message/reason", () => {
  expect(createSituationErrors().participantInvitationAccepted()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Accepted invitations cannot be changed.",
    data: { reason: "PARTICIPANT_INVITATION_ACCEPTED" },
  });
});

it("registrationClaimLocked fixes code/status/message/reason", () => {
  expect(createSituationErrors().registrationClaimLocked()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "A non-editable Claim prevents reopening registration.",
    data: { reason: "REGISTRATION_CLAIM_LOCKED" },
  });
});

it("agreementUnavailable fixes code/status/message/reason", () => {
  expect(createSituationErrors().agreementUnavailable()).toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
    message: "Participant agreement is not yet available.",
    data: { reason: "PARTICIPANT_AGREEMENT_UNAVAILABLE" },
  });
});
