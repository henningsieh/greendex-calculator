"use client";

import { useTranslations } from "@greendex/i18n/client";

import { CardSkeleton, LoadingRegion } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export function PartnershipParticipantsSkeleton() {
  const t = useTranslations("participations.loading");
  return (
    <LoadingRegion label={t("projectParticipations")}>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-5 w-64 max-w-full" />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={1} />
        <CardSkeleton rows={2} />
        <CardSkeleton rows={2} />
      </div>
    </LoadingRegion>
  );
}

export function ParticipantDetailsSkeleton() {
  const t = useTranslations("participations.loading");
  return (
    <LoadingRegion label={t("details")}>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-64 max-w-full" />
        <CardSkeleton rows={2} />
        <CardSkeleton rows={1} />
      </div>
    </LoadingRegion>
  );
}

export function HostedParticipantsSkeleton() {
  const t = useTranslations("participations.loading");
  return (
    <LoadingRegion label={t("report")}>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-full" />
        <CardSkeleton rows={1} />
        <CardSkeleton rows={1} />
      </div>
    </LoadingRegion>
  );
}
