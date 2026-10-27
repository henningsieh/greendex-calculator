import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({
  toastAdd: vi.fn(),
  inviteMember: vi.fn(),
  cancelInvitation: vi.fn(),
}));
vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    organizations: {
      inviteMember: mocks.inviteMember,
      cancelInvitation: mocks.cancelInvitation,
    },
  },
  orpcQuery: {
    organizations: {
      listMembers: {
        queryOptions: () => ({
          queryKey: ["organizations", "listMembers"],
          queryFn: async () => ({
            members: [
              {
                id: "member-1",
                userId: "owner-1",
                name: "Staff Owner",
                email: "owner@example.org",
                role: ORGANIZATION_ROLES.OrganizationOwner,
                createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
              },
              {
                id: "member-2",
                userId: "hybrid-1",
                name: "Hybrid Admin",
                email: "hybrid@example.org",
                role: `${ORGANIZATION_ROLES.OrganizationAdmin},${ORGANIZATION_ROLES.Participant}`,
                createdAt: new Date("2026-01-02T00:00:00.000Z").toISOString(),
              },
            ],
          }),
        }),
        queryKey: () => ["organizations", "listMembers"],
      },
      listPendingInvitations: {
        queryOptions: () => ({
          queryKey: ["organizations", "listPendingInvitations"],
          queryFn: async () => ({
            invitations: [
              {
                id: "invitation-1",
                email: "pending@example.org",
                role: ORGANIZATION_ROLES.OrganizationAdmin,
                expiresAt: new Date("2026-02-01T00:00:00.000Z").toISOString(),
                createdAt: new Date("2026-01-03T00:00:00.000Z").toISOString(),
              },
              {
                id: "invitation-2",
                email: "second@example.org",
                role: ORGANIZATION_ROLES.OrganizationAdmin,
                expiresAt: new Date("2026-02-01T00:00:00.000Z").toISOString(),
                createdAt: new Date("2026-01-03T00:00:00.000Z").toISOString(),
              },
            ],
          }),
        }),
        queryKey: () => ["organizations", "listPendingInvitations"],
      },
    },
  },
}));

import { OrganizationTeam } from "@/features/organizations/components/organization-team";

function renderTeam() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OrganizationTeam currentUserEmail="owner@example.org" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inviteMember.mockResolvedValue({
    invitationId: "invitation-2",
    email: "new@example.org",
    role: ORGANIZATION_ROLES.OrganizationAdmin,
  });
  mocks.cancelInvitation.mockResolvedValue({ success: true });
});

describe("Organization team", () => {
  it("lists members with combined roles and pending invitations", async () => {
    renderTeam();

    expect(await screen.findByTestId("staff-member-member-1")).toBeTruthy();
    expect(screen.getByTestId("staff-member-member-2")).toBeTruthy();
    expect(screen.getByTestId("staff-invitation-invitation-1")).toBeTruthy();
    expect(
      within(screen.getByTestId("staff-member-member-2")).getByTestId(
        "staff-role-participant",
      ),
    ).toHaveAttribute("data-role", "participant");
  });

  it("sends an invitation and refreshes the lists", async () => {
    const user = userEvent.setup();
    renderTeam();
    await screen.findByTestId("staff-member-member-1");

    await user.type(screen.getByTestId("staff-invite-email"), "new@example.org");
    await user.click(screen.getByTestId("send-staff-invitation"));

    await waitFor(() =>
      expect(mocks.inviteMember).toHaveBeenCalledWith({
        email: "new@example.org",
        role: ORGANIZATION_ROLES.OrganizationAdmin,
      }),
    );
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ type: "success" }),
      ),
    );
  });

  it("keeps invitation failures inline without a success toast", async () => {
    mocks.inviteMember.mockRejectedValueOnce(new Error("network unavailable"));
    const user = userEvent.setup();
    renderTeam();
    await screen.findByTestId("staff-member-member-1");

    await user.type(screen.getByTestId("staff-invite-email"), "new@example.org");
    await user.click(screen.getByTestId("send-staff-invitation"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mocks.toastAdd).not.toHaveBeenCalled();
  });

  it("cancels a pending invitation", async () => {
    const user = userEvent.setup();
    renderTeam();
    await screen.findByTestId("staff-invitation-invitation-1");

    await user.click(screen.getByTestId("cancel-staff-invitation-invitation-1"));
    await user.click(
      within(await screen.findByRole("dialog")).getByTestId(
        "confirm-dialog-execute",
      ),
    );

    await waitFor(() =>
      expect(mocks.cancelInvitation).toHaveBeenCalledWith({
        invitationId: "invitation-1",
      }),
    );
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ type: "success" }),
      ),
    );
  });
  it.each(["success", "failure"])(
    "keeps each revocation pending when the second request settles with %s",
    async (outcome) => {
      const first = Promise.withResolvers<{ success: boolean }>();
      const second = Promise.withResolvers<{ success: boolean }>();
      mocks.cancelInvitation
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const user = userEvent.setup();
      renderTeam();
      const firstTrigger = await screen.findByTestId(
        "cancel-staff-invitation-invitation-1",
      );
      const secondTrigger = screen.getByTestId(
        "cancel-staff-invitation-invitation-2",
      );

      await user.click(firstTrigger);
      await user.click(
        within(await screen.findByRole("dialog")).getByTestId(
          "confirm-dialog-execute",
        ),
      );
      expect(firstTrigger).toBeDisabled();
      expect(secondTrigger).toBeEnabled();
      await user.click(secondTrigger);
      await user.click(
        within(await screen.findByRole("dialog")).getByTestId(
          "confirm-dialog-execute",
        ),
      );
      expect(firstTrigger).toBeDisabled();
      expect(secondTrigger).toBeDisabled();

      await act(async () => {
        if (outcome === "success") second.resolve({ success: true });
        else second.reject(new Error("network unavailable"));
      });
      await waitFor(() => expect(secondTrigger).toBeEnabled());
      expect(firstTrigger).toBeDisabled();

      await act(async () => first.resolve({ success: true }));
      await waitFor(() => expect(firstTrigger).toBeEnabled());
    },
  );

  it("leaves a dismissed invitation active and disables cancellation while executing", async () => {
    mocks.cancelInvitation.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderTeam();
    const trigger = await screen.findByTestId(
      "cancel-staff-invitation-invitation-1",
    );
    await user.click(trigger);
    await user.click(
      within(await screen.findByRole("dialog")).getByTestId(
        "confirm-dialog-close",
      ),
    );
    expect(mocks.cancelInvitation).not.toHaveBeenCalled();
    expect(trigger).toBeEnabled();
    await user.click(trigger);
    await user.click(
      within(await screen.findByRole("dialog")).getByTestId(
        "confirm-dialog-execute",
      ),
    );
    expect(mocks.cancelInvitation).toHaveBeenCalledExactlyOnceWith({
      invitationId: "invitation-1",
    });
    expect(trigger).toBeDisabled();
  });
});
