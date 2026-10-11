// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "coordinator",
  interleave: false,
  update: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  createAuthEndpoint: (_options: unknown, handler: unknown) => handler,
}));
vi.mock("better-auth/plugins/organization", () => ({
  getOrgAdapter: () => ({
    findMemberByOrgId: async () => ({
      id: "member",
      userId: "user",
      role: mocks.role,
    }),
    findOrganizationById: async () => {
      if (mocks.interleave) mocks.role = "coordinator,admin";
      return { id: "organization" };
    },
  }),
}));

import { participantMembershipGrantPlugin } from "@/features/organizations/participant-membership-grant";

type TestContext = {
  body: { userId: string; organizationId: string; expectedRole: string };
  context: {
    adapter: { update: typeof mocks.update };
    internalAdapter: { findUserById: () => Promise<{ id: string }> };
  };
  json: (value: unknown) => unknown;
};
const grant = participantMembershipGrantPlugin.endpoints
  .grantParticipantMembership as unknown as (
  ctx: TestContext,
) => Promise<unknown>;
function context(expectedRole = "coordinator"): TestContext {
  return {
    body: { userId: "user", organizationId: "organization", expectedRole },
    context: {
      adapter: { update: mocks.update },
      internalAdapter: { findUserById: async () => ({ id: "user" }) },
    },
    json: (value) => value,
  };
}
beforeEach(() => {
  mocks.role = "coordinator";
  mocks.interleave = false;
  mocks.update
    .mockReset()
    .mockImplementation(
      async ({
        where,
        update,
      }: {
        where: { field: string; value: string }[];
        update: { role: string };
      }) => {
        if (
          where.find((condition) => condition.field === "role")?.value !==
          mocks.role
        )
          return null;
        mocks.role = update.role;
        return { id: "member", role: mocks.role };
      },
    );
});
describe("Participant Membership role append", () => {
  it("appends to an unchanged Membership", async () => {
    await grant(context());
    expect(mocks.role).toBe("coordinator,participant");
  });
  it("preserves an interleaved role grant and retries against the fresh role", async () => {
    mocks.interleave = true;
    await expect(grant(context())).rejects.toMatchObject({
      body: { code: "MEMBERSHIP_CHANGED" },
    });
    expect(mocks.role).toBe("coordinator,admin");
    mocks.interleave = false;
    await grant(context(mocks.role));
    expect(mocks.role).toBe("coordinator,admin,participant");
  });
  it("does not write when the Participant role is already present", async () => {
    mocks.role = "coordinator,participant";
    await grant(context());
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
