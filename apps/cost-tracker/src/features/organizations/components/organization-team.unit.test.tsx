import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<OrganizationTeam currentUserEmail="owner@example.org" />, {
    wrapper: Wrapper,
  });
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

    expect(await screen.findByText("Staff Owner")).toBeTruthy();
    expect(screen.getByText("hybrid@example.org")).toBeTruthy();
    expect(screen.getByText("pending@example.org")).toBeTruthy();
    expect(
      screen.getAllByText(ORGANIZATION_ROLES.Participant).length,
    ).toBeGreaterThan(0);
  });

  it("sends an invitation and refreshes the lists", async () => {
    const user = userEvent.setup();
    renderTeam();
    await screen.findByText("Staff Owner");

    await user.type(screen.getByLabelText("Email"), "new@example.org");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() =>
      expect(mocks.inviteMember).toHaveBeenCalledWith({
        email: "new@example.org",
        role: ORGANIZATION_ROLES.OrganizationAdmin,
      }),
    );
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith({
        title: "Invitation sent to new@example.org.",
        type: "success",
      }),
    );
  });

  it("keeps invitation failures inline without a success toast", async () => {
    mocks.inviteMember.mockRejectedValueOnce(new Error("network unavailable"));
    const user = userEvent.setup();
    renderTeam();
    await screen.findByText("Staff Owner");

    await user.type(screen.getByLabelText("Email"), "new@example.org");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The server or network is unreachable. Check your connection and try again.",
    );
    expect(mocks.toastAdd).not.toHaveBeenCalled();
  });

  it("cancels a pending invitation", async () => {
    const user = userEvent.setup();
    renderTeam();
    await screen.findByText("pending@example.org");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(mocks.cancelInvitation).toHaveBeenCalledWith({
        invitationId: "invitation-1",
      }),
    );
    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith({
        title: "Invitation cancelled.",
        type: "success",
      }),
    );
  });
});
