import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

async function PartnershipBreadcrumbContent() {
  const t = await getTranslations("shell");
  return (
    <BreadcrumbTrail
      items={[{ label: t("nav.projects"), href: "/projects" }]}
      current={t("crumbs.partnership")}
    />
  );
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function PartnershipBreadcrumb() {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <PartnershipBreadcrumbContent />
    </Suspense>
  );
}
