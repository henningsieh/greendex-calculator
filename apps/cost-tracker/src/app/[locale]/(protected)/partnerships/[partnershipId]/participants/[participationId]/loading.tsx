import { ProjectDataPageSkeleton } from "@/components/loading-skeletons";
import { ParticipantDetailsSkeleton } from "@/features/participations/components/loading-skeletons";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <ParticipantDetailsSkeleton />
    </ProjectDataPageSkeleton>
  );
}
