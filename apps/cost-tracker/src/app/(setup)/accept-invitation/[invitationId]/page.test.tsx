import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/features/organizations/components/invitation-acceptance", () => ({
  InvitationAcceptance: ({ invitationId }: { invitationId: string }) => (
    <p>Organization Invitation {invitationId}</p>
  ),
}));

import OrganizationInvitationPage from "@/app/(setup)/accept-invitation/[invitationId]/page";

describe("Organization Invitation route", () => {
  it("requires sign-in with a return path before displaying the invitation", async () => {
    render(
      await OrganizationInvitationPage({
        params: Promise.resolve({ invitationId: "invite-1" }),
      }),
    );
    expect(mocks.requireSession).toHaveBeenCalledWith(
      "/accept-invitation/invite-1",
    );
    expect(
      screen.getByText("Organization Invitation invite-1"),
    ).toBeInTheDocument();
  });
});
