import { ProjectDataPageSkeleton } from "@/components/loading-skeletons";
import { PartnershipParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <PartnershipParticipantsSkeleton />
    </ProjectDataPageSkeleton>
  );
}
