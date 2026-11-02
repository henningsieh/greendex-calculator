import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ParticipantDetailsSkeleton } from "@/features/participations/components/loading-skeletons";
import { ParticipantDetailsSection } from "@/features/participations/components/participant-details-section";

export const metadata: Metadata = { title: "Participant details" };

export default async function ParticipantDetailsPage({
  params,
}: {
  params: Promise<{ id: string; participationId: string }>;
}) {
  await connection();
  const t = await getTranslations("participations.app");

  return (
    <div className="space-y-8">
      <ProtectedPageHeader
        title={t("participantDetails")}
        description={t("participantDetailsDescription")}
      />
      <Suspense fallback={<ParticipantDetailsSkeleton />}>
        <ParticipantDetailsSection params={params} />
      </Suspense>
    </div>
  );
}
