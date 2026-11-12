import { QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  listQuery: vi.fn(),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    projectPartnerships: { remove: vi.fn() },
  },
  orpcQuery: {
    projects: {
      listHosted: { key: () => ["projects", "hosted"] },
      listPartner: { key: () => ["projects", "partner"] },
      get: { key: () => ["projects", "detail"] },
    },
    projectPartnerships: {
      list: {
        queryKey: () => ["partnerships", "list"],
        queryOptions: () => ({
          queryKey: ["partnerships", "list"],
          queryFn: mocks.listQuery,
        }),
      },
    },
  },
}));

import { ProjectPartnershipManager } from "@/features/partnerships/components/project-partnership-manager";

const existingPartnership = {
  id: "partnership-existing",
  projectId: "project-existing",
  projectName: "Existing Project",
  organizationId: "organization-existing",
  organizationName: "Existing Partner Organization",
  assignedAt: new Date("2026-02-01T12:00:00.000Z"),
  updatedAt: new Date("2026-02-01T12:00:00.000Z"),
};

async function renderManager(canAssign: boolean) {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ProjectPartnershipManager canAssign={canAssign} />
    </QueryClientProvider>,
  );
  await screen.findByTestId(
    `partnership-row-${existingPartnership.organizationId}`,
  );
}

describe("ProjectPartnershipManager canAssign gate", () => {
  beforeEach(() => {
    mocks.listQuery.mockReset().mockResolvedValue([existingPartnership]);
  });

  it("hides removal controls when canAssign is false", async () => {
    await renderManager(false);

    expect(mocks.listQuery).toHaveBeenCalled();
    expect(
      screen.queryByTestId(`remove-partnership-${existingPartnership.id}`),
    ).toBeNull();
  });

  it("shows removal controls when canAssign is true", async () => {
    await renderManager(true);

    expect(mocks.listQuery).toHaveBeenCalled();
    expect(
      screen.getByTestId(`remove-partnership-${existingPartnership.id}`),
    ).toBeTruthy();
  });
});
