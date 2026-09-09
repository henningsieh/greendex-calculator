import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PartnerOrganizationsSkeleton,
  ProjectsSkeleton,
} from "@/features/projects/components/project-loading-states";

describe("Cost Tracker Project loading states", () => {
  it.each([
    ["Projects", <ProjectsSkeleton key="projects" />, "Loading Projects"],
    [
      "Partner Organizations",
      <PartnerOrganizationsSkeleton key="partner-organizations" />,
      "Loading Partner Organizations",
    ],
  ])("renders an accessible %s skeleton", (_name, skeleton, accessibleName) => {
    render(skeleton);

    expect(screen.getByRole("status", { name: accessibleName })).toBeTruthy();
    expect(screen.getAllByTestId("loading-skeleton").length).toBeGreaterThan(2);
  });
});
