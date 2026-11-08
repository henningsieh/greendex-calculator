import { getTranslations } from "@greendex/i18n/server";
import { ORPCError } from "@orpc/client";

import ProtectedPageHeader from "@/components/protected-page-header";
import { situationCatalog } from "@/lib/orpc/error-contract";
import { orpcQuery } from "@/lib/orpc/orpc";
import { getQueryClient } from "@/lib/tanstack-react-query/hydration";

export async function ParticipantPageHeader({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId?: string }>;
}) {
  const { partnershipId, participationId } = await params;
  const t = await getTranslations("participations.app");
  const client = getQueryClient();
  let participantName: string | undefined;
  try {
    if (participationId) {
      const data = await client.query(
        orpcQuery.participations.get.queryOptions({
          input: { partnershipId, id: participationId },
          meta: { costTrackerORPC: true },
        }),
      );
      participantName = data?.participation.displayName;
    } else {
      await client.query(
        orpcQuery.participations.listPartnership.queryOptions({
          input: { partnershipId },
          meta: { costTrackerORPC: true },
        }),
      );
    }
  } catch (error) {
    // Presentation refusal, not a data failure: the shell already renders the
    // Organization-selection screen and keeps this header hidden behind it.
    const refusal =
      error instanceof ORPCError &&
      (["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code) ||
        (error.code === situationCatalog.selectOrganization.code &&
          (error.data as { reason?: string } | undefined)?.reason ===
            situationCatalog.selectOrganization.reason));
    if (!refusal) throw error;
  }
  return (
    <ProtectedPageHeader
      eyebrow={t("eyebrow")}
      title={
        participantName ??
        t(participationId ? "participantDetails" : "projectParticipations")
      }
      description={t(
        participationId
          ? "participantDetailsDescription"
          : "coordinateDescription",
      )}
    />
  );
}
