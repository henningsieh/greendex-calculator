import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inviteMember: vi.fn(),
  cancelInvitation: vi.fn(),
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
                role: "owner",
                createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
              },
              {
                id: "member-2",
                userId: "hybrid-1",
                name: "Hybrid Admin",
                email: "hybrid@example.org",
                role: "admin,participant",
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
                role: "member",
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
    role: "member",
  });
  mocks.cancelInvitation.mockResolvedValue({ success: true });
});

describe("Organization team", () => {
  it("lists members with combined roles and pending invitations", async () => {
    renderTeam();

    expect(await screen.findByText("Staff Owner")).toBeTruthy();
    expect(screen.getByText("hybrid@example.org")).toBeTruthy();
    expect(screen.getByText("pending@example.org")).toBeTruthy();
    expect(screen.getAllByText("participant").length).toBeGreaterThan(0);
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
        role: "member",
      }),
    );
    expect(
      await screen.findByText("Invitation sent to new@example.org."),
    ).toBeTruthy();
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
    expect(await screen.findByText("Invitation cancelled.")).toBeTruthy();
  });
});
