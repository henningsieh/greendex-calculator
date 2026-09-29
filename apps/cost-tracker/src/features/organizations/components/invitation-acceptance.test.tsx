import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
    organizations: {
      acceptInvitation: mocks.acceptInvitation,
    },
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

import { InvitationAcceptance } from "@/features/organizations/components/invitation-acceptance";

describe("Organization Invitation acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInvitation.mockResolvedValue({
      data: { organizationName: "Example Organization" },
    });
    mocks.acceptInvitation.mockResolvedValue({ organizationId: "org-1" });
  });

  it("previews without accepting until the invitee presses the button", async () => {
    render(<InvitationAcceptance invitationId="invite-1" />);
    const button = await screen.findByRole("button", {
      name: "Accept Organization Invitation",
    });
    expect(screen.getByText(/Example Organization/)).toBeInTheDocument();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() =>
      expect(mocks.acceptInvitation).toHaveBeenCalledWith({
        invitationId: "invite-1",
      }),
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/projects"));
  });

  it("shows an error without an acceptance button for invalid invitations", async () => {
    mocks.getInvitation.mockResolvedValue({ error: { message: "Not found" } });
    render(<InvitationAcceptance invitationId="expired" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /expired, cancelled/,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
  });

  it("explains an expired invitation with actionable copy", async () => {
    const { ORPCError } = await import("@orpc/client");
    mocks.acceptInvitation.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        message: "Organization Invitation has expired.",
      }),
    );
    render(<InvitationAcceptance invitationId="invite-1" />);
    const button = await screen.findByRole("button", {
      name: "Accept Organization Invitation",
    });
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /has expired. Ask for a new invitation/,
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
