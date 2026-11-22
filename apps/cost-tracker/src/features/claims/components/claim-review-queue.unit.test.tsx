import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const fixtures = vi.hoisted(() => {
  const data = {
    rows: [
      {
        partnershipId: "one",
        projectId: "project-one",
        projectName: "Forest",
        organizationId: "partner-a",
        organizationName: "Partner A",
        status: "submitted" as const,
        submittedAt: new Date("2026-11-01T00:00:00.000Z"),
        reimbursementAmountEur: "1200.00",
      },
    ],
    metrics: {
      whole: { claimCount: 1, projectCount: 1, partnerOrganizationCount: 1 },
      filtered: { claimCount: 1, projectCount: 1, partnerOrganizationCount: 1 },
    },
    partnerOptions: [{ id: "partner-a", name: "Partner A" }],
  };
  return { data, query: vi.fn<() => Promise<typeof data>>() };
});

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    claims: {
      listReviewQueue: {
        queryOptions: ({ input }: { input: { search?: string } }) => ({
          queryKey: ["claims", "review-queue", input],
          queryFn: fixtures.query,
        }),
      },
    },
  },
}));

import { ClaimReviewQueue } from "@/features/claims/components/claim-review-queue";

function renderQueue(searchParams = "", onUrlUpdate = vi.fn()) {
  return render(
    <NuqsTestingAdapter
      hasMemory
      searchParams={searchParams}
      onUrlUpdate={onUrlUpdate}
    >
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <Suspense fallback={<p>Loading</p>}>
          <ClaimReviewQueue />
        </Suspense>
      </QueryClientProvider>
    </NuqsTestingAdapter>,
  );
}

describe("Host submitted Claim queue", () => {
  const emptyMetrics = {
    claimCount: 0,
    projectCount: 0,
    partnerOrganizationCount: 0,
  };

  it("renders submitted Claims with a direct review link", async () => {
    fixtures.query.mockReset().mockResolvedValue(fixtures.data);
    renderQueue();
    expect(await screen.findByTestId("review-queue")).toBeTruthy();
    expect(await screen.findByTestId("review-claim-one")).toHaveAttribute(
      "href",
      "/en-GB/partnerships/one/claim/review",
    );
  });

  it("keeps the card review link in its own footer below the data list", async () => {
    fixtures.query.mockReset().mockResolvedValue(fixtures.data);
    renderQueue();

    // The destination column carries the review link's own name (claims.json
    // keys it under `columns.claimReview`), not the generic "Action" slot.
    expect(
      await screen.findByTestId("claim-column-header-claimReview"),
    ).toBeVisible();
    const cardLink = await screen.findByTestId("review-claim-one-card");
    expect(cardLink.getAttribute("href")).toBe(
      "/en-GB/partnerships/one/claim/review",
    );
    // Navigation leaves the facts list: the footer separates it from details.
    expect(cardLink.closest("dl")).toBeNull();
    expect(cardLink.parentElement).toHaveClass("border-t");
  });

  it("renders one empty state when no Claim awaits review", async () => {
    fixtures.query.mockReset().mockResolvedValue({
      rows: [],
      metrics: {
        whole: emptyMetrics,
        filtered: emptyMetrics,
      },
      partnerOptions: [],
    });
    renderQueue();
    const empty = await screen.findByTestId("review-queue-empty");
    expect(empty.querySelector('[data-message="emptyTitle"]')).toBeVisible();
    expect(within(empty).queryByTestId("claim-queue-clear-filters")).toBeNull();
  });

  it("explains when filters hide pending Claims and offers to clear them", async () => {
    const unfiltered = Promise.withResolvers<typeof fixtures.data>();
    fixtures.query
      .mockReset()
      .mockReturnValue(unfiltered.promise)
      .mockResolvedValueOnce({
        rows: [],
        metrics: {
          whole: { claimCount: 1, projectCount: 1, partnerOrganizationCount: 1 },
          filtered: emptyMetrics,
        },
        partnerOptions: [],
      });
    const onUrlUpdate = vi.fn();
    renderQueue("?search=unmatched", onUrlUpdate);

    const empty = await screen.findByTestId("review-queue-empty");
    expect(empty.querySelector('[data-message="noMatchesTitle"]')).toBeVisible();
    await userEvent.click(within(empty).getByTestId("claim-queue-clear-filters"));
    expect(onUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ queryString: "" }),
    );
    expect(screen.queryByTestId("review-queue-empty")).toBeNull();
    unfiltered.resolve(fixtures.data);
    expect(await screen.findByTestId("review-claim-one")).toBeVisible();
  });
});
