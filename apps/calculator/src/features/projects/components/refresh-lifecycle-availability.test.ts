import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projects: {
      list: { queryKey: () => ["projects", "list"] },
      getById: {
        queryKey: ({ input }: { input: { id: string } }) => [
          "projects",
          "detail",
          input.id,
        ],
      },
    },
  },
}));

import { refreshLifecycleAvailabilityOnRefusal } from "./refresh-lifecycle-availability";

describe("refresh lifecycle availability", () => {
  it.each(["FORBIDDEN", "NOT_FOUND"] as const)(
    "invalidates list and detail on %s",
    (code) => {
      const client = new QueryClient();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      refreshLifecycleAvailabilityOnRefusal(
        new ORPCError(code),
        client,
        "project-1",
      );
      expect(invalidate).toHaveBeenCalledTimes(2);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects", "list"] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["projects", "detail", "project-1"],
      });
    },
  );

  it("does not invalidate for network failures", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    refreshLifecycleAvailabilityOnRefusal(
      new Error("Network unavailable"),
      client,
      "project-1",
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
