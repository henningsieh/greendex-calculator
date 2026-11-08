import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

async function OrganizationBreadcrumbContent() {
  const t = await getTranslations("shell");
  return <BreadcrumbTrail items={[]} current={t("nav.organization")} />;
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function OrganizationBreadcrumb() {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <OrganizationBreadcrumbContent />
    </Suspense>
  );
}
