import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

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
});
