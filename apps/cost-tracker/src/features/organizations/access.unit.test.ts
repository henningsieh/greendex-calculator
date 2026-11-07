// @vitest-environment node
import { makeDynamicHangingPromise } from "next/dist/server/dynamic-rendering-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getFullOrganization: vi.fn(),
  hasPermissions: vi.fn(),
  assigned: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getFullOrganization: mocks.getFullOrganization } },
}));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/orpc/middleware", () => ({
  hasCostTrackerPermissions: mocks.hasPermissions,
}));
vi.mock("@/features/partnerships/procedures/assigned-partnerships", () => ({
  assignedPartnershipIds: mocks.assigned,
}));

import {
  canManageOrganization,
  canViewPartnerNetwork,
} from "@/features/organizations/access";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "user" },
    session: { activeOrganizationId: "organization" },
  });
  mocks.getFullOrganization.mockResolvedValue({
    members: [{ userId: "user", role: "participant" }],
  });
  mocks.hasPermissions.mockResolvedValue(false);
  mocks.assigned.mockResolvedValue([]);
});

describe("Organization presentation access failures", () => {
  it.each([
    ["management", canManageOrganization],
    ["Partner network", canViewPartnerNetwork],
  ] as const)(
    "propagates %s session IO prerender aborts without logging or denying access",
    async (_name, check) => {
      // Use the same hanging promise as Next's io(), without a server/build.
      const controller = new AbortController();
      const sessionIO = makeDynamicHangingPromise(
        controller.signal,
        "/[locale]/partner-organizations",
        "`io()`",
      );
      mocks.getSession.mockReturnValue(sessionIO);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const result = check();
        const rejection = expect(result).rejects.toMatchObject({
          digest: "HANGING_PROMISE_REJECTION",
          expression: "`io()`",
        });
        controller.abort();
        await rejection;
        expect(log).not.toHaveBeenCalled();
        expect(mocks.hasPermissions).not.toHaveBeenCalled();
        expect(mocks.assigned).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
      }
    },
  );

  it("allows Organization-wide readers without requiring assignments", async () => {
    mocks.hasPermissions.mockResolvedValue(true);
    expect(await canViewPartnerNetwork()).toBe(true);
    expect(mocks.hasPermissions).toHaveBeenCalledWith(expect.any(Headers), {
      project: ["read"],
      projectPartnership: ["read"],
    });
    expect(mocks.assigned).not.toHaveBeenCalled();
  });

  it("allows explicitly assigned coordinators in the active Organization", async () => {
    mocks.assigned.mockResolvedValue(["partnership"]);
    expect(await canViewPartnerNetwork()).toBe(true);
    expect(mocks.assigned).toHaveBeenCalledWith("user", "organization");
  });

  it.each([null, { user: { id: "user" }, session: {} }])(
    "denies missing session or active Organization",
    async (session) => {
      mocks.getSession.mockResolvedValue(session);
      expect(await canViewPartnerNetwork()).toBe(false);
      expect(mocks.hasPermissions).not.toHaveBeenCalled();
      expect(mocks.assigned).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["management", canManageOrganization, () => mocks.getFullOrganization],
    ["Partner network", canViewPartnerNetwork, () => mocks.assigned],
  ] as const)(
    "logs unexpected %s lookup failures while staying closed",
    async (_name, check, failureMock) => {
      const error = new Error("lookup unavailable");
      failureMock().mockRejectedValue(error);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(await check()).toBe(false);
        expect(log).toHaveBeenCalledWith(
          expect.stringContaining("access lookup failed"),
          { error },
        );
      } finally {
        log.mockRestore();
      }
    },
  );
  it("does not log ordinary permission refusals", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await canManageOrganization()).toBe(false);
      expect(await canViewPartnerNetwork()).toBe(false);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
