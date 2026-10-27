import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  availableScopes: vi.fn(),
  getListOptions: vi.fn((scope: string) => ({
    queryKey: ["projects", scope],
  })),
  hasOrganizationMembership: vi.fn().mockResolvedValue(true),
  getSession: vi.fn(),
  hasCostTrackerPermissions: vi.fn().mockResolvedValue(true),
  hydrateClient: vi.fn(
    ({ children }: { children: React.ReactNode; client: unknown }) => children,
  ),
  query: vi.fn((options: { queryKey: string[] }) =>
    options.queryKey[1] === "available-scopes"
      ? mocks.availableScopes()
      : Promise.resolve(undefined),
  ),
  swallowPrefetchError: vi.fn(),
}));

const queryClient = { query: mocks.query };

vi.mock("@/features/projects/components/project-list", () => ({
  ProjectList: () => <p data-testid="project-list">Project list</p>,
}));
vi.mock("@/features/projects/components/project-list-section", () => ({
  ProjectListSection: () => (
    <p data-testid="project-list-section">Project list section</p>
  ),
}));
vi.mock("@/features/projects/components/project-partnership-section", () => ({
  ProjectPartnershipSection: ({ canAssign }: { canAssign: boolean }) => (
    <p data-can-assign={canAssign} data-testid="project-partnership-section">
      Project Partnership manager
    </p>
  ),
}));
vi.mock(
  "@/features/projects/components/partnership-participants-section",
  () => ({
    PartnershipParticipantsSection: () => (
      <p data-testid="partnership-participants-section">
        Partnership participants section
      </p>
    ),
  }),
);
vi.mock("@/features/projects/components/hosted-participants-section", () => ({
  HostedParticipantsSection: () => (
    <p data-testid="hosted-participants-section">Hosted participants section</p>
  ),
}));
vi.mock("@/features/projects/components/hosted-participant-report", () => ({
  HostedParticipantReport: () => (
    <p data-testid="hosted-participant-report">Hosted participant report</p>
  ),
}));
vi.mock("@/features/projects/components/project-workspace-section", () => ({
  ProjectWorkspaceSection: () => (
    <p data-testid="project-workspace-section">Project workspace section</p>
  ),
}));
vi.mock("@/features/projects/components/project-partnership-manager", () => ({
  ProjectPartnershipManager: ({ canAssign }: { canAssign: boolean }) => (
    <p data-can-assign={canAssign} data-testid="project-partnership-manager">
      Project Partnership manager
    </p>
  ),
}));
vi.mock("@/features/projects/components/participant-coordination", () => ({
  ParticipantCoordination: ({ partnershipId }: { partnershipId: string }) => (
    <p data-partnership-id={partnershipId} data-testid="participant-coordination">
      Coordination for {partnershipId}
    </p>
  ),
}));
vi.mock("@/features/projects/components/project-workspace", () => ({
  ProjectWorkspace: ({
    projectId,
    returnTo,
  }: {
    projectId: string;
    returnTo?: string;
  }) => (
    <p
      data-project-id={projectId}
      data-return-to={returnTo}
      data-testid="project-workspace"
    >
      Project workspace: {projectId}
    </p>
  ),
}));
vi.mock("@/features/projects/components/project-data-error-boundary", () => ({
  ProjectDataErrorBoundary: ({
    children,
    resource,
  }: {
    children: React.ReactNode;
    resource: string;
  }) => <div data-resource={resource}>{children}</div>,
}));
vi.mock(
  "@/features/projects/project-list-query-options",
  async (importOriginal) => ({
    ...((await importOriginal()) as Record<string, unknown>),
    getProjectAvailableScopesQueryOptions: () => ({
      queryKey: ["projects", "available-scopes"],
    }),
    getProjectListQueryOptions: mocks.getListOptions,
  }),
);
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { projects: { scopes: mocks.availableScopes } },
  orpcQuery: {
    projects: {
      searchHosted: {
        queryOptions: () => ({ queryKey: ["projects", "search-hosted"] }),
      },
      get: {
        queryOptions: ({ input }: { input: { projectId: string } }) => ({
          queryKey: ["projects", "detail", input.projectId],
        }),
      },
    },
    projectPartnerships: {
      list: { queryOptions: () => ({ queryKey: ["partnerships", "list"] }) },
    },
    participations: {
      listPartnership: {
        queryOptions: ({ input }: { input: { partnershipId: string } }) => ({
          queryKey: ["participations", input.partnershipId],
        }),
      },
      listHostedReport: {
        queryOptions: ({ input }: { input: { projectId: string } }) => ({
          queryKey: ["participants-report", input.projectId],
        }),
      },
    },
  },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("next/server", () => ({
  connection: () => Promise.resolve(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/projects/procedures/assigned-partnerships", () => ({
  assignedPartnershipIds: vi.fn(async () => []),
}));
vi.mock("@/lib/orpc/middleware", () => ({
  hasCostTrackerPermissions: mocks.hasCostTrackerPermissions,
}));
vi.mock("@/lib/session", () => ({
  hasOrganizationMembership: mocks.hasOrganizationMembership,
  getSession: mocks.getSession,
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => queryClient,
  HydrateClient: mocks.hydrateClient,
  swallowPrefetchError: mocks.swallowPrefetchError,
}));

import PartnerOrganizationsPage from "@/app/(protected)/partner-organizations/page";
import PartnershipParticipantsPage from "@/app/(protected)/partnerships/[id]/participants/page";
import ProjectPage from "@/app/(protected)/projects/[id]/page";
import HostedParticipantsPage from "@/app/(protected)/projects/[id]/participants/page";
import ProjectsPage from "@/app/(protected)/projects/page";

const { ProjectListSection: RealProjectListSection } = await vi.importActual<
  typeof import("@/features/projects/components/project-list-section")
>("@/features/projects/components/project-list-section");
const { ProjectPartnershipSection: RealProjectPartnershipSection } =
  await vi.importActual<
    typeof import("@/features/projects/components/project-partnership-section")
  >("@/features/projects/components/project-partnership-section");
const { PartnershipParticipantsSection: RealPartnershipParticipantsSection } =
  await vi.importActual<
    typeof import("@/features/projects/components/partnership-participants-section")
  >("@/features/projects/components/partnership-participants-section");
const { ProjectWorkspaceSection: RealProjectWorkspaceSection } =
  await vi.importActual<
    typeof import("@/features/projects/components/project-workspace-section")
  >("@/features/projects/components/project-workspace-section");
const { HostedParticipantsSection: RealHostedParticipantsSection } =
  await vi.importActual<
    typeof import("@/features/projects/components/hosted-participants-section")
  >("@/features/projects/components/hosted-participants-section");

describe("Cost Tracker Project data routes", () => {
  it("shows the manager without assignment tools when readable but not assignable", async () => {
    mocks.getSession.mockResolvedValue({
      session: {
        id: "session-1",
        userId: "user-1",
        activeOrganizationId: "org-1",
      },
      user: { id: "user-1", name: "Viewer", email: "viewer@example.com" },
    });
    mocks.hasCostTrackerPermissions
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    render(await PartnerOrganizationsPage());
    expect(
      screen
        .getByTestId("project-partnership-section")
        .getAttribute("data-can-assign"),
    ).toBe("false");
  });

  it("shows a friendly note instead of a denial when nothing is viewable", async () => {
    mocks.hasCostTrackerPermissions.mockResolvedValue(false);
    render(await PartnerOrganizationsPage());
    expect(screen.getByTestId("hosting-staff-note")).toBeInTheDocument();
    expect(
      screen.queryByTestId("project-partnership-section"),
    ).not.toBeInTheDocument();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.availableScopes.mockResolvedValue({ hosted: true, partner: true });
  });

  it("renders the page shell without awaiting section prefetches", async () => {
    render(await ProjectsPage());

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("project-list-section")).toBeInTheDocument();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("keeps the other Project page shells outside their async sections", async () => {
    render(await PartnerOrganizationsPage());
    render(
      await PartnershipParticipantsPage({
        params: Promise.resolve({ id: "partnership-1" }),
      }),
    );
    render(
      await ProjectPage({
        params: Promise.resolve({ id: "project-1" }),
      }),
    );
    render(
      await HostedParticipantsPage({
        params: Promise.resolve({ id: "project-1" }),
      }),
    );

    expect(
      screen.getByTestId("partnership-participants-section"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("project-workspace-section")).toBeInTheDocument();
    expect(screen.getByTestId("hosted-participants-section")).toBeInTheDocument();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("defaults to Hosted and prefetches only the selected list", async () => {
    render(await RealProjectListSection({ searchParams: Promise.resolve({}) }));

    expect(mocks.availableScopes).toHaveBeenCalledOnce();
    expect(mocks.getListOptions).toHaveBeenCalledWith(
      "hosted",
      expect.objectContaining({ pageSize: 25, window: "all" }),
    );
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenNthCalledWith(1, {
      queryKey: ["projects", "available-scopes"],
    });
    expect(mocks.query).toHaveBeenNthCalledWith(2, {
      queryKey: ["projects", "hosted"],
    });
    expect(screen.getByTestId("project-list")).toBeInTheDocument();
  });

  it("uses Partner when requested and available", async () => {
    render(
      await RealProjectListSection({
        searchParams: Promise.resolve({ scope: "partner", window: "open" }),
      }),
    );

    expect(mocks.getListOptions).toHaveBeenCalledWith(
      "partner",
      expect.objectContaining({ window: "open" }),
    );
    expect(screen.getByTestId("project-list")).toBeInTheDocument();
  });

  it("falls back to Partner when no Hosted Projects are available", async () => {
    mocks.availableScopes.mockResolvedValue({ hosted: false, partner: true });

    render(await RealProjectListSection({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("project-list")).toBeInTheDocument();
  });

  it("does not prefetch an list when no Project scope is available", async () => {
    mocks.availableScopes.mockResolvedValue({ hosted: false, partner: false });

    render(await RealProjectListSection({ searchParams: Promise.resolve({}) }));

    expect(mocks.getListOptions).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("project-list")).toBeInTheDocument();
  });

  it("prefetches the assigned-project branch when creation is allowed without a list scope", async () => {
    mocks.availableScopes.mockResolvedValue({
      hosted: false,
      partner: false,
      canCreate: true,
    });

    render(await RealProjectListSection({ searchParams: Promise.resolve({}) }));

    expect(mocks.getListOptions).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenNthCalledWith(2, {
      queryKey: ["projects", "search-hosted"],
    });
  });

  it("prefetches Hosted Projects without a stale Partner cursor", async () => {
    mocks.availableScopes.mockResolvedValue({ hosted: true, partner: false });

    render(
      await RealProjectListSection({
        searchParams: Promise.resolve({
          cursor: "partner-cursor",
          scope: "partner",
        }),
      }),
    );

    expect(mocks.getListOptions).toHaveBeenCalledWith(
      "hosted",
      expect.objectContaining({ cursor: undefined }),
    );
  });

  it("prefetches Project Partnership management data", async () => {
    render(await RealProjectPartnershipSection({ canAssign: true }));

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["partnerships", "list"],
    });
    expect(screen.getByTestId("project-partnership-manager")).toHaveAttribute(
      "data-can-assign",
      "true",
    );
  });

  it("prefetches only the requested Partnership's server-authorized list", async () => {
    render(
      await RealPartnershipParticipantsSection({
        params: Promise.resolve({ id: "own-partnership" }),
      }),
    );
    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["participations", "own-partnership"],
    });
    expect(screen.getByTestId("participant-coordination")).toHaveAttribute(
      "data-partnership-id",
      "own-partnership",
    );
  });

  it("prefetches only the requested Hosting report", async () => {
    render(
      await RealHostedParticipantsSection({
        params: Promise.resolve({ id: "project-9" }),
      }),
    );

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["participants-report", "project-9"],
    });
    expect(screen.getByTestId("hosted-participant-report")).toBeInTheDocument();
  });

  it("keeps Project authorization independent from the return destination", async () => {
    render(
      await RealProjectWorkspaceSection({
        params: Promise.resolve({ id: "project-1" }),
        searchParams: Promise.resolve({
          returnTo: "/projects?scope=partner&search=climate&cursor=opaque",
        }),
      }),
    );

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["projects", "detail", "project-1"],
    });
    const workspace = screen.getByTestId("project-workspace");
    expect(workspace).toHaveAttribute("data-project-id", "project-1");
    expect(workspace).toHaveAttribute(
      "data-return-to",
      "/projects?scope=partner&search=climate&cursor=opaque",
    );
  });
});
