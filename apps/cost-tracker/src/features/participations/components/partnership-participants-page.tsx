import { getTranslations } from "@greendex/i18n/server";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import {
  RouteTransition,
  SuspenseFallback,
  SuspenseReveal,
} from "@/components/view-transition-boundaries";
import { PartnershipParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";
import { ParticipantPageHeader } from "@/features/participations/components/participant-page-header";
import { PartnershipParticipantsSection } from "@/features/participations/components/partnership-participants-section";
import { hasOrganizationMembership } from "@/lib/session";

export default async function PartnershipParticipantsPage({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  await connection();
  if (!(await hasOrganizationMembership())) return null;

  const t = await getTranslations("participations.app");

  return (
    <RouteTransition>
      <div className="space-y-8">
        <Suspense
          fallback={
            <ProtectedPageHeader
              eyebrow={t("eyebrow")}
              title={t("projectParticipations")}
              description={t("coordinateDescription")}
            />
          }
        >
          <ParticipantPageHeader params={params} />
        </Suspense>
        <Suspense
          fallback={
            <SuspenseFallback>
              <PartnershipParticipantsSkeleton />
            </SuspenseFallback>
          }
        >
          <SuspenseReveal>
            <PartnershipParticipantsSection params={params} />
          </SuspenseReveal>
        </Suspense>
      </div>
    </RouteTransition>
  );
}
