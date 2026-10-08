// @vitest-environment node
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), listMembers: vi.fn() }));
vi.mock("@/lib/better-auth", () => ({ auth: { api: mocks } }));

import { searchMembers } from "@/features/organizations/procedures";

const client = createRouterClient(
  { searchMembers },
  { context: { headers: new Headers() } },
);
const role = ORGANIZATION_ROLES;
const rows = [
  role.ProjectCoordinator,
  role.Participant,
  role.OrganizationAdmin,
  role.OrganizationOwner,
].map((storedRole, index) => ({
  id: `membership-${index}`,
  organizationId: "org-id",
  userId: `user-${index}`,
  role: storedRole,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  user: {
    id: `user-${index}`,
    name: `User ${index}`,
    email: `user-${index}@example.org`,
    image: null,
  },
}));

beforeEach(() => {
  mocks.getSession.mockResolvedValue({
    session: { id: "session-id", activeOrganizationId: "org-id" },
    user: { id: "user-id" },
  });
  mocks.listMembers.mockResolvedValue({ members: rows });
});

describe("Calculator Membership role sorting", () => {
  it.each(["asc", "desc"] as const)(
    "ranks roles in descending hierarchy (%s)",
    async (sortDirection) => {
      const result = await client.searchMembers({
        organizationId: "org-id",
        filters: { roles: Object.values(role), sortBy: "role", sortDirection },
      });
      const expected = [
        role.OrganizationOwner,
        role.OrganizationAdmin,
        role.ProjectCoordinator,
        role.Participant,
      ];
      expect(result.members.map(({ role }) => role)).toEqual(
        sortDirection === "asc" ? expected : expected.toReversed(),
      );
    },
  );
});
