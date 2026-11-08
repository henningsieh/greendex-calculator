import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ParticipantDetails } from "@/features/participations/components/participant-details";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function ParticipantDetailsSection({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId: string }>;
}) {
  const { partnershipId, participationId } = await params;
  const queryClient = getQueryClient();
  await queryClient
    .query(
      orpcQuery.participations.get.queryOptions({
        input: { partnershipId, id: participationId },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Participant details">
        <ParticipantDetails
          partnershipId={partnershipId}
          participationId={participationId}
        />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
