import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(() => Promise.resolve(undefined)),
  swallowPrefetchError: vi.fn(),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projects: {
      searchHosted: {
        queryOptions: () => ({ queryKey: ["projects", "search-hosted"] }),
      },
    },
    projectPartnerships: {
      list: {
        queryOptions: () => ({ queryKey: ["partnerships", "list"] }),
      },
    },
  },
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
  HydrateClient: ({ children }: { children: React.ReactNode }) => children,
  swallowPrefetchError: mocks.swallowPrefetchError,
}));
vi.mock("@/components/query-data-error-boundary", () => ({
  ProjectDataErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("@/features/partnerships/components/project-partnership-manager", () => ({
  ProjectPartnershipManager: ({ canAssign }: { canAssign: boolean }) => (
    <p data-can-assign={canAssign} data-testid="project-partnership-manager">
      Project Partnership manager
    </p>
  ),
}));

import { ProjectPartnershipSection as RealProjectPartnershipSection } from "@/features/partnerships/components/project-partnership-section";

describe("ProjectPartnershipSection canAssign gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(() => Promise.resolve(undefined));
  });

  it("does not prefetch hosted projects when canAssign is false", async () => {
    render(await RealProjectPartnershipSection({ canAssign: false }));

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["partnerships", "list"],
    });
    expect(mocks.query).not.toHaveBeenCalledWith({
      queryKey: ["projects", "search-hosted"],
    });
    expect(screen.getByTestId("project-partnership-manager")).toHaveAttribute(
      "data-can-assign",
      "false",
    );
  });

  it("prefetches hosted projects when canAssign is true", async () => {
    render(await RealProjectPartnershipSection({ canAssign: true }));

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["partnerships", "list"],
    });
    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["projects", "search-hosted"],
    });
  });
});
