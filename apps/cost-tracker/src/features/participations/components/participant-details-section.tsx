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
  params: Promise<{ id: string; participationId: string }>;
}) {
  const { id, participationId } = await params;
  const queryClient = getQueryClient();
  await queryClient
    .query(
      orpcQuery.participations.get.queryOptions({
        input: { partnershipId: id, id: participationId },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Participant details">
        <ParticipantDetails
          partnershipId={id}
          participationId={participationId}
        />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
