import { Suspense } from "react";

import { RouteTransition } from "@/components/view-transition-boundaries";
import { HostedParticipantsSection } from "@/features/participations/components/hosted-participants-section";
import { HostedParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";
import { hasOrganizationMembership } from "@/lib/session";

export default async function HostedParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  return (
    <RouteTransition>
      <div className="space-y-8">
        <Suspense fallback={<HostedParticipantsSkeleton />}>
          <HostedParticipantsSection params={params} />
        </Suspense>
      </div>
    </RouteTransition>
  );
}
