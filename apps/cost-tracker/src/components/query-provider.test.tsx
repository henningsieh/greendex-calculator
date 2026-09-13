import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function FailingCachedORPCQuery({
  error,
  label,
}: {
  error: Error;
  label: string;
}) {
  const query = useQuery({
    initialData: "Cached Project",
    meta: { costTrackerORPC: true },
    queryFn: async () => {
      throw error;
    },
    queryKey: ["projects", label],
    retry: false,
  });

  return (
    <button
      disabled={query.isFetching}
      onClick={() => void query.refetch()}
      type="button"
    >
      {query.isFetching ? `Refreshing ${label}` : `Refresh ${label}`}
    </button>
  );
}

describe("QueryProvider", () => {
  beforeEach(() => {
    mocks.add.mockClear();
  });
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

  it("shows one toast for an identical oRPC failure burst across queries", async () => {
    const firstError = new ORPCError("SERVICE_UNAVAILABLE", { status: 503 });
    const secondError = new ORPCError("SERVICE_UNAVAILABLE", { status: 503 });

    render(
      <QueryProvider>
        <FailingCachedORPCQuery error={firstError} label="Hosted Projects" />
        <FailingCachedORPCQuery error={secondError} label="Partner Projects" />
      </QueryProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh Hosted Projects" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh Partner Projects" }),
    );

    await screen.findByRole("button", { name: "Refresh Hosted Projects" });
    await screen.findByRole("button", { name: "Refresh Partner Projects" });
    expect(mocks.add).toHaveBeenCalledOnce();
  });
});
