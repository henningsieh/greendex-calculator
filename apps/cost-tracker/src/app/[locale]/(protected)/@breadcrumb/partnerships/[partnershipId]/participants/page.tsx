import { getTranslations } from "@greendex/i18n/server";

import { partnershipPath } from "@/app/paths";
import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";

async function PartnershipParticipantsBreadcrumbContent({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const t = await getTranslations("shell");
  return (
    <BreadcrumbTrail
      items={[
        { label: t("nav.projects"), href: "/projects" },
        {
          label: t("crumbs.partnership"),
          href: partnershipPath(partnershipId),
        },
      ]}
      current={t("crumbs.participants")}
    />
  );
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function PartnershipParticipantsBreadcrumb({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  return (
    <BreadcrumbSlot>
      <PartnershipParticipantsBreadcrumbContent params={params} />
    </BreadcrumbSlot>
  );
}
