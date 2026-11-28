import { getTranslations } from "@greendex/i18n/server";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
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
  const data = await queryClient
    .query(
      orpcQuery.participations.listHostedReport.queryOptions({
        input: { projectId: id },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  const t = await getTranslations("participations.app");

  return (
    <>
      <ProtectedRouteHeader
        page="participants"
        context={
          data ? { projectId: data.projectId, relationship: "hosted" } : undefined
        }
        description={t("reportDescription")}
      />
      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="the Hosting Participant view">
          <HostedParticipantReport projectId={id} />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </>
  );
}
