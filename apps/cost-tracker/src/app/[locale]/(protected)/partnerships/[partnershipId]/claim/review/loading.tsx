import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { LoadingTransition } from "@/components/view-transition-boundaries";
import { ClaimReviewLoading } from "@/features/claims/components/claim-review-loading";

export default function Loading() {
  return (
    <LoadingTransition>
      <ProjectDataPageLoading>
        <ClaimReviewLoading />
      </ProjectDataPageLoading>
    </LoadingTransition>
  );
}
