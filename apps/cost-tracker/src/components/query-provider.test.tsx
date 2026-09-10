import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.add },
}));

import { QueryProvider } from "@/components/query-provider";

function CachedORPCQuery() {
  const attempts = useRef(0);
  const query = useQuery({
    queryKey: ["projects", "overview"],
    queryFn: async () => {
      if (attempts.current++ > 0) throw new Error("network unavailable");

      return "Cached Project";
    },
    meta: { costTrackerORPC: true },
    retry: false,
  });

  return (
    <>
      <p>{query.data}</p>
      <button onClick={() => void query.refetch()} type="button">
        Refresh
      </button>
    </>
  );
}

describe("QueryProvider", () => {
  it("keeps cached Cost Tracker oRPC data visible and toasts a refresh failure", async () => {
    render(
      <QueryProvider>
        <CachedORPCQuery />
      </QueryProvider>,
    );

    await screen.findByText("Cached Project");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(mocks.add).toHaveBeenCalledWith({
        description:
          "The server or network is unreachable. Check your connection and try again.",
        title: "Could not refresh data",
        type: "error",
      });
    });
    expect(screen.getByText("Cached Project")).toBeTruthy();
  });
});
