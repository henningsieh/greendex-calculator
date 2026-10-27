import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import type { OnboardingDecision } from "@/features/authentication/onboarding-decision";

const mocks = vi.hoisted(() => ({
  onboardingNextStep: vi.fn(),
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
  replace: vi.fn(),
  setActive: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    authentication: { onboardingNextStep: mocks.onboardingNextStep },
    organizations: {
      acceptInvitation: mocks.acceptInvitation,
      rejectInvitation: mocks.rejectInvitation,
    },
  },
}));
vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace, refresh: mocks.refresh };
  return { useRouter: () => router };
});
vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: mocks.setActive } },
}));
vi.mock("@/features/authentication/components/sign-out-button", () => ({
  SignOutButton: ({ destination }: { destination?: string }) => (
    <button type="button" data-testid="sign-out" data-destination={destination} />
  ),
}));

import { InvitationAcceptance } from "@/features/organizations/components/invitation-acceptance";

const returnTo = "/accept-invitation/invite-1";
const invitation = {
  invitationId: "invite-1",
  organization: { id: "org-1", name: "Example Organization" },
};
const ready: OnboardingDecision = {
  nextStep: "accept-invitation",
  entryContext: "organization-invitation",
  invitation,
  availableActions: [
    { kind: "accept-invitation", invitationId: "invite-1" },
    {
      kind: "sign-out",
      destination: "/register?next=%2Faccept-invitation%2Finvite-1",
    },
  ],
};
const blocked: OnboardingDecision = {
  entryContext: "direct",
  nextStep: "resolve-invitation",
  invitation,
  returnTo: "/projects",
  availableActions: [
    { kind: "accept-invitation", invitationId: "invite-1" },
    { kind: "reject-invitation", invitationId: "invite-1" },
    { kind: "recheck" },
    { kind: "sign-out" },
  ],
};
const complete: OnboardingDecision = {
  nextStep: "continue",
  entryContext: "organization-invitation",
  availableActions: [{ kind: "continue", destination: "/projects" }],
};

function recovery(
  reason:
    | "STAFF_INVITATION_EXPIRED"
    | "STAFF_INVITATION_REJECTED"
    | "STAFF_INVITATION_WITHDRAWN"
    | "STAFF_INVITATION_ACCEPTED"
    | "STAFF_INVITATION_CLOSED"
    | "STAFF_INVITATION_WRONG_EMAIL"
    | "STAFF_INVITATION_NOT_FOUND",
): OnboardingDecision {
  return {
    nextStep: "invitation-recovery",
    entryContext: "organization-invitation",
    reason,
    returnTo,
    availableActions: [
      {
        kind: "sign-out",
        destination: "/register?next=%2Faccept-invitation%2Finvite-1",
      },
      { kind: "recheck" },
    ],
  };
}

