import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import type { AppHref } from "@/app/routes";
import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

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
          href: `/partnerships/${encodeURIComponent(partnershipId)}` as AppHref,
        },
        {
          label: t("crumbs.participants"),
          href: `/partnerships/${encodeURIComponent(partnershipId)}/participants` as AppHref,
        },
      ]}
      current={t("crumbs.participantDetails")}
    />
  );
}

export default function ParticipantDetailsBreadcrumb({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId: string }>;
}) {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <ParticipantDetailsBreadcrumbContent params={params} />
    </Suspense>
  );
}
