import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { LoadingTransition } from "@/components/view-transition-boundaries";
import { ParticipantDetailsSkeleton } from "@/features/participations/components/loading-skeletons";

export default function Loading() {
  return (
    <LoadingTransition>
      <ProjectDataPageLoading>
        <ParticipantDetailsSkeleton />
      </ProjectDataPageLoading>
    </LoadingTransition>
  );
}
