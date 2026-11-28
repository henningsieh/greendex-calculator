import { beforeEach, describe, expect, it, vi } from "vitest";

import { useParticipantEntryAccess } from "./use-participant-entry-access";

vi.mock("@tanstack/react-query", () => ({
  useMutationState: () => [],
}));

const state = vi.hoisted(() => ({
  sessionPending: false,
  sessionRefetching: false,
  sessionError: false,
  organizationPending: false,
  organizationRefetching: false,
  organizationError: false,
  sessionOrganization: "partner",
  userId: "user",
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth-client")>();
  return {
    authClient: {
      ...original.authClient,
      organization: { checkRolePermission: () => true },
      useSession: () => ({
        data: {
          user: { id: state.userId },
          session: { activeOrganizationId: state.sessionOrganization },
        },
        isPending: state.sessionPending,
        isRefetching: state.sessionRefetching,
        error: state.sessionError,
      }),
      useActiveOrganization: () => ({
        data: {
          id: "partner",
          members: [{ userId: state.userId, role: "owner" }],
        },
        isPending: state.organizationPending,
        isRefetching: state.organizationRefetching,
        error: state.organizationError,
      }),
    },
  };
});

const scope = {
  userId: "user",
  partnerOrganizationId: "partner",
  hostOrganizationId: "host",
  assignedCoordinator: true,
};

describe("participant access", () => {
  beforeEach(() => {
    Object.assign(state, {
      sessionPending: false,
      sessionRefetching: false,
      sessionError: false,
      organizationPending: false,
      organizationRefetching: false,
      organizationError: false,
      sessionOrganization: "partner",
      userId: "user",
    });
  });
  it("allows a resolved matching owner", () => {
    expect(useParticipantEntryAccess(scope).permitted).toBe(true);
  });
  it.each([
    "sessionPending",
    "sessionRefetching",
    "sessionError",
    "organizationPending",
    "organizationRefetching",
    "organizationError",
  ] as const)("fails closed for %s even with retained data", (key) => {
    state[key] = true;
    expect(useParticipantEntryAccess(scope).permitted).toBe(false);
  });
  it("fails closed when the Organization or scope user changes", () => {
    state.sessionOrganization = "other";
    expect(useParticipantEntryAccess(scope).permitted).toBe(false);
    state.sessionOrganization = "partner";
    state.userId = "other";
    expect(useParticipantEntryAccess(scope).permitted).toBe(false);
  });
});
