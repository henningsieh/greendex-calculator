"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  CardLoading,
  ProtectedPageHeaderLoading,
  LoadingRegion,
} from "@/components/loading-skeletons";

export function OrganizationPageSkeleton() {
  const t = useTranslations("organizations.loading");
  return (
    <LoadingRegion label={t("label")}>
      <div className="flex flex-col gap-8">
        <ProtectedPageHeaderLoading />
        <CardLoading rows={2} />
        <CardLoading />
      </div>
    </LoadingRegion>
  );
}
