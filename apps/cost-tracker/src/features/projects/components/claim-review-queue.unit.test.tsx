import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "react-error-boundary";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ failDraft: false }));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projectPartnerships: {
      list: {
        queryOptions: () => ({
          queryKey: ["partnerships"],
          queryFn: async () => [
            { id: "one", projectName: "Forest", organizationName: "Partner A" },
            { id: "two", projectName: "Ocean", organizationName: "Partner B" },
          ],
        }),
      },
    },
    claims: {
      getDraft: {
        queryOptions: ({ input }: { input: { partnershipId: string } }) => ({
          queryKey: ["claims", input.partnershipId],
          queryFn: async () => {
            if (mocks.failDraft && input.partnershipId === "one") {
              throw new Error("Could not load draft");
            }
            return {
              status: input.partnershipId === "one" ? "submitted" : "paid",
            };
          },
        }),
      },
    },
  },
}));

import { ClaimReviewQueue } from "@/features/projects/components/claim-review-queue";

describe("Host submitted Claim queue", () => {
  it("does not present failed draft requests as an empty successful queue", async () => {
    mocks.failDraft = true;
    try {
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <ErrorBoundary fallback={<p>Claim queue failed</p>}>
            <ClaimReviewQueue />
          </ErrorBoundary>
        </QueryClientProvider>,
      );
      expect(await screen.findByText("Claim queue failed")).toBeTruthy();
      expect(
        screen.queryByText("No submitted Claims available for review."),
      ).toBeNull();
    } finally {
      mocks.failDraft = false;
    }
  });

  it("links only submitted Claims to their single-request review", async () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ClaimReviewQueue />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("link", { name: "Forest · Partner A" }),
    ).toHaveAttribute("href", "/claims/review/one");
    expect(screen.queryByRole("link", { name: "Ocean · Partner B" })).toBeNull();
  });
});
