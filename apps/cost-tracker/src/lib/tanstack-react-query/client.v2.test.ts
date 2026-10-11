// @vitest-environment node
import { dehydrate, hydrate } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

describe("QueryClient v2 serialization", () => {
  it("round-trips rich data through JSON hydration and reuses prefetched navigation data", async () => {
    const date = new Date("2026-10-06T00:00:00Z");
    const queryKey = ["projects", { date }] as const;
    const data = {
      date,
      amount: BigInt(123),
      ids: new Set(["one"]),
      totals: new Map([["one", BigInt(123)]]),
    };
    const server = createQueryClient();
    await server.query({ queryKey, queryFn: async () => data });
    const browser = createQueryClient();
    hydrate(browser, JSON.parse(JSON.stringify(dehydrate(server))));
    const queryFn = vi.fn().mockResolvedValue(null);
    expect(browser.getQueryData(queryKey)).toEqual(data);
    expect(await browser.query({ queryKey, queryFn })).toEqual(data);
    expect(queryFn).not.toHaveBeenCalled();
    expect(browser.getQueryCache().getAll()[0]?.queryHash).toBe(
      server.getQueryCache().getAll()[0]?.queryHash,
    );
    expect(browser.getDefaultOptions().queries?.staleTime).toBe(60_000);
    server.clear();
    browser.clear();
  });
  it("does not collide Date and string query keys", () => {
    const client = createQueryClient();
    client.setQueryData([new Date("2026-10-06")], "date");
    client.setQueryData(["2026-10-06T00:00:00.000Z"], "string");
    expect(client.getQueryCache().getAll()).toHaveLength(2);
    client.clear();
  });
});
