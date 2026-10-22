// @vitest-environment node

import { PassThrough } from "node:stream";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { renderToStaticMarkup, renderToPipeableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn(),
  listMemberships: vi.fn(),
  canManageOrganization: vi.fn(),
  canViewPartnerNetwork: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: mocks.connection }));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
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
    showOrganization,
    showPartnerOrganizations,
  }: {
    showOrganizationSwitcher?: boolean;
    activeOrganizationId?: string;
    showOrganization?: boolean;
    showPartnerOrganizations?: boolean;
  }) => (
    <p
      data-organization={String(showOrganization)}
      data-partner-network={String(showPartnerOrganizations)}
    >
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
import { ProtectedShell } from "@/app/(protected)/protected-shell";

const ownerMembership = {
  id: "org-a",
  name: "Alpha",
  role: ORGANIZATION_ROLES.OrganizationOwner,
};
const participantMembership = {
  id: "org-b",
  name: "Beta",
  role: ORGANIZATION_ROLES.Participant,
};

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
    mocks.getSession.mockResolvedValue(session(null));
    mocks.listMemberships.mockResolvedValue([]);

    const html = renderToStaticMarkup(
      await ProtectedShell({ children: <p>child</p> }),
    );

    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.connection.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getSession.mock.invocationCallOrder[0],
    );
    expect(html).toContain("Create Organization recovery");
    expect(html).toContain("child");
  });

  it("offers selection recovery for stale active context", async () => {
    mocks.getSession.mockResolvedValue(session("org-deleted"));
    mocks.listMemberships.mockResolvedValue([ownerMembership]);

    const html = renderToStaticMarkup(
      await ProtectedShell({ children: <p>child</p> }),
    );

    expect(html).toContain("Select Organization recovery");
    expect(html).toContain("child");
  });

  it("renders the staff shell with a switcher for staff Memberships", async () => {
    mocks.getSession.mockResolvedValue(session("org-a"));
    mocks.listMemberships.mockResolvedValue([
      ownerMembership,
      participantMembership,
    ]);

    const html = renderToStaticMarkup(
      await ProtectedShell({ children: <p>child</p> }),
    );

    expect(html).toContain("Staff shell; switcher shown for org-a");
    expect(html).toContain("child");
    expect(html).toContain('data-organization="true"');
    expect(html).toContain('data-partner-network="true"');
  });

  it("renders the staff shell without a switcher for pure Participants", async () => {
    mocks.getSession.mockResolvedValue(session("org-b"));
    mocks.listMemberships.mockResolvedValue([participantMembership]);

    const html = renderToStaticMarkup(
      await ProtectedShell({ children: <p>child</p> }),
    );

    expect(html).toContain("Staff shell; switcher hidden for org-b");
  });
});

it("streams neutral chrome before the session gate resolves", async () => {
  vi.clearAllMocks();
  let resolveSession!: (value: ReturnType<typeof session>) => void;
  mocks.getSession.mockReturnValue(
    new Promise((resolve) => {
      resolveSession = resolve;
    }),
  );
  mocks.listMemberships.mockResolvedValue([ownerMembership]);
  mocks.canManageOrganization.mockResolvedValue(false);
  mocks.canViewPartnerNetwork.mockResolvedValue(false);
  const destination = new PassThrough();
  let html = "";
  destination.setEncoding("utf8");
  const shell = new Promise<void>((resolve) => {
    destination.on("data", (chunk: string) => {
      html += chunk;
      if (html.includes("Loading Cost Tracker")) resolve();
    });
  });
  const complete = new Promise<void>((resolve) => destination.on("end", resolve));
  const { pipe } = renderToPipeableStream(
    <div>
      <ProtectedLayout>
        <p>Private child</p>
      </ProtectedLayout>
    </div>,
    { onShellReady: () => pipe(destination) },
  );
  await shell;
  expect(html).toContain("Cost Tracker");
  expect(html).toContain('data-slot="skeleton"');
  expect(html).not.toContain("Private child");
  expect(html).not.toContain("Staff shell");
  expect(html).not.toContain("user@example.org");
  expect(mocks.listMemberships).not.toHaveBeenCalled();
  resolveSession(session("org-a"));
  await complete;
  expect(html).toContain("Staff shell");
  expect(html).toContain("Private child");
  expect(html).toContain('data-organization="false"');
  expect(html).toContain('data-partner-network="false"');
});

it("renders the signed-out child segment so its page can enforce authentication", async () => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(null);
  const html = renderToStaticMarkup(
    await ProtectedShell({ children: <p>Page guard</p> }),
  );
  expect(html).toContain("Page guard");
  expect(mocks.listMemberships).not.toHaveBeenCalled();
});
