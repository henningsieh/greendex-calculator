"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  CardSkeleton,
  HeaderSkeleton,
  LoadingRegion,
} from "@/components/loading-skeletons";

export function OrganizationPageSkeleton() {
  const t = useTranslations("organizations.loading");
  return (
    <LoadingRegion label={t("label")}>
      <div className="flex flex-col gap-8">
        <HeaderSkeleton />
        <CardSkeleton rows={2} />
        <CardSkeleton />
      </div>
    </LoadingRegion>
  );
}
