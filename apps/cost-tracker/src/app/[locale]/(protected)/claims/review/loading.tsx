import { ProjectDataPageSkeleton } from "@/components/loading-skeletons";
import { ClaimReviewQueueSkeleton } from "@/features/claims/components/claim-loading-states";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <ClaimReviewQueueSkeleton />
    </ProjectDataPageSkeleton>
  );
}
