import { getTranslations } from "@greendex/i18n/server";
import type { Route } from "next";
import { Suspense } from "react";

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
          href: `/partnerships/${encodeURIComponent(partnershipId)}` as Route,
        },
        {
          label: t("crumbs.participants"),
          href: `/partnerships/${encodeURIComponent(partnershipId)}/participants` as Route,
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
