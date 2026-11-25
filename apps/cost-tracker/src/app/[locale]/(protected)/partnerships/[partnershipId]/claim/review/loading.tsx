import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { ClaimReviewLoading } from "@/features/claims/components/claim-review-loading";

export default function Loading() {
  return (
    <ProjectDataPageLoading>
      <ClaimReviewLoading />
    </ProjectDataPageLoading>
  );
}
