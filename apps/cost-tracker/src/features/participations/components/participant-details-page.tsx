import { getTranslations } from "@greendex/i18n/server";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ParticipantDetailsSkeleton } from "@/features/participations/components/loading-skeletons";
import { ParticipantDetailsSection } from "@/features/participations/components/participant-details-section";
import { ParticipantPageHeader } from "@/features/participations/components/participant-page-header";
import { hasOrganizationMembership } from "@/lib/session";

export default async function ParticipantDetailsPage({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId: string }>;
}) {
  await connection();
  if (!(await hasOrganizationMembership())) return null;
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
