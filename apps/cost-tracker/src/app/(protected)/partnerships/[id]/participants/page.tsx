import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ParticipantCoordination } from "@/features/projects/components/participant-coordination";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { orpcQuery } from "@/lib/orpc/orpc";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Partnership Participants" };

export default async function PartnershipParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;
  const { id } = await params;
  const queryClient = getQueryClient();
  await queryClient
    .query(
      orpcQuery.participations.listPartnership.queryOptions({
        input: { partnershipId: id },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link className={buttonVariants({ variant: "ghost" })} href="/projects">
          Back to Projects
        </Link>
        <h1 className="font-heading text-4xl font-semibold">
          Partnership Participants
        </h1>
        <p className="text-muted-foreground">
          Coordinate Participants for this Project Partnership.
        </p>
      </header>
      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="Partnership Participants">
          <ParticipantCoordination partnershipId={id} />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </div>
  );
}
