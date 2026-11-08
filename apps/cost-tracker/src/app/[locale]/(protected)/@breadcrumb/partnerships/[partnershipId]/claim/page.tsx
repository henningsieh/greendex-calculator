import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import type { AppHref } from "@/app/routes";
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
          href: `/partnerships/${encodeURIComponent(partnershipId)}` as AppHref,
        },
      ]}
      current={t("crumbs.claimWorkspace")}
    />
  );
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

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
