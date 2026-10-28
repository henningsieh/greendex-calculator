"use client";

import { useTranslations } from "@greendex/i18n/client";

import { CardSkeleton, LoadingRegion } from "@/components/loading-skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClaimWorkspaceSkeleton() {
  const t = useTranslations("claims.loading");
  return (
    <LoadingRegion label={t("workspace")}>
      <ClaimDocumentSkeleton review={false} />
    </LoadingRegion>
  );
}

export function ClaimReviewSkeleton() {
  const t = useTranslations("claims.loading");
  return (
    <LoadingRegion label={t("review")}>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-5 w-48" />
        <ClaimDocumentSkeleton review />
      </div>
    </LoadingRegion>
  );
}

function ClaimDocumentSkeleton({ review }: { review: boolean }) {
  return (
    <div className="min-w-0">
      <Card variant="claim-band">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-6 w-28" />
      </Card>
      <div className="min-w-0 border border-t-0 bg-card">
        <div className="grid min-w-0 min-[961px]:grid-cols-[minmax(0,1fr)_340px]">
          <aside className="min-w-0 border-b bg-muted min-[961px]:col-start-2 min-[961px]:row-start-1 min-[961px]:border-b-0 min-[961px]:border-l">
            <CardSkeleton variant="action" rows={4} />
          </aside>
          <div className="min-w-0 min-[961px]:col-start-1 min-[961px]:row-start-1">
            <CardSkeleton variant="document" rows={4} />
            {!review && <CardSkeleton variant="document" />}
            <CardSkeleton variant="document" />
            <CardSkeleton variant="document" rows={2} />
          </div>
        </div>
        <div className="flex flex-col gap-4 px-8 py-7 max-sm:px-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ClaimReviewQueueSkeleton() {
  const t = useTranslations("claims.loading");
  return (
    <LoadingRegion label={t("submitted")}>
      <CardSkeleton />
    </LoadingRegion>
  );
}
