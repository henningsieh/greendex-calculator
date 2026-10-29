import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({
  next: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(destination);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { authentication: { onboardingNextStep: mocks.next } },
}));
vi.mock("@/lib/session", () => ({
  invitationReturnTo: (value: string) =>
    /^\/accept-invitation\/[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : undefined,
}));
vi.mock("@/features/authentication/components/invitation-acceptance", () => ({
  InvitationAcceptance: ({ returnTo }: { returnTo: string }) => (
    <div data-testid="invitation-acceptance" data-return-to={returnTo} />
  ),
}));

import OrganizationInvitationPage from "@/app/(setup)/accept-invitation/[[...invitationId]]/page";

describe("Organization Invitation route", () => {
  beforeEach(() => vi.clearAllMocks());
  it("enters registration with the server-approved destination", async () => {
    mocks.next.mockResolvedValue({
      entryContext: "organization-invitation",
      nextStep: "authenticate",
      availableActions: [
        {
          kind: "authenticate",
          entry: "register",
          returnTo: "/accept-invitation/invite-1",
        },
      ],
    });
    await expect(
      OrganizationInvitationPage({
        params: Promise.resolve({ invitationId: ["invite-1"] }),
      }),
    ).rejects.toThrow("/register?next=%2Faccept-invitation%2Finvite-1");
  });
  it.each([undefined, ["bad!"], ["bad", "path"]])(
    "keeps malformed %s paths in fixed recovery",
    async (invitationId) => {
      mocks.next.mockResolvedValue({
        entryContext: "organization-invitation",
        nextStep: "invitation-recovery",
        reason: "STAFF_INVITATION_NOT_FOUND",
      });
      render(
        await OrganizationInvitationPage({
          params: Promise.resolve({ invitationId }),
        }),
      );
      expect(screen.getByTestId("invitation-acceptance")).toHaveAttribute(
        "data-return-to",
        "/accept-invitation",
      );
      expect(mocks.next).toHaveBeenCalledExactlyOnceWith({
        returnTo: "/accept-invitation",
      });
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );
  it("continues prior acceptance without rendering another accept", async () => {
    mocks.next.mockResolvedValue({
      entryContext: "organization-invitation",
      nextStep: "continue",
      availableActions: [{ kind: "continue", destination: "/projects" }],
    });
    await expect(
      OrganizationInvitationPage({
        params: Promise.resolve({ invitationId: ["invite-1"] }),
      }),
    ).rejects.toThrow("/projects");
  });
});
