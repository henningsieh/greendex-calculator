import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import ClaimReviewQueueLoading from "@/app/(protected)/claims/review/loading";
import PartnerOrganizationsLoading from "@/app/(protected)/partner-organizations/loading";
import ClaimLoading from "@/app/(protected)/partnerships/[partnershipId]/claim/loading";
import ClaimReviewLoading from "@/app/(protected)/partnerships/[partnershipId]/claim/review/loading";
import ParticipantDetailsLoading from "@/app/(protected)/partnerships/[partnershipId]/participants/[participationId]/loading";
import PartnershipParticipantsLoading from "@/app/(protected)/partnerships/[partnershipId]/participants/loading-skeletons";
import ProjectLoading from "@/app/(protected)/projects/[id]/loading";
import HostedParticipantsLoading from "@/app/(protected)/projects/[id]/participants/loading";
import LocalizedClaimLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/claim/loading";
import LocalizedClaimReviewLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/claim/review/loading";
import LocalizedParticipantDetailsLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/participants/[participationId]/loading";
import LocalizedPartnershipParticipantsLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/participants/loading";
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

it.each([
  ["Loading Claim workspace", ClaimLoading, LocalizedClaimLoading],
  ["Loading Claim review", ClaimReviewLoading, LocalizedClaimReviewLoading],
  [
    "Loading Participant details",
    ParticipantDetailsLoading,
    LocalizedParticipantDetailsLoading,
  ],
  [
    "Loading Project Participations",
    PartnershipParticipantsLoading,
    LocalizedPartnershipParticipantsLoading,
  ],
  [
    "Loading the Participants report",
    HostedParticipantsLoading,
    LocalizedHostedParticipantsLoading,
  ],
] as const)(
  "%s has matching localized navigation content",
  (label, Loading, LocalizedLoading) => {
    const unprefixed = render(<Loading />);
    const cards =
      unprefixed.container.querySelectorAll('[data-slot="card"]').length;
    unprefixed.unmount();
    const localized = render(<LocalizedLoading />);
    expect(screen.getByRole("status", { name: label })).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(
      localized.container.querySelectorAll('[data-slot="card"]'),
    ).toHaveLength(cards);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  },
);
