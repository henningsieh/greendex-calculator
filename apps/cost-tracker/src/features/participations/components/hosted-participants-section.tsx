import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { HostedParticipantReport } from "@/features/participations/components/hosted-participant-report";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function HostedParticipantsSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();
  await queryClient
    .query(
      orpcQuery.participations.listHostedReport.queryOptions({
        input: { projectId: id },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="the Hosting Participant view">
        <HostedParticipantReport projectId={id} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
