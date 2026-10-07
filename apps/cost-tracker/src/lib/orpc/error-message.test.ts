import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { hasComposedCopy, situationCatalog } from "@/lib/orpc/error-contract";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { createSituationErrors } from "@/lib/orpc/errors";

describe("safe situation presentation", () => {
  it("does not call incorrect credentials a missing session", () => {
    expect(
      getORPCRequestErrorMessage(createSituationErrors().invalidCredentials()),
    ).toEqual({ sessionExpired: false, text: "Incorrect email or password." });
    expect(
      getORPCRequestErrorMessage(createSituationErrors().unauthenticated())
        .sessionExpired,
    ).toBe(true);
  });
  it("shows Hosting scope copy, never arbitrary remote text", () => {
    expect(
      getORPCRequestErrorMessage(
        new ORPCError("FORBIDDEN", {
          message: "hostile",
          data: { reason: "HOST_COORDINATION_REQUIRED" },
        }),
      ),
    ).toEqual({
      sessionExpired: false,
      text: "You need Hosting Organization staff access or an assignment to this Project.",
    });
  });
  it.each([
    { reason: "HOST_COORDINATION_REQUIRED" },
    { reason: "SESSION_REQUIRED", private: "secret" },
    { reason: 123 },
  ])("ignores mismatched or malformed reason", (data) => {
    expect(
      getORPCRequestErrorMessage(
        new ORPCError("BAD_REQUEST", { message: "hostile", data }),
      ),
    ).toEqual({
      sessionExpired: false,
      text: "We could not complete that request. Check your details and try again.",
    });
  });
  it("masks composed copy behind the generic transport copy", () => {
    expect(
      getORPCRequestErrorMessage(
        createSituationErrors().projectCompletionBlocked([
          { name: "Group A", status: "submitted" },
        ]),
      ),
    ).toEqual({
      sessionExpired: false,
      text: situationCatalog.badInput.message,
    });
  });
});

it.each([
  ["NOT_FOUND", 404, "Resource not found in scope."],
  [
    "CONFLICT",
    409,
    "The resource state conflicts with this request. Reload and try again.",
  ],
  ["PAYLOAD_TOO_LARGE", 413, "The upload request is too large."],
  ["UNSUPPORTED_MEDIA_TYPE", 415, "Choose a PDF, JPEG, or PNG Proof Document."],
  [
    "UNPROCESSABLE_CONTENT",
    422,
    "The request cannot be completed with the current details.",
  ],
  [
    "INTERNAL_SERVER_ERROR",
    500,
    "The request could not be completed. Try again.",
  ],
  [
    "SERVICE_UNAVAILABLE",
    503,
    "The service is temporarily unavailable. Try again later.",
  ],
] as const)("safe generic %s/%s fallback", (code, _status, text) => {
  expect(
    getORPCRequestErrorMessage(
      new ORPCError(code, {
        message: "private SQL token",
        data: { reason: "UNKNOWN" },
      }),
    ),
  ).toEqual({ sessionExpired: false, text });
});
it("unknown codes never offer sign-in recovery", () => {
  expect(
    getORPCRequestErrorMessage(
      new ORPCError("UNKNOWN", {
        data: { reason: "SESSION_REQUIRED" },
        message: "hostile",
      }),
    ),
  ).toEqual({
    sessionExpired: false,
    text: "The request could not be completed. Try again.",
  });
});
it("network errors stay connectivity failures without exposing prose", () => {
  expect(getORPCRequestErrorMessage(new Error("private"))).toEqual({
    sessionExpired: false,
    text: "The server or network is unreachable. Check your connection and try again.",
  });
});

it.each(Object.entries(situationCatalog))(
  "renders approved %s copy, not remote prose",
  (_name, situation) => {
    const error = new ORPCError(situation.code, {
      message: "private SQL token",
      data: { reason: situation.reason },
    });
    const composed = hasComposedCopy(situation);
    expect(getORPCRequestErrorMessage(error)).toEqual({
      sessionExpired: situation.reason === "SESSION_REQUIRED",
      text: composed
        ? situationCatalog.badInput.message
        : situation.reason === "INTERNAL_FAILURE"
          ? "The request could not be completed. Try again."
          : situation.message,
    });
  },
);
