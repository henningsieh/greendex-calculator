import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createQueryClient } from "@/lib/tanstack-react-query/client";
import { HydrateClient } from "@/lib/tanstack-react-query/hydration";

const queryKey = ["projects", "hydrated-overview"] as const;

function HydratedProject({ queryFn }: { queryFn: () => Promise<string> }) {
  const { data } = useQuery({ queryKey, queryFn });

  return <p>{data}</p>;
}

describe("Cost Tracker Query hydration", () => {
  it("renders server-prefetched data without immediately refetching it", async () => {
    const serverClient = createQueryClient();
    await serverClient.query({
      queryKey,
      queryFn: async () => "Hydrated Project",
    });
    const browserClient = createQueryClient();
    const browserQuery = vi.fn().mockResolvedValue("Browser Project");

    render(
      <QueryClientProvider client={browserClient}>
        <HydrateClient client={serverClient}>
          <HydratedProject queryFn={browserQuery} />
        </HydrateClient>
      </QueryClientProvider>,
    );

    await screen.findByText("Hydrated Project");
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Red if staleTime becomes zero or the server/client query identity diverges.
    expect(browserQuery).not.toHaveBeenCalled();
    expect(browserClient.getQueryData(queryKey)).toBe("Hydrated Project");
  });
});
