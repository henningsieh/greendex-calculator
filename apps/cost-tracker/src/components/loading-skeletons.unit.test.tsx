import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { ClaimReviewLoading } from "@/features/claims/components/claim-review-loading";
import { ClaimReviewQueueLoading } from "@/features/claims/components/claim-review-queue-loading";
import { ClaimWorkspaceLoading } from "@/features/claims/components/claim-workspace-loading";
import {
  PartnershipParticipantsSkeleton,
  ParticipantDetailsSkeleton,
  HostedParticipantsSkeleton,
} from "@/features/participations/components/loading-skeletons";
import {
  ProjectPartnershipsSkeleton,
  PartnerOrganizationsSkeleton,
} from "@/features/partnerships/components/partnership-loading-states";
import { ProjectWorkspaceLoading } from "@/features/projects/components/project-workspace-loading";
import { ProjectsPageLoading } from "@/features/projects/components/projects-page-loading";

describe("Cost Tracker Project loading states", () => {
  it("mirrors the Claims queue page shell in one loading region", () => {
    const route = render(<ClaimReviewQueueLoading />);
    expect(route.container.querySelectorAll("output")).toHaveLength(1);
    expect(route.container.querySelector("section.mt-6")).toBeTruthy();
    expect(
      route.container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(2);
  });

  it.each([
    ["Projects", <ProjectsPageLoading key="projects" />, "Loading Projects"],
    [
      "Partners",
      <PartnerOrganizationsSkeleton key="partner-organizations" />,
      "Loading Partners",
    ],
  ])("renders an accessible %s skeleton", (_name, skeleton, accessibleName) => {
    render(skeleton);

    expect(screen.getByRole("status", { name: accessibleName })).toBeTruthy();
    expect(screen.getAllByTestId("loading-skeleton").length).toBeGreaterThan(2);
  });
});

const workspaceLoadingStates = [
  ["Claim workspace", ClaimWorkspaceLoading, "Loading Claim workspace"],
  ["Claim review", ClaimReviewLoading, "Loading Claim review"],
  [
    "Partnership Participations",
    PartnershipParticipantsSkeleton,
    "Loading Participations",
  ],
  [
    "Participation details",
    ParticipantDetailsSkeleton,
    "Loading Participation details",
  ],
  ["Hosted Participations", HostedParticipantsSkeleton, "Loading Participations"],
  [
    "Project Partnerships",
    ProjectPartnershipsSkeleton,
    "Loading Project Partnerships",
  ],
  ["Project workspace", ProjectWorkspaceLoading, "Loading Project workspace"],
] as const;

it.each(workspaceLoadingStates)(
  "%s keeps its accessible loading region and card frame",
  (_name, Section, label) => {
    const section = render(<Section />);
    expect(screen.getByRole("status", { name: label })).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(
      section.container.querySelectorAll('[data-slot="card"]').length,
    ).toBeGreaterThan(0);
    expect(
      section.container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  },
);

it("includes the Claim document and decision sections", () => {
  const { container } = render(<ClaimReviewLoading />);
  expect(container.querySelector('[data-variant="claim-band"]')).toBeTruthy();
  expect(container.querySelector('[data-variant="document"]')).toBeTruthy();
  expect(container.querySelector('[data-variant="action"]')).toBeTruthy();
});
