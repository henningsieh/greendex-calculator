import { getTranslations } from "@greendex/i18n/server";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { partnershipNavigation } from "@/features/breadcrumbs/partnership-navigation";
import { ParticipantCoordination } from "@/features/participations/components/participant-coordination";
import { orpcQuery } from "@/lib/orpc/orpc";
import { getSession } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function PartnershipParticipantsSection({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const queryClient = getQueryClient();
  const data = await queryClient
    .query(
      orpcQuery.participations.listPartnership.queryOptions({
        input: { partnershipId },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  const t = getTranslations("participations.app");
  const [description, session] = await Promise.all([
    t.then((t) => t("coordinateDescription")),
    getSession(),
  ]);

  return (
    <>
      <ProtectedRouteHeader
        page="participations"
        context={
          data
            ? partnershipNavigation(
                data.projectId,
                partnershipId,
                data.entryContext,
                session?.session.activeOrganizationId,
              )
            : undefined
        }
        description={description}
      />
      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="Project Participations">
          <ParticipantCoordination partnershipId={partnershipId} />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </>
  );
}
