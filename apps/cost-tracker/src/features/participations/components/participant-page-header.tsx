import { getTranslations } from "@greendex/i18n/server";

import ProtectedPageHeader from "@/components/protected-page-header";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
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
    // Presentation refusal, not a data failure: the shell already renders its
    // recovery screen and keeps this header hidden behind it.
    if (!isPresentationRefusal(error)) throw error;
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
