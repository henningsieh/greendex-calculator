import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import LocalizedClaimReviewQueueLoading from "@/app/[locale]/(protected)/claims/review/loading";
import LocalizedPartnerOrganizationsLoading from "@/app/[locale]/(protected)/partner-organizations/loading";
import LocalizedClaimLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/claim/loading";
import LocalizedClaimReviewLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/claim/review/loading";
import LocalizedParticipantDetailsLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/participants/[participationId]/loading";
import LocalizedPartnershipParticipantsLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/participants/loading";
import LocalizedProjectLoading from "@/app/[locale]/(protected)/projects/[id]/loading";
import LocalizedHostedParticipantsLoading from "@/app/[locale]/(protected)/projects/[id]/participants/loading";
import {
  ClaimWorkspaceSkeleton,
  ClaimReviewSkeleton,
  ClaimReviewQueueSkeleton,
} from "@/features/claims/components/claim-loading-states";
import {
  PartnershipParticipantsSkeleton,
  ParticipantDetailsSkeleton,
  HostedParticipantsSkeleton,
} from "@/features/participations/components/loading-skeletons";
import {
  ProjectPartnershipsSkeleton,
  PartnerOrganizationsSkeleton,
} from "@/features/partnerships/components/partnership-loading-states";
import {
  ProjectWorkspaceSkeleton,
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
  ["Loading Claim workspace", ClaimWorkspaceSkeleton, LocalizedClaimLoading],
  ["Loading Claim review", ClaimReviewSkeleton, LocalizedClaimReviewLoading],
  [
    "Loading submitted Claims",
    ClaimReviewQueueSkeleton,
    LocalizedClaimReviewQueueLoading,
  ],
  [
    "Loading Project Participations",
    PartnershipParticipantsSkeleton,
    LocalizedPartnershipParticipantsLoading,
  ],
  [
    "Loading Participant details",
    ParticipantDetailsSkeleton,
    LocalizedParticipantDetailsLoading,
  ],
  [
    "Loading the Participants report",
    HostedParticipantsSkeleton,
    LocalizedHostedParticipantsLoading,
  ],
  [
    "Loading Project Partnerships",
    ProjectPartnershipsSkeleton,
    LocalizedPartnerOrganizationsLoading,
  ],
  [
    "Loading Project workspace",
    ProjectWorkspaceSkeleton,
    LocalizedProjectLoading,
  ],
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
