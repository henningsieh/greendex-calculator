import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({
  data: {
    rows: [
      {
        partnershipId: "one",
        projectId: "project-one",
        projectName: "Forest",
        organizationId: "partner-a",
        organizationName: "Partner A",
        status: "submitted" as const,
        submittedAt: new Date("2026-11-01T00:00:00.000Z"),
        payableAmountEur: "1200.00",
      },
    ],
    metrics: {
      whole: { claimCount: 1, projectCount: 1, partnerOrganizationCount: 1 },
      filtered: { claimCount: 1, projectCount: 1, partnerOrganizationCount: 1 },
    },
    partnerOptions: [{ id: "partner-a", name: "Partner A" }],
  },
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    claims: {
      listReviewQueue: {
        queryOptions: () => ({
          queryKey: ["claims", "review-queue"],
          queryFn: async () => mocks.data,
        }),
      },
    },
  },
}));

import { ClaimReviewQueue } from "@/features/claims/components/claim-review-queue";

function renderQueue() {
  return render(
    <NuqsTestingAdapter hasMemory searchParams="">
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
  it("renders submitted Claims with a direct review link", async () => {
    renderQueue();
    expect(await screen.findByTestId("review-queue")).toBeTruthy();
    expect(await screen.findByTestId("review-claim-one")).toHaveAttribute(
      "href",
      "/en-GB/partnerships/one/claim/review",
    );
  });

  it("renders one empty state when no Claim awaits review", async () => {
    mocks.data = {
      rows: [],
      metrics: {
        whole: { claimCount: 0, projectCount: 0, partnerOrganizationCount: 0 },
        filtered: { claimCount: 0, projectCount: 0, partnerOrganizationCount: 0 },
      },
      partnerOptions: [],
    };
    renderQueue();
    expect(await screen.findByTestId("review-queue-empty")).toBeTruthy();
  });
});
