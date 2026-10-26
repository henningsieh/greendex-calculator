import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onboardingNextStep: vi.fn(),
  getInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    organization: {
      getInvitation: mocks.getInvitation,
    },
  }),
}));
vi.mock("better-auth/client/plugins", () => ({ organizationClient: () => ({}) }));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    authentication: { onboardingNextStep: mocks.onboardingNextStep },
    organizations: {
      acceptInvitation: mocks.acceptInvitation,
    },
  },
}));
vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace };
  return { useRouter: () => router };
});
vi.mock("@/features/authentication/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { InvitationAcceptance } from "@/features/organizations/components/invitation-acceptance";

describe("Organization Invitation acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onboardingNextStep.mockResolvedValue({
      nextStep: "accept-invitation",
      entryContext: "organization-invitation",
      availableActions: [
        { kind: "accept-invitation", invitationId: "invite-1" },
        { kind: "sign-out" },
      ],
    });
    mocks.getInvitation.mockResolvedValue({
      data: { organizationName: "Example Organization" },
    });
    mocks.acceptInvitation.mockResolvedValue({ organizationId: "org-1" });
  });

  it("previews without accepting until the invitee presses the button", async () => {
    render(<InvitationAcceptance invitationId="invite-1" />);
    const button = await screen.findByTestId("accept-organization-invitation");
    expect(screen.getByTestId("invitation-preview")).toHaveAttribute(
      "data-organization-name",
      "Example Organization",
    );
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
    mocks.onboardingNextStep.mockResolvedValue({
      nextStep: "continue",
      entryContext: "organization-invitation",
      availableActions: [{ kind: "continue", destination: "/projects" }],
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(mocks.acceptInvitation).toHaveBeenCalledWith({
        invitationId: "invite-1",
      }),
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/projects"));
  });

  it.each(["continue", "authenticate"])(
    "applies initial %s navigation",
    async (nextStep) => {
      mocks.onboardingNextStep.mockResolvedValue({
        entryContext: "organization-invitation",
        nextStep,
        availableActions:
          nextStep === "continue"
            ? [{ kind: "continue", destination: "/projects" }]
            : [{ kind: "authenticate", returnTo: "/accept-invitation/invite-1" }],
      });
      render(<InvitationAcceptance invitationId="invite-1" />);
      await waitFor(() =>
        expect(mocks.replace).toHaveBeenCalledWith(
          nextStep === "continue"
            ? "/projects"
            : "/login?next=%2Faccept-invitation%2Finvite-1",
        ),
      );
    },
  );

  it("ignores a decision that resolves after unmount", async () => {
    let resolve!: (value: unknown) => void;
    mocks.onboardingNextStep.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = render(<InvitationAcceptance invitationId="invite-1" />);
    view.unmount();
    await act(async () =>
      resolve({
        entryContext: "organization-invitation",
        nextStep: "continue",
        availableActions: [{ kind: "continue", destination: "/projects" }],
      }),
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("shows an error without an acceptance button for invalid invitations", async () => {
    mocks.onboardingNextStep.mockResolvedValue({
      nextStep: "invitation-recovery",
      entryContext: "organization-invitation",
      reason: "STAFF_INVITATION_EXPIRED",
      availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
    });
    render(<InvitationAcceptance invitationId="expired" />);
    await waitFor(() =>
      expect(document.querySelector("[data-invitation-recovery]")).toBeVisible(),
    );
    expect(screen.getByTestId("recheck-organization-invitation")).toBeEnabled();
    expect(screen.queryByTestId("create-organization")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("accept-organization-invitation"),
    ).not.toBeInTheDocument();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
  });

  it("keeps an expired invitation open without navigating", async () => {
    const { ORPCError } = await import("@orpc/client");
    mocks.acceptInvitation.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        message: "Organization Invitation has expired.",
        data: { reason: "STAFF_INVITATION_EXPIRED" },
      }),
    );
    render(<InvitationAcceptance invitationId="invite-1" />);
    const button = await screen.findByTestId("accept-organization-invitation");
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
