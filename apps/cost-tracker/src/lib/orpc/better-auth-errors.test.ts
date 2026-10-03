// @vitest-environment node
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import {
  normalizeBetterAuthError,
  normalizeBetterAuthResponse,
} from "@/lib/orpc/better-auth-errors";
import { createSituationErrors } from "@/lib/orpc/errors";

const errors = createSituationErrors();
describe("Better Auth error adapter", () => {
  it.each([
    ["USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION", "UNAUTHORIZED", "notMember"],
    ["NO_ACTIVE_ORGANIZATION", "BAD_REQUEST", "selectOrganization"],
    ["INVALID_EMAIL_OR_PASSWORD", "UNAUTHORIZED", "invalidCredentials"],
    ["EMAIL_NOT_VERIFIED", "FORBIDDEN", "verifyEmail"],
  ] as const)("maps %s before vendor status", async (code, status, method) => {
    const expected = errors[method]();
    const apiError = new APIError(status, {
      code,
      message: "private vendor text",
    });
    for (const actual of [
      normalizeBetterAuthError(apiError, errors),
      await normalizeBetterAuthResponse(
        Response.json(
          { code, message: "private" },
          { status: apiError.statusCode },
        ),
        errors,
      ),
    ]) {
      expect(actual).toMatchObject({
        code: expected.code,
        status: expected.status,
        message: expected.message,
        data: expected.data,
      });
    }
  });
  it.each([
    [400, "badInput"],
    [401, "unauthenticated"],
    [403, "accessDenied"],
    [404, "notFound"],
    [409, "conflict"],
    [422, "unprocessable"],
    [429, "rateLimited"],
    [503, "unavailable"],
    [500, "internalFailure"],
    [418, "internalFailure"],
  ] as const)("safe fallback for %i", async (status, method) => {
    const expected = errors[method]();
    expect(
      await normalizeBetterAuthResponse(
        Response.json({ message: "hostile" }, { status }),
        errors,
      ),
    ).toMatchObject({
      code: expected.code,
      status: expected.status,
      message: expected.message,
      data: expected.data,
    });
  });
  it.each(["not JSON", "x".repeat(5000), JSON.stringify({ code: 123 })])(
    "handles malformed/bounded body",
    async (body) => {
      expect(
        await normalizeBetterAuthResponse(
          new Response(body, { status: 403 }),
          errors,
        ),
      ).toMatchObject({ code: "FORBIDDEN", data: { reason: "ACCESS_DENIED" } });
    },
  );
  it("does not recognize forged vendor exceptions and preserves ORPC errors", () => {
    expect(
      normalizeBetterAuthError(
        {
          name: "APIError",
          statusCode: 401,
          body: { code: "INVALID_EMAIL_OR_PASSWORD" },
        },
        errors,
      ),
    ).toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    const original = errors.notMember();
    expect(normalizeBetterAuthError(original, errors)).toBe(original);
  });
  it("preserves failure cookies without forwarding private headers", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "a=1; Path=/");
    headers.append("set-cookie", "b=2; Path=/");
    headers.set("x-private", "secret");
    const target = new Headers();
    await normalizeBetterAuthResponse(
      new Response("{}", { status: 401, headers }),
      errors,
      target,
    );
    expect(target.getSetCookie()).toEqual(headers.getSetCookie());
    expect(target.has("x-private")).toBe(false);
    const apiTarget = new Headers();
    normalizeBetterAuthError(
      new APIError(
        "UNAUTHORIZED",
        { code: "INVALID_EMAIL_OR_PASSWORD" },
        headers,
      ),
      errors,
      apiTarget,
    );
    expect(apiTarget.getSetCookie()).toEqual(headers.getSetCookie());
  });
});
