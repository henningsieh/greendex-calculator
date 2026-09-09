import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  setUrlState: vi.fn().mockResolvedValue(undefined),
  state: {
    scope: null as "hosted" | "partner" | null,
    search: "",
    window: "all" as const,
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    partnerOrganizationIds: [] as string[],
    sort: "operational" as const,
    cursor: "",
    pageSize: 25 as const,
  },
}));

vi.mock("nuqs", () => ({
  useQueryStates: () => [mocks.state, mocks.setUrlState],
}));
vi.mock("@/features/projects/project-overview-query-options", () => ({
  getProjectOverviewQueryOptions: (
    scope: "hosted" | "partner",
    state: object,
  ) => ({
    queryKey: ["projects", scope, state],
    queryFn: async () => ({
      scope: "hosted" as const,
      rows: [
        {
          id: "project-1",
          name: "Climate Forum",
          startDate: new Date("2026-06-01T00:00:00.000Z"),
          endDate: new Date("2026-06-03T00:00:00.000Z"),
          location: "Berlin",
          country: "DE",
          costSubmissionWindowOpen: true,
        },
      ],
      nextCursor: "next-page",
      metrics: {
        whole: {
          projectCount: 3,
          openWindowCount: 2,
          partnerOrganizationCount: 2,
        },
        filtered: {
          projectCount: 1,
          openWindowCount: 1,
          partnerOrganizationCount: 1,
        },
      },
      partnerOptions: [{ id: "partner-1", name: "Mobility Group" }],
    }),
  }),
}));

import { ProjectCollection } from "@/features/projects/components/project-collection";

function renderCollection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading Projects</p>}>
        <ProjectCollection
          availableScopes={{ hosted: true, partner: true }}
          initialScope="hosted"
        />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.scope = null;
  mocks.state.search = "";
  mocks.state.cursor = "";
  mocks.state.partnerOrganizationIds = [];
});

describe("Project collection", { timeout: 10_000 }, () => {
  it("renders one server-returned page without exposing deferred fields", async () => {
    renderCollection();

    expect(
      (
        await screen.findByRole(
          "link",
          { name: "Climate Forum" },
          { timeout: 10_000 },
        )
      ).getAttribute("href"),
    ).toBe("/projects/project-1");
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Projects (3 total)")).toBeTruthy();
    expect(
      screen.queryByText(/EUR|submission count|latest activity/i),
    ).toBeNull();
  });

  it("clears the cursor when scope or filters change", async () => {
    renderCollection();
    await screen.findByText("Climate Forum", undefined, { timeout: 10_000 });

    fireEvent.click(screen.getByRole("tab", { name: "Partner" }));
    expect(mocks.setUrlState).toHaveBeenCalledWith({
      scope: "partner",
      cursor: null,
    });

    fireEvent.click(screen.getByLabelText("Mobility Group"));
    expect(mocks.setUrlState).toHaveBeenCalledWith({
      partnerOrganizationIds: ["partner-1"],
      cursor: null,
    });
  });

  it("stores the opaque next cursor in shallow URL state", async () => {
    renderCollection();
    await screen.findByText("Climate Forum", undefined, { timeout: 10_000 });

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(mocks.setUrlState).toHaveBeenCalledWith({ cursor: "next-page" });
  });
});
