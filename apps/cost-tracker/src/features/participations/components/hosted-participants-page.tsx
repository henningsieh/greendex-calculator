import { getTranslations } from "@greendex/i18n/server";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { HostedParticipantsSection } from "@/features/participations/components/hosted-participants-section";
import { HostedParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";
import { hasOrganizationMembership } from "@/lib/session";

export default async function HostedParticipantsPage({
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
        eyebrow={t("eyebrow")}
        title={t("reportTitle")}
        description={t("reportDescription")}
      />
      <Suspense fallback={<HostedParticipantsSkeleton />}>
        <HostedParticipantsSection params={params} />
      </Suspense>
    </div>
  );
}
