import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { ParticipantDetailsSkeleton } from "@/features/participations/components/loading-skeletons";

export default function Loading() {
  return (
    <ProjectDataPageLoading>
      <ParticipantDetailsSkeleton />
    </ProjectDataPageLoading>
  );
}
