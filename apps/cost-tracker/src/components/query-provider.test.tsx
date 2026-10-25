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
    queryKey: ["projects", "list"],
    queryFn: async () => {
      if (attempts.current++ > 0) throw new Error("network unavailable");

      return "Cached Project";
    },
    meta: { costTrackerORPC: true },
    retry: false,
  });

  return (
    <>
      <p data-testid="cached-project" data-query-value={query.data}>
        {query.data}
      </p>
      <button
        data-testid="refresh-query"
        onClick={() => void query.refetch()}
        type="button"
      >
        Refresh
      </button>
    </>
  );
}

function FailingCachedORPCQuery({
  error,
  label,
  id,
}: {
  error: Error;
  label: string;
  id: string;
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
      data-testid={`refresh-${id}-projects`}
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

    await waitFor(() =>
      expect(screen.getByTestId("cached-project")).toHaveAttribute(
        "data-query-value",
        "Cached Project",
      ),
    );
    fireEvent.click(screen.getByTestId("refresh-query"));

    await waitFor(() => {
      expect(mocks.add).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ type: "error" }),
      );
    });
    expect(screen.getByTestId("cached-project")).toHaveAttribute(
      "data-query-value",
      "Cached Project",
    );
  });

  it("shows one toast for an identical oRPC failure burst across queries", async () => {
    const firstError = new ORPCError("SERVICE_UNAVAILABLE", {});
    const secondError = new ORPCError("SERVICE_UNAVAILABLE", {});

    render(
      <QueryProvider>
        <FailingCachedORPCQuery
          id="hosted"
          error={firstError}
          label="Hosted Projects"
        />
        <FailingCachedORPCQuery
          id="partner"
          error={secondError}
          label="Partner Projects"
        />
      </QueryProvider>,
    );

    fireEvent.click(screen.getByTestId("refresh-hosted-projects"));
    fireEvent.click(screen.getByTestId("refresh-partner-projects"));

    await screen.findByTestId("refresh-hosted-projects");
    await screen.findByTestId("refresh-partner-projects");
    expect(mocks.add).toHaveBeenCalledOnce();
  });
});
