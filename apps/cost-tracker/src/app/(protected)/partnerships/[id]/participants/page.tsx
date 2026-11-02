import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { PartnershipParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";
import { PartnershipParticipantsSection } from "@/features/participations/components/partnership-participants-section";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Project Participations" };

export default async function PartnershipParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  if (!(await hasOrganizationMembership())) return null;
  const t = await getTranslations("participations.app");

  return (
    <div className="space-y-8">
      <ProtectedPageHeader
        title={t("projectParticipations")}
        description={t("coordinateDescription")}
      />
      <Suspense fallback={<PartnershipParticipantsSkeleton />}>
        <PartnershipParticipantsSection params={params} />
      </Suspense>
    </div>
  );
}
