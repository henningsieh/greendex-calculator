import { getTranslations } from "@greendex/i18n/server";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { HostedParticipantReport } from "@/features/participations/components/hosted-participant-report";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
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
  const projectId = await queryClient
    .query(
      orpcQuery.participations.listHostedReport.queryOptions({
        input: { projectId: id },
        meta: { costTrackerORPC: true },
      }),
    )
    .then((report) => report.projectId)
    .catch(async (error: unknown) => {
      swallowPrefetchError(error);
      if (isPresentationRefusal(error)) return undefined;

      // A report failure need not hide navigation to a confirmed Hosted Project.
      const project = await queryClient
        .query(
          orpcQuery.projects.get.queryOptions({
            input: { projectId: id },
            meta: { costTrackerORPC: true },
          }),
        )
        .catch(swallowPrefetchError);

      return project?.relationship === "hosted" ? project.id : undefined;
    });

  const t = await getTranslations("participations.app");

  return (
    <>
      <ProtectedRouteHeader
        page="participants"
        context={projectId ? { projectId, relationship: "hosted" } : undefined}
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
