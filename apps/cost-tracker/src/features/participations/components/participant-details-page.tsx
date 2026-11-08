import { getTranslations } from "@greendex/i18n/server";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ParticipantDetailsSkeleton } from "@/features/participations/components/loading-skeletons";
import { ParticipantDetailsSection } from "@/features/participations/components/participant-details-section";
import { ParticipantPageHeader } from "@/features/participations/components/participant-page-header";

export default async function ParticipantDetailsPage({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId: string }>;
}) {
  await connection();
  const t = await getTranslations("participations.app");

  return (
    <div className="space-y-8">
      <Suspense
        fallback={
          <ProtectedPageHeader
            eyebrow={t("eyebrow")}
            title={t("participantDetails")}
            description={t("participantDetailsDescription")}
          />
        }
      >
        <ParticipantPageHeader params={params} />
      </Suspense>
      <Suspense fallback={<ParticipantDetailsSkeleton />}>
        <ParticipantDetailsSection params={params} />
      </Suspense>
    </div>
  );
}
