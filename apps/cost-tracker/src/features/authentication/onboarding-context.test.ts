// @vitest-environment node

import { createRouterClient, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  readStaffInvitationContext: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
  costTrackerAuthFlags: { singleOrganization: true },
}));
vi.mock("@/features/organizations/procedures/staff-invites", () => ({
  readStaffInvitation: vi.fn(),
  readStaffInvitationContext: mocks.readStaffInvitationContext,
}));
vi.mock("@/features/organizations/procedures/memberships", () => ({
  readOrganizationMemberships: vi.fn(),
}));
vi.mock("@/features/projects/procedures/setup-links", () => ({
  readSetupBindingEligibility: vi.fn(),
  readSetupLinkEligibility: vi.fn(),
}));

import { loadOnboardingFacts } from "@/features/authentication/onboarding-context";
import { decideOnboarding } from "@/features/authentication/onboarding-decision";
import { base } from "@/lib/orpc/context";

const readFacts = createRouterClient(
  base.handler(({ context, errors }) =>
    loadOnboardingFacts(
      context.headers,
      { returnTo: "/accept-invitation/invite-1" },
      errors,
    ),
  ),
  { context: { headers: new Headers() } },
);

beforeEach(() => vi.resetAllMocks());

it("checks an authenticated-unverified address internally and returns recovery without recipient data", async () => {
  mocks.getSession.mockResolvedValue({
    user: { email: "mistyped@example.org", emailVerified: false },
  });
  mocks.readStaffInvitationContext.mockRejectedValue(
    new ORPCError("FORBIDDEN", {
      data: { reason: "STAFF_INVITATION_WRONG_EMAIL" },
    }),
  );
  const returnTo = "/accept-invitation/invite-1";
  const facts = await readFacts();
  expect(mocks.readStaffInvitationContext).toHaveBeenCalledExactlyOnceWith(
    "invite-1",
    expect.any(Object),
    "mistyped@example.org",
  );
  expect(decideOnboarding(facts)).toEqual({
    entryContext: "organization-invitation",
    nextStep: "invitation-recovery",
    reason: "STAFF_INVITATION_WRONG_EMAIL",
    returnTo,
    availableActions: [
      {
        kind: "sign-out",
        destination: `/register?next=${encodeURIComponent(returnTo)}`,
      },
      { kind: "recheck" },
    ],
  });
  expect(JSON.stringify(decideOnboarding(facts))).not.toContain(
    "mistyped@example.org",
  );
});

it("does not compare an address or discover an account before authentication", async () => {
  mocks.getSession.mockResolvedValue(null);
  mocks.readStaffInvitationContext.mockResolvedValue({
    invitationId: "invite-1",
    organization: { id: "org-1", name: "Example Organization" },
  });
  const facts = await readFacts();
  expect(mocks.readStaffInvitationContext).toHaveBeenCalledExactlyOnceWith(
    "invite-1",
    expect.any(Object),
    undefined,
  );
  expect(decideOnboarding(facts)).toMatchObject({ nextStep: "authenticate" });
});
