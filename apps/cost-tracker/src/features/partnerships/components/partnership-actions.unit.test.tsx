import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";

const mocks = vi.hoisted(() => ({ projects: vi.fn(), organizations: vi.fn() }));
vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projects: {
      listHostedOptions: {
        queryOptions: () => ({ queryKey: ["projects"], queryFn: mocks.projects }),
      },
    },
    organizations: {
      listOptions: {
        queryOptions: () => ({
          queryKey: ["organizations"],
          queryFn: mocks.organizations,
        }),
      },
    },
  },
}));
vi.mock("@/features/partnerships/components/setup-link", () => ({
  CreateSetupLinkDialog: ({
    projects,
  }: {
    projects: { id: string; name: string }[];
  }) => (
    <div
      data-testid="setup-options"
      data-project-ids={projects.map((p) => p.id).join(",")}
    />
  ),
}));
vi.mock(
  "@/features/partnerships/components/project-partnership-assigner",
  () => ({
    AssignOrganizationDialog: ({
      organizations,
    }: {
      organizations: { id: string; name: string }[];
    }) => (
      <div
        data-testid="assignment-options"
        data-organization-ids={organizations.map((o) => o.id).join(",")}
      />
    ),
  }),
);

import { PartnershipActions } from "./partnership-actions";

function view(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <Suspense fallback={<p>Loading</p>}>
        <ProjectDataErrorBoundary resource="Partners">
          <PartnershipActions />
        </ProjectDataErrorBoundary>
      </Suspense>
    </QueryClientProvider>
  );
}

it("uses fresh cached options without refetching", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: false } },
  });
  client.setQueryData(["projects"], [{ id: "p", name: "Project A" }]);
  client.setQueryData(["organizations"], [{ id: "o", name: "Organization A" }]);
  mocks.projects.mockClear();
  mocks.organizations.mockClear();
  render(view(client));
  expect(screen.getByTestId("setup-options")).toHaveAttribute(
    "data-project-ids",
    "p",
  );
  expect(screen.getByTestId("assignment-options")).toHaveAttribute(
    "data-organization-ids",
    "o",
  );
  expect(mocks.projects).not.toHaveBeenCalled();
  expect(mocks.organizations).not.toHaveBeenCalled();
});

it("retries failed options through the shared boundary", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mocks.projects
    .mockReset()
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValue([{ id: "p", name: "Recovered project" }]);
  mocks.organizations
    .mockReset()
    .mockResolvedValue([{ id: "o", name: "Partner" }]);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(view(client));
  expect(await screen.findByTestId("retry-project-data")).toBeInTheDocument();
  await userEvent.click(screen.getByTestId("retry-project-data"));
  expect(await screen.findByTestId("setup-options")).toHaveAttribute(
    "data-project-ids",
    "p",
  );
  expect(screen.getByTestId("assignment-options")).toHaveAttribute(
    "data-organization-ids",
    "o",
  );
  error.mockRestore();
});
