import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { LoadingTransition } from "@/components/view-transition-boundaries";
import { HostedParticipantsSkeleton } from "@/features/participations/components/loading-skeletons";

export default function Loading() {
  return (
    <LoadingTransition>
      <ProjectDataPageLoading>
        <HostedParticipantsSkeleton />
      </ProjectDataPageLoading>
    </LoadingTransition>
  );
}
