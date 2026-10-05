import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  listMemberships: vi.fn(),
  canManageOrganization: vi.fn(),
  canViewPartnerNetwork: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { organizations: { listMemberships: mocks.listMemberships } },
}));

vi.mock("@/features/organizations/access", () => ({
  canManageOrganization: mocks.canManageOrganization,
  canViewPartnerNetwork: mocks.canViewPartnerNetwork,
}));

vi.mock("@/components/app-navigation", () => ({
  AppNavigation: ({
    showOrganizationSwitcher,
    activeOrganizationId,
  }: {
    showOrganizationSwitcher?: boolean;
    activeOrganizationId?: string;
  }) => (
    <p>
      Staff shell; switcher {showOrganizationSwitcher ? "shown" : "hidden"} for{" "}
      {activeOrganizationId}
    </p>
  ),
}));

vi.mock("@/features/authentication/components/no-organization-access", () => ({
  NoOrganizationAccess: () => <p>Create Organization recovery</p>,
}));

vi.mock("@/features/organizations/components/select-organization", () => ({
  SelectOrganization: () => <p>Select Organization recovery</p>,
}));

import ProtectedLayout from "@/app/(protected)/layout";

const ownerMembership = { id: "org-a", name: "Alpha", role: ORGANIZATION_ROLES.OrganizationOwner };
const participantMembership = { id: "org-b", name: "Beta", role: ORGANIZATION_ROLES.Participant };

function session(activeOrganizationId: string | null) {
  return {
    user: {
      id: "user-1",
      email: "user@example.org",
      name: "User",
      createdAt: new Date(),
    },
    session: { id: "session-1", activeOrganizationId },
  };
}

describe("ProtectedLayout Organization context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canManageOrganization.mockResolvedValue(true);
    mocks.canViewPartnerNetwork.mockResolvedValue(true);
  });

  it("offers creation recovery without Memberships", async () => {
    mocks.requireSession.mockResolvedValue(session(null));
    mocks.listMemberships.mockResolvedValue([]);

    render(await ProtectedLayout({ children: <p>child</p> }));

    expect(screen.getByText("Create Organization recovery")).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("offers selection recovery for stale active context", async () => {
    mocks.requireSession.mockResolvedValue(session("org-deleted"));
    mocks.listMemberships.mockResolvedValue([ownerMembership]);

    render(await ProtectedLayout({ children: <p>child</p> }));

    expect(screen.getByText("Select Organization recovery")).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("renders the staff shell with a switcher for staff Memberships", async () => {
    mocks.requireSession.mockResolvedValue(session("org-a"));
    mocks.listMemberships.mockResolvedValue([
      ownerMembership,
      participantMembership,
    ]);

    render(await ProtectedLayout({ children: <p>child</p> }));

    expect(
      screen.getByText("Staff shell; switcher shown for org-a"),
    ).toBeInTheDocument();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders the staff shell without a switcher for pure Participants", async () => {
    mocks.requireSession.mockResolvedValue(session("org-b"));
    mocks.listMemberships.mockResolvedValue([participantMembership]);

    render(await ProtectedLayout({ children: <p>child</p> }));

    expect(
      screen.getByText("Staff shell; switcher hidden for org-b"),
    ).toBeInTheDocument();
  });
});