describe("Organization Invitation acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onboardingNextStep.mockResolvedValue(ready);
    mocks.acceptInvitation.mockResolvedValue({ organizationId: "org-1" });
    mocks.setActive.mockResolvedValue({});
  });

  it("shows current identity and one explicit accept before continuing", async () => {
    render(<InvitationAcceptance returnTo={returnTo} />);
    const button = await screen.findByTestId("accept-organization-invitation");
    expect(screen.getByTestId("invitation-context")).toHaveAttribute(
      "data-organization-id",
      "org-1",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(
      screen
        .getByTestId("invitation-progress")
        .querySelector('[data-step="accept"]'),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("sign-out")).toHaveAttribute(
      "data-destination",
      "/register?next=%2Faccept-invitation%2Finvite-1",
    );
    expect(mocks.acceptInvitation).not.toHaveBeenCalled();
    mocks.onboardingNextStep.mockResolvedValue(complete);
    fireEvent.click(button);
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/projects"),
    );
    expect(mocks.acceptInvitation).toHaveBeenCalledExactlyOnceWith({
      invitationId: "invite-1",
    });
  });

  it("uses the signed-out server decision to return to registration", async () => {
    mocks.onboardingNextStep.mockResolvedValue({
      entryContext: "organization-invitation",
      nextStep: "authenticate",
      invitation,
      availableActions: [
        { kind: "authenticate", entry: "register", returnTo },
        { kind: "authenticate", entry: "login", returnTo },
        { kind: "google", returnTo },
      ],
    });
    render(<InvitationAcceptance returnTo={returnTo} />);
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
        "/register?next=%2Faccept-invitation%2Finvite-1",
      ),
    );
  });

  it("focuses named verification and announces routine progress without an accept", () => {
    render(
      <InvitationAcceptance
        returnTo={returnTo}
        initialDecision={{
          entryContext: "organization-invitation",
          nextStep: "verify-email",
          invitation,
          email: "submitted@example.org",
          availableActions: [
            {
              kind: "sign-out",
              destination: "/register?next=%2Faccept-invitation%2Finvite-1",
            },
            {
              kind: "resend-verification",
              email: "submitted@example.org",
              callbackURL: returnTo,
            },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("auth-verification-message")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByTestId("auth-verification-message")).toHaveAttribute(
      "data-emphasis",
      "prominent",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(screen.getByRole("list")).toHaveAccessibleName();
    expect(
      screen
        .getByTestId("invitation-progress")
        .querySelector('[data-step="verify"]'),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.queryByTestId("accept-organization-invitation")).toBeNull();
  });

  it.each([
    ["STAFF_INVITATION_WRONG_EMAIL", "wrongEmail"],
    ["STAFF_INVITATION_EXPIRED", "expired"],
    ["STAFF_INVITATION_CLOSED", "closed"],
    ["STAFF_INVITATION_REJECTED", "rejected"],
    ["STAFF_INVITATION_WITHDRAWN", "withdrawn"],
    ["STAFF_INVITATION_ACCEPTED", "accepted"],
    ["STAFF_INVITATION_NOT_FOUND", "unavailable"],
  ] as const)(
    "keeps %s recovery in the journey and rechecks current identity",
    async (reason, guidance) => {
      render(
        <InvitationAcceptance
          returnTo={returnTo}
          initialDecision={recovery(reason)}
        />,
      );
      expect(screen.getByTestId("invitation-recovery-guidance")).toHaveAttribute(
        "data-recovery-guidance",
        guidance,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
      expect(screen.queryByTestId("create-organization")).toBeNull();
      expect(screen.queryByTestId("accept-organization-invitation")).toBeNull();
      fireEvent.click(screen.getByTestId("recheck-organization-invitation"));
      expect(
        await screen.findByTestId("accept-organization-invitation"),
      ).toBeEnabled();
      expect(mocks.onboardingNextStep).toHaveBeenCalledExactlyOnceWith({
        returnTo,
      });
    },
  );

  it("replaces a stale allowed action with current recovery after refusal", async () => {
    mocks.acceptInvitation.mockRejectedValue(new Error("closed"));
    render(<InvitationAcceptance returnTo={returnTo} initialDecision={ready} />);
    mocks.onboardingNextStep.mockResolvedValue(
      recovery("STAFF_INVITATION_CLOSED"),
    );
    fireEvent.click(screen.getByTestId("accept-organization-invitation"));
    await waitFor(() =>
      expect(screen.getByTestId("invitation-recovery-guidance")).toHaveAttribute(
        "data-recovery-guidance",
        "closed",
      ),
    );
    expect(screen.getByTestId("recheck-organization-invitation")).toBeEnabled();
    expect(screen.queryByTestId("accept-organization-invitation")).toBeNull();
  });

  it("allows only selection after prior acceptance and continues after session selection", async () => {
    render(
      <InvitationAcceptance
        returnTo={returnTo}
        initialDecision={{
          entryContext: "organization-invitation",
          nextStep: "select-organization",
          availableActions: [
            {
              kind: "select-organization",
              organizations: [invitation.organization],
            },
            { kind: "sign-out" },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("select-organization-org-1")).toBeEnabled();
    expect(screen.queryByTestId("accept-organization-invitation")).toBeNull();
    expect(screen.queryByTestId("create-organization")).toBeNull();
    mocks.onboardingNextStep.mockResolvedValue(complete);
    fireEvent.click(screen.getByTestId("select-organization-org-1"));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/projects"));
    expect(mocks.setActive).toHaveBeenCalledExactlyOnceWith({
      organizationId: "org-1",
    });
  });

  it("ignores a late response after unmount while the mounted entry can continue", async () => {
    let resolve: (value: OnboardingDecision) => void = () => {};
    mocks.onboardingNextStep.mockReturnValue(
      new Promise<OnboardingDecision>((done) => {
        resolve = done;
      }),
    );
    const view = render(<InvitationAcceptance returnTo={returnTo} />);
    view.unmount();
    await act(async () => resolve(complete));
    expect(mocks.replace).not.toHaveBeenCalled();
    render(<InvitationAcceptance returnTo={returnTo} initialDecision={ready} />);
    expect(screen.getByTestId("accept-organization-invitation")).toBeEnabled();
  });
});

it("rejects the named invitation and shows the refreshed creation next step", async () => {
  mocks.rejectInvitation.mockResolvedValue({ success: true });
  mocks.onboardingNextStep.mockResolvedValue({
    entryContext: "direct",
    nextStep: "create-organization",
    availableActions: [{ kind: "create-organization" }, { kind: "sign-out" }],
  });
  render(<InvitationAcceptance returnTo="/projects" initialDecision={blocked} />);
  expect(screen.getByTestId("organization-creation-blocked")).toBeVisible();
  expect(screen.getByTestId("invitation-preview")).toHaveAttribute(
    "data-organization-name",
    invitation.organization.name,
  );
  fireEvent.click(screen.getByTestId("reject-organization-invitation"));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByTestId(
      "confirm-dialog-execute",
    ),
  );
  expect(await screen.findByTestId("invitation-rejected")).toBeVisible();
  expect(screen.getByTestId("invitation-next-step")).toHaveAttribute(
    "href",
    "/projects",
  );
  expect(screen.queryByTestId("accept-organization-invitation")).toBeNull();
});

it("keeps another invitation actionable after rejection and never reports a failed rejection as success", async () => {
  const remaining = {
    ...blocked,
    invitation: {
      invitationId: "invite-2",
      organization: { id: "org-2", name: "Other Organization" },
    },
    availableActions: [
      { kind: "accept-invitation", invitationId: "invite-2" },
      { kind: "reject-invitation", invitationId: "invite-2" },
      { kind: "recheck" },
      { kind: "sign-out" },
    ],
  } satisfies OnboardingDecision;
  mocks.rejectInvitation
    .mockResolvedValueOnce({ success: true })
    .mockRejectedValueOnce(new Error("offline"));
  mocks.onboardingNextStep.mockResolvedValue(remaining);
  render(<InvitationAcceptance returnTo="/projects" initialDecision={blocked} />);
  fireEvent.click(screen.getByTestId("reject-organization-invitation"));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByTestId(
      "confirm-dialog-execute",
    ),
  );
  await waitFor(() =>
    expect(screen.getByTestId("invitation-preview")).toHaveAttribute(
      "data-organization-name",
      "Other Organization",
    ),
  );
  expect(screen.getByTestId("organization-creation-blocked")).toBeVisible();
  expect(screen.queryByTestId("invitation-next-step")).toBeNull();
  fireEvent.click(screen.getByTestId("reject-organization-invitation"));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByTestId(
      "confirm-dialog-execute",
    ),
  );
  expect(await screen.findByTestId("invitation-error")).toBeVisible();
  expect(screen.getByTestId("invitation-preview")).toHaveAttribute(
    "data-organization-name",
    "Other Organization",
  );
  expect(screen.getByTestId("reject-organization-invitation")).not.toBeDisabled();
});

it("keeps a cancelled rejection actionable and disables it while executing", async () => {
  mocks.rejectInvitation.mockImplementation(() => new Promise(() => {}));
  render(<InvitationAcceptance returnTo={returnTo} initialDecision={blocked} />);
  const trigger = await screen.findByTestId("reject-organization-invitation");
  fireEvent.click(trigger);
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByTestId(
      "confirm-dialog-cancel",
    ),
  );
  expect(mocks.rejectInvitation).not.toHaveBeenCalled();
  expect(trigger).toBeEnabled();
  fireEvent.click(trigger);
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByTestId(
      "confirm-dialog-execute",
    ),
  );
  await waitFor(() => expect(trigger).toBeDisabled());
  expect(mocks.rejectInvitation).toHaveBeenCalledExactlyOnceWith({
    invitationId: "invite-1",
  });
  expect(trigger).toBeDisabled();
});
