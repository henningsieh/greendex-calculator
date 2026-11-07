import { ProjectDataPageSkeleton } from "@/components/loading-skeletons";
import { ClaimReviewSkeleton } from "@/features/claims/components/claim-loading-states";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <ClaimReviewSkeleton />
    </ProjectDataPageSkeleton>
  );
}
