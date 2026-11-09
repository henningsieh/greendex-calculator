import { getTranslations } from "@greendex/i18n/server";

import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";

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
    <BreadcrumbSlot>
      <PartnershipBreadcrumbContent />
    </BreadcrumbSlot>
  );
}
