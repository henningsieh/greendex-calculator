import { createRouterClient } from "@orpc/server";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node
import { getErrorStatus } from "@/lib/orpc/error-status";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  permission: vi.fn(),
  operation: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.session, hasPermission: mocks.permission } },
}));
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { authorized, requireCostTrackerPermissions } from "@/lib/orpc/middleware";

const procedure = authorized
  .use(requireCostTrackerPermissions({ project: ["read"] }))
  .handler(async () => {
    mocks.operation();
    return "allowed";
  });
const client = createRouterClient(
  { procedure },
  { context: { headers: new Headers() } },
);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    user: { id: "actor" },
    session: { activeOrganizationId: "own" },
  });
  mocks.permission.mockResolvedValue({ success: true });
});
describe("Cost Tracker permission middleware outcome matrix", () => {
  it.each([
    [
      "missing session",
      () => mocks.session.mockResolvedValue(null),
      "UNAUTHORIZED",
      401,
      "SESSION_REQUIRED",
      "Your session is missing or has expired. Sign in to continue.",
    ],
    [
      "missing selection",
      () =>
        mocks.session.mockResolvedValue({
          user: { id: "actor" },
          session: { activeOrganizationId: null },
        }),
      "BAD_REQUEST",
      400,
      "ACTIVE_ORGANIZATION_REQUIRED",
      "Select an active Organization before accessing Cost Tracker data.",
    ],
    [
      "known capability denial",
      () => mocks.permission.mockResolvedValue({ success: false }),
      "FORBIDDEN",
      403,
      "ACCESS_DENIED",
      "You do not have permission to access this resource.",
    ],
    [
      "authenticated non-member",
      () =>
        mocks.permission.mockRejectedValue(
          new APIError("UNAUTHORIZED", {
            code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
          }),
        ),
      "FORBIDDEN",
      403,
      "ORGANIZATION_MEMBERSHIP_REQUIRED",
      "Membership in the active Organization is required.",
    ],
  ] as const)(
    "%s fixes code/status/reason/message and browser recovery without proceeding",
    async (_name, arrange, code, status, reason, message) => {
      arrange();
      const error = await client.procedure().catch((error: unknown) => error);
      expect(error).toMatchObject({ code, message, data: { reason } });
      expect(getErrorStatus(code)).toBe(status);
      expect(getORPCRequestErrorMessage(error)).toEqual({
        sessionExpired: reason === "SESSION_REQUIRED",
        text: message,
      });
      expect(mocks.operation).not.toHaveBeenCalled();
      if (status === 400 || status === 401)
        expect(mocks.permission).not.toHaveBeenCalled();
    },
  );
  it("retains successful permission behavior", async () => {
    await expect(client.procedure()).resolves.toBe("allowed");
    expect(mocks.operation).toHaveBeenCalledOnce();
    expect(mocks.session).toHaveBeenCalledOnce();
    expect(mocks.permission).toHaveBeenCalledOnce();
  });
});
