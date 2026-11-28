"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ComponentProps } from "react";

import { partnershipClaimReviewPath } from "@/app/paths";
import { ButtonLink } from "@/components/button-link";
import { EntityIcon } from "@/components/entity-icon";
import { viewTransitionType } from "@/lib/view-transitions";

/**
 * Navigation into a submitted Claim's review page. Labelled with the
 * destination ("Claim review"), not the action, because it navigates: the
 * decision verbs live on the review page's own buttons. The shared
 * `ButtonLink` supplies the look and the trailing arrow; this module only adds
 * the Claim entity icon, the label, and the destination, so the queue, the
 * queue's card footer, and the Hosted Project workspace stay identical.
 */
export function ClaimReviewLink({
  className,
  density = "default",
  describedBy,
  partnershipId,
  testId,
}: {
  className?: string;
  density?: ComponentProps<typeof ButtonLink>["density"];
  describedBy?: string;
  partnershipId: string;
  testId?: string;
}) {
  const t = useTranslations("claims.link");

  return (
    <ButtonLink
      className={className}
      density={density}
      describedBy={describedBy}
      href={partnershipClaimReviewPath(partnershipId)}
      icon={<EntityIcon className="size-3.5 shrink-0" entity="claim" />}
      testId={testId}
      transitionTypes={[viewTransitionType.forward]}
    >
      {t("claimReview")}
    </ButtonLink>
  );
}
