import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

async function PartnerOrganizationsBreadcrumbContent() {
  const t = await getTranslations("shell");
  return <BreadcrumbTrail items={[]} current={t("nav.partnerOrganizations")} />;
}

export default function PartnerOrganizationsBreadcrumb() {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <PartnerOrganizationsBreadcrumbContent />
    </Suspense>
  );
}
