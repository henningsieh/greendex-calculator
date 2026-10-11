import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ClaimReviewLoading from "@/app/(protected)/claims/review/[id]/loading";
import ClaimReviewQueueLoading from "@/app/(protected)/claims/review/loading";
import PartnerOrganizationsLoading from "@/app/(protected)/partner-organizations/loading";
import ClaimLoading from "@/app/(protected)/partnerships/[id]/claim/loading";
import ParticipantDetailsLoading from "@/app/(protected)/partnerships/[id]/participants/[participationId]/loading";
import PartnershipParticipantsLoading from "@/app/(protected)/partnerships/[id]/participants/loading";
import ProjectLoading from "@/app/(protected)/projects/[id]/loading";
import HostedParticipantsLoading from "@/app/(protected)/projects/[id]/participants/loading";
import {
  ClaimWorkspaceSkeleton,
  ClaimReviewSkeleton,
  ClaimReviewQueueSkeleton,
  PartnershipParticipantsSkeleton,
  ParticipantDetailsSkeleton,
  HostedParticipantsSkeleton,
  ProjectPartnershipsSkeleton,
  ProjectWorkspaceSkeleton,
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

const workspaceLoadingStates = [
  ["Loading Claim workspace", ClaimWorkspaceSkeleton, ClaimLoading],
  ["Loading Claim review", ClaimReviewSkeleton, ClaimReviewLoading],
  ["Loading submitted Claims", ClaimReviewQueueSkeleton, ClaimReviewQueueLoading],
  [
    "Loading Project Participations",
    PartnershipParticipantsSkeleton,
    PartnershipParticipantsLoading,
  ],
  [
    "Loading Participant details",
    ParticipantDetailsSkeleton,
    ParticipantDetailsLoading,
  ],
  [
    "Loading the Participants report",
    HostedParticipantsSkeleton,
    HostedParticipantsLoading,
  ],
  [
    "Loading Project Partnerships",
    ProjectPartnershipsSkeleton,
    PartnerOrganizationsLoading,
  ],
  ["Loading Project workspace", ProjectWorkspaceSkeleton, ProjectLoading],
] as const;

it.each(workspaceLoadingStates)(
  "%s matches section and navigation skeletons",
  (label, Section, Loading) => {
    const section = render(<Section />);
    expect(screen.getByRole("status", { name: label })).toHaveAttribute(
      "aria-live",
      "polite",
    );
    const cards = section.container.querySelectorAll('[data-slot="card"]').length;
    expect(cards).toBeGreaterThan(0);
    expect(
      section.container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    section.unmount();
    const route = render(<Loading />);
    expect(screen.getByRole("status", { name: label })).toBeInTheDocument();
    expect(route.container.querySelectorAll('[data-slot="card"]')).toHaveLength(
      cards,
    );
  },
);

it("includes the Claim document and decision sections", () => {
  const { container } = render(<ClaimReviewSkeleton />);
  expect(container.querySelector('[data-variant="claim-band"]')).toBeTruthy();
  expect(container.querySelector('[data-variant="document"]')).toBeTruthy();
  expect(container.querySelector('[data-variant="action"]')).toBeTruthy();
});
