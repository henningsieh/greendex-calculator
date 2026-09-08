// @vitest-environment node

import { dehydrate, hydrate } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

describe("Cost Tracker QueryClient", () => {
  it("keeps hydrated Project query data fresh and restores Date values", async () => {
    const queryKey = ["projects", "list"] as const;
    const startDate = new Date("2026-09-08T12:00:00.000Z");
    const serverClient = createQueryClient();

    await serverClient.query({
      queryKey,
      queryFn: async () => ({ startDate }),
    });

    const dehydratedState = dehydrate(serverClient);
    const browserClient = createQueryClient();
    hydrate(browserClient, dehydratedState);

    expect(browserClient.getQueryData(queryKey)).toEqual({ startDate });
    expect(browserClient.getQueryData(queryKey)).toMatchObject({
      startDate: expect.any(Date),
    });
    expect(browserClient.getQueryState(queryKey)?.dataUpdatedAt).toBeGreaterThan(
      0,
    );
    expect(browserClient.getDefaultOptions().queries?.staleTime).toBe(60_000);
  });

  it("dehydrates a pending Project query for the suspense consumer", () => {
    const queryKey = ["projects", "list"] as const;
    const queryClient = createQueryClient();

    void queryClient.query({
      queryKey,
      queryFn: () => new Promise<never>(() => {}),
    });

    const dehydratedState = dehydrate(queryClient);

    expect(dehydratedState.queries).toContainEqual(
      expect.objectContaining({
        queryKey,
        state: expect.objectContaining({ status: "pending" }),
      }),
    );
  });
});
