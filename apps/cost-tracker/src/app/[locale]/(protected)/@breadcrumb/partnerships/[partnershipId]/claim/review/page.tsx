import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import type { AppHref } from "@/app/routes";
import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";

async function ClaimReviewBreadcrumbContent({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const t = await getTranslations("shell");
  return (
    <BreadcrumbTrail
      items={[
        { label: t("crumbs.claimReviews"), href: "/claims/review" },
        {
          label: t("crumbs.partnership"),
          href: `/partnerships/${encodeURIComponent(partnershipId)}` as AppHref,
        },
      ]}
      current={t("crumbs.claimReview")}
    />
  );
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function ClaimReviewBreadcrumb({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <ClaimReviewBreadcrumbContent params={params} />
    </Suspense>
  );
}
