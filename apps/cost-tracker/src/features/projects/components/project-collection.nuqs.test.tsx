import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  availableScopes: { hosted: true, partner: false },
  getOverviewOptions: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));
vi.mock("@/features/projects/project-overview-query-options", () => ({
  getProjectAvailableScopesQueryOptions: () => ({
    queryKey: ["projects", "available-scopes"],
    queryFn: async () => mocks.availableScopes,
  }),
  getProjectOverviewQueryOptions: mocks.getOverviewOptions.mockImplementation(
    (scope: "hosted" | "partner", state: object) => ({
      queryKey: ["projects", scope, state],
      queryFn: async () => ({
        scope,
        rows: [],
        nextCursor: undefined,
        metrics: {
          whole: {
            projectCount: 0,
            openWindowCount: 0,
            partnerOrganizationCount: 0,
          },
          filtered: {
            projectCount: 0,
            openWindowCount: 0,
            partnerOrganizationCount: 0,
          },
        },
        partnerOptions: [],
      }),
    }),
  ),
}));

import { ProjectCollection } from "@/features/projects/components/project-collection";

function renderCollection({
  onUrlUpdate,
  searchParams = "?scope=partner&cursor=partner-cursor",
}: {
  onUrlUpdate: (event: UrlUpdateEvent) => void;
  searchParams?: string;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <NuqsTestingAdapter
      hasMemory
      onUrlUpdate={onUrlUpdate}
      searchParams={searchParams}
    >
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<p>Loading Projects</p>}>
          <ProjectCollection />
        </Suspense>
      </QueryClientProvider>
    </NuqsTestingAdapter>,
  );
}

describe("Project collection unavailable scope fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.availableScopes = { hosted: true, partner: false };
  });

  it("replaces an unavailable Partner URL before creating the Hosted query", async () => {
    const onUrlUpdate = vi.fn();
    renderCollection({ onUrlUpdate });

    await screen.findByRole("tab", { name: "Hosted" });

    expect(mocks.getOverviewOptions).toHaveBeenCalledWith(
      "hosted",
      expect.objectContaining({ cursor: undefined }),
    );
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledOnce());
    const update = onUrlUpdate.mock.calls[0]?.[0] as UrlUpdateEvent;
    expect(update.options.history).toBe("replace");
    expect(update.searchParams.get("scope")).toBe("hosted");
    expect(update.searchParams.has("cursor")).toBe(false);
    expect(mocks.toastAdd).toHaveBeenCalledWith({
      description:
        "Partner Projects are unavailable. Hosted Projects are shown instead.",
      title: "Project view updated",
      type: "info",
    });
  });

  it.each(["hosted", "partner"] as const)(
    "keeps a valid %s URL unchanged",
    async (scope) => {
      const onUrlUpdate = vi.fn();
      mocks.availableScopes = { hosted: true, partner: true };
      renderCollection({
        onUrlUpdate,
        searchParams: `?scope=${scope}&cursor=${scope}-cursor`,
      });

      await screen.findByRole("tab", { name: "Hosted" });

      expect(mocks.getOverviewOptions).toHaveBeenCalledWith(
        scope,
        expect.objectContaining({ cursor: `${scope}-cursor` }),
      );
      expect(onUrlUpdate).not.toHaveBeenCalled();
      expect(mocks.toastAdd).not.toHaveBeenCalled();
    },
  );
});
