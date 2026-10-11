import { ParticipantDetails } from "@/features/projects/components/participant-details";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
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
