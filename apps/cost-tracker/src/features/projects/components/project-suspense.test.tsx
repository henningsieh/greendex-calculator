import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

const pendingProjectQuery = vi.hoisted(() => new Promise<never>(() => {}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projects: {
      list: {
        queryOptions: () => ({
          queryKey: ["projects", "list"],
          queryFn: () => pendingProjectQuery,
        }),
      },
    },
  },
}));

import { ProjectsList } from "@/features/projects/components/projects-list";

describe("Cost Tracker Project suspense", () => {
  it("shows the nearest suspense fallback while the generated Project query is pending", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<p>Loading Project data</p>}>
          <ProjectsList />
        </Suspense>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Loading Project data")).toBeTruthy();
  });
});
