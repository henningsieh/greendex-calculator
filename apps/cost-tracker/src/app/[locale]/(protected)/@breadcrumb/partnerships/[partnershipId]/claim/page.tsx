import { getTranslations } from "@greendex/i18n/server";
import type { Route } from "next";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

async function ClaimWorkspaceBreadcrumbContent({
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
          href: `/partnerships/${encodeURIComponent(partnershipId)}` as Route,
        },
      ]}
      current={t("crumbs.claimWorkspace")}
    />
  );
}

export default function ClaimWorkspaceBreadcrumb({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <ClaimWorkspaceBreadcrumbContent params={params} />
    </Suspense>
  );
}
