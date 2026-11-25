import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import LocalizedClaimReviewQueueLoading from "@/app/[locale]/(protected)/claims/loading";
import LocalizedPartnerOrganizationsLoading from "@/app/[locale]/(protected)/partner-organizations/loading";
import LocalizedClaimLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/claim/loading";
import LocalizedClaimReviewLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/claim/review/loading";
import LocalizedParticipantDetailsLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/participants/[participationId]/loading";
import LocalizedPartnershipParticipantsLoading from "@/app/[locale]/(protected)/partnerships/[partnershipId]/participants/loading";
import LocalizedProjectLoading from "@/app/[locale]/(protected)/projects/[id]/loading";
import LocalizedHostedParticipantsLoading from "@/app/[locale]/(protected)/projects/[id]/participants/loading";
import { ClaimReviewLoading } from "@/features/claims/components/claim-review-loading";
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
    const route = render(<LocalizedClaimReviewQueueLoading />);
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
  ["Loading Claim workspace", ClaimWorkspaceLoading, LocalizedClaimLoading],
  ["Loading Claim review", ClaimReviewLoading, LocalizedClaimReviewLoading],
  [
    "Loading Participations",
    PartnershipParticipantsSkeleton,
    LocalizedPartnershipParticipantsLoading,
  ],
  [
    "Loading Participation details",
    ParticipantDetailsSkeleton,
    LocalizedParticipantDetailsLoading,
  ],
  [
    "Loading Participations",
    HostedParticipantsSkeleton,
    LocalizedHostedParticipantsLoading,
  ],
  [
    "Loading Project Partnerships",
    ProjectPartnershipsSkeleton,
    LocalizedPartnerOrganizationsLoading,
  ],
  ["Loading Project workspace", ProjectWorkspaceLoading, LocalizedProjectLoading],
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
  const { container } = render(<ClaimReviewLoading />);
  expect(container.querySelector('[data-variant="claim-band"]')).toBeTruthy();
  expect(container.querySelector('[data-variant="document"]')).toBeTruthy();
  expect(container.querySelector('[data-variant="action"]')).toBeTruthy();
});
