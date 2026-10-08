// @vitest-environment node
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
vi.mock("@/features/projects/procedures/assigned-partnerships", () => ({
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
