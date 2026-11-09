import { ORPCError } from "@orpc/client";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@greendex/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@greendex/i18n/server")>()),
  getTranslations: (await import("@/__tests__/i18n")).getTranslations,
}));

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    claims: {
      getReviewDetails: {
        queryOptions: ({ input }: { input: { partnershipId: string } }) => ({
          queryKey: ["claim-review-details", input.partnershipId],
        }),
      },
    },
  },
}));

const { ReviewContext } =
  await import("@/features/claims/components/claim-review-page");

function context() {
  return ReviewContext({
    params: Promise.resolve({ partnershipId: "partnership-1" }),
  });
}

function contextState(container: HTMLElement) {
  return container
    .querySelector("[data-claim-review-context]")
    ?.getAttribute("data-claim-review-context");
}

beforeEach(() => {
  mocks.query.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("Claim review header context", () => {
  it("resolves the context from the requested Partnership", async () => {
    mocks.query.mockResolvedValue({
      projectName: "Spring workshop",
      organizationName: "Green Routes",
    });

    const { container } = render(await context());

    expect(mocks.query).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["claim-review-details", "partnership-1"],
      }),
    );
    expect(contextState(container)).toBe("resolved");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("degrades when the viewer may not see the Claim", async () => {
    mocks.query.mockRejectedValue(
      new ORPCError("FORBIDDEN", { message: "Not your Partnership." }),
    );

    const { container } = render(await context());

    expect(contextState(container)).toBe("unavailable");
    // A refusal is the expected answer here, not a defect.
    expect(console.error).not.toHaveBeenCalled();
  });

  it("keeps the page up when the header read fails unexpectedly", async () => {
    // The header sits outside the section's retryable boundary, so an
    // unexpected failure may only cost the context copy (#390).
    mocks.query.mockRejectedValue(new Error("connection reset"));

    const { container } = render(await context());

    expect(contextState(container)).toBe("unavailable");
    expect(console.error).toHaveBeenCalledWith(
      "Claim review header context failed.",
    );
  });
});
