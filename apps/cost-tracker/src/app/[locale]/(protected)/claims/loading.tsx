import { LoadingTransition } from "@/components/view-transition-boundaries";
import { ClaimReviewQueuePageLoading } from "@/features/claims/components/claim-review-queue-page-loading";

export default function Loading() {
  return (
    <LoadingTransition>
      <ClaimReviewQueuePageLoading />
    </LoadingTransition>
  );
}
