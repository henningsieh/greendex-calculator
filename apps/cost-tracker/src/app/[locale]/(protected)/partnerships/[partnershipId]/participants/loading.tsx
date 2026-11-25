import { LoadingTransition } from "@/components/view-transition-boundaries";
import { PartnershipParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";

export default function Loading() {
  return (
    <LoadingTransition>
      <PartnershipParticipantsSkeleton />
    </LoadingTransition>
  );
}
