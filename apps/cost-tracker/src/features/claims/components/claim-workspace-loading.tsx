"use client";

import { useTranslations } from "@greendex/i18n/client";

import { LoadingRegion } from "@/components/loading-skeletons";
import { ClaimDocumentLoading } from "@/features/claims/components/claim-document-loading";

export function ClaimWorkspaceLoading() {
  const t = useTranslations("claims.loading");
  return (
    <LoadingRegion label={t("workspace")}>
      <ClaimDocumentLoading />
    </LoadingRegion>
  );
}
