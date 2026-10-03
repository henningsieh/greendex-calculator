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
