import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ParticipantCoordination } from "@/features/participations/components/participant-coordination";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function PartnershipParticipantsSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Project Participations">
        <ParticipantCoordination partnershipId={id} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
