import { getTranslations } from "@greendex/i18n/server";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { partnershipNavigation } from "@/features/breadcrumbs/partnership-navigation";
import { ParticipantDetails } from "@/features/participations/components/participant-details";
import { orpcQuery } from "@/lib/orpc/orpc";
import { getSession } from "@/lib/session";
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
  const data = await queryClient
    .query(
      orpcQuery.participations.get.queryOptions({
        input: { partnershipId, id: participationId },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  const t = getTranslations("participations.app");
  const [description, session] = await Promise.all([
    t.then((t) => t("participantDetailsDescription")),
    getSession(),
  ]);

  return (
    <>
      <ProtectedRouteHeader
        page="participation"
        context={
          data
            ? partnershipNavigation(
                data.projectId,
                partnershipId,
                data.correctionContext,
                session?.session.activeOrganizationId,
              )
            : undefined
        }
        description={description}
        title={data?.participation.displayName}
      />
      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="Participant details">
          <ParticipantDetails
            partnershipId={partnershipId}
            participationId={participationId}
          />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </>
  );
}
