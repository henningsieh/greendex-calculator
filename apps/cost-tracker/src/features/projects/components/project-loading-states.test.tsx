import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DashboardSkeleton,
  PartnerOrganizationsSkeleton,
  ProjectsSkeleton,
} from "@/features/projects/components/project-loading-states";

describe("Cost Tracker Project loading states", () => {
  it.each([
    ["dashboard", <DashboardSkeleton />, "Loading dashboard"],
    ["Projects", <ProjectsSkeleton />, "Loading Projects"],
    [
      "Partner Organizations",
      <PartnerOrganizationsSkeleton />,
      "Loading Partner Organizations",
    ],
  ])("renders an accessible %s skeleton", (_name, skeleton, accessibleName) => {
    render(skeleton);

    expect(screen.getByRole("status", { name: accessibleName })).toBeTruthy();
    expect(screen.getAllByTestId("loading-skeleton").length).toBeGreaterThan(2);
  });
});
