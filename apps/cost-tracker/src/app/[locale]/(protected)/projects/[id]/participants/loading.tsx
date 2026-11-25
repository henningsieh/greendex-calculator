import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { HostedParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";

export default function Loading() {
  return (
    <ProjectDataPageLoading>
      <HostedParticipantsSkeleton />
    </ProjectDataPageLoading>
  );
}
