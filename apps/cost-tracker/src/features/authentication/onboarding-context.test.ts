// @vitest-environment node

import { createRouterClient, ORPCError } from "@orpc/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  eligibility: vi.fn(),
  memberships: vi.fn(),
  readStaffInvitationContext: vi.fn(),
}));
vi.mock("@greendex/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@greendex/auth")>()),
  getOrganizationCreationEligibility: mocks.eligibility,
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
  readOrganizationMemberships: mocks.memberships,
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

it("uses the shared policy identity for direct onboarding instead of discovering a different invitation", async () => {
  mocks.getSession.mockResolvedValue({
    user: {
      id: "recipient",
      email: "recipient@example.org",
      emailVerified: true,
    },
    session: { activeOrganizationId: null },
  });
  mocks.memberships.mockResolvedValue([]);
  mocks.eligibility.mockResolvedValue({
    status: "denied-invitation",
    invitationId: "stable",
    organization: { id: "org", name: "Colleagues" },
  });
  const readDirectFacts = createRouterClient(
    base.handler(({ context, errors }) =>
      loadOnboardingFacts(context.headers, {}, errors),
    ),
    { context: { headers: new Headers() } },
  );
  const facts = await readDirectFacts();
  expect(facts).toMatchObject({
    canCreate: false,
    blockingInvitation: {
      invitationId: "stable",
      organization: { id: "org", name: "Colleagues" },
    },
  });
  expect(decideOnboarding(facts)).toMatchObject({
    nextStep: "resolve-invitation",
    invitation: { invitationId: "stable" },
    returnTo: "/projects",
  });
});
