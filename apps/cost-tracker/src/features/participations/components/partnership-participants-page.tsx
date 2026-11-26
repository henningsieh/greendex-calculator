import { Suspense } from "react";

import { RouteTransition } from "@/components/view-transition-boundaries";
import { PartnershipParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";
import { ParticipantPageHeader } from "@/features/participations/components/participant-page-header";
import { PartnershipParticipantsSection } from "@/features/participations/components/partnership-participants-section";
import { hasOrganizationMembership } from "@/lib/session";

export default async function PartnershipParticipantsPage({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  return (
    <RouteTransition>
      <div className="space-y-8">
        {await ParticipantPageHeader({ params })}
        <Suspense fallback={<PartnershipParticipantsSkeleton />}>
          <PartnershipParticipantsSection params={params} />
        </Suspense>
      </div>
    </RouteTransition>
  );
}
