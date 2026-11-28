import { Suspense } from "react";

import { RouteTransition } from "@/components/view-transition-boundaries";
import { ParticipantDetailsSkeleton } from "@/features/participations/components/loading-skeletons";
import { ParticipantDetailsSection } from "@/features/participations/components/participant-details-section";
import { ParticipantPageHeader } from "@/features/participations/components/participant-page-header";
import { hasOrganizationMembership } from "@/lib/session";

export default async function ParticipantDetailsPage({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  return (
    <RouteTransition>
      <div className="space-y-8">
        {await ParticipantPageHeader({ params })}
        <Suspense fallback={<ParticipantDetailsSkeleton />}>
          <ParticipantDetailsSection params={params} />
        </Suspense>
      </div>
    </RouteTransition>
  );
}
