"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  LoadingRegion,
  ProtectedPageHeaderLoading,
} from "@/components/loading-skeletons";
import { ClaimReviewQueueLoadingContent } from "@/features/claims/components/claim-review-queue-loading";

/**
 * Route fallback for `claims/loading.tsx`: the header sketch and the queue
 * section, exactly as the page shell renders them.
 */
export function ClaimReviewQueuePageLoading() {
  const t = useTranslations("claims.loading");
  return (
    <LoadingRegion label={t("submitted")}>
      <ProtectedPageHeaderLoading />
      <ClaimReviewQueueLoadingContent />
    </LoadingRegion>
  );
}
