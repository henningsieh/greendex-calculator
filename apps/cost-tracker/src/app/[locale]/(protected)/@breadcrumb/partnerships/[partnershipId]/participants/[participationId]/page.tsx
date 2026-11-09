import { getTranslations } from "@greendex/i18n/server";

import { partnershipPath, partnershipParticipantsPath } from "@/app/paths";
import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";

async function ParticipantDetailsBreadcrumbContent({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId: string }>;
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
        {
          label: t("crumbs.participants"),
          href: partnershipParticipantsPath(partnershipId),
        },
      ]}
      current={t("crumbs.participantDetails")}
    />
  );
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function ParticipantDetailsBreadcrumb({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId: string }>;
}) {
  return (
    <BreadcrumbSlot>
      <ParticipantDetailsBreadcrumbContent params={params} />
    </BreadcrumbSlot>
  );
}
