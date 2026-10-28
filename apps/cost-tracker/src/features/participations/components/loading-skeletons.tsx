import { getTranslations } from "@greendex/i18n/server";

import { CardSkeleton, LoadingRegion } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export async function PartnershipParticipantsSkeleton() {
  const t = await getTranslations("participations.loading");
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

export async function ParticipantDetailsSkeleton() {
  const t = await getTranslations("participations.loading");
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

export async function HostedParticipantsSkeleton() {
  const t = await getTranslations("participations.loading");
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
