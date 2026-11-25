"use client";

import { useTranslations } from "@greendex/i18n/client";

import { LoadingRegion } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { ClaimDocumentLoading } from "@/features/claims/components/claim-document-loading";

export function ClaimReviewLoading() {
  const t = useTranslations("claims.loading");
  return (
    <LoadingRegion label={t("review")}>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-5 w-48" />
        <ClaimDocumentLoading review />
      </div>
    </LoadingRegion>
  );
}
