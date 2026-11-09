import { getTranslations } from "@greendex/i18n/server";

import { partnershipPath } from "@/app/paths";
import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";

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
          href: partnershipPath(partnershipId),
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
    <BreadcrumbSlot>
      <ClaimReviewBreadcrumbContent params={params} />
    </BreadcrumbSlot>
  );
}
