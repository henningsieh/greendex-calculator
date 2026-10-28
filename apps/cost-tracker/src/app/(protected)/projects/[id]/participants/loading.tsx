import { ProjectDataPageSkeleton } from "@/components/loading-skeletons";
import { HostedParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <HostedParticipantsSkeleton />
    </ProjectDataPageSkeleton>
  );
}
