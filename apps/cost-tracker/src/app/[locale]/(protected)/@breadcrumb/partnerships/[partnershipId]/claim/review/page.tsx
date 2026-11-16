import { getTranslations } from "@greendex/i18n/server";
import { io } from "next/cache";

import { projectPath } from "@/app/paths";
import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
import { getQueryClient } from "@/lib/tanstack-react-query/hydration";

/* Exported for the route test: the default export only wires the Suspense boundary. */
export async function ClaimReviewBreadcrumbContent({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const t = await getTranslations("shell");
  // Only the Hosting Organization may review, so this crumb walks the Hosted
  // Project the Project workspace links here from — never the Partnership.
  // Reading the scope runs TanStack Query and the Better Auth session, both of
  // which read the clock; defer the render so those reads happen per request.
  await io();
  const scope = await getQueryClient()
    .query(
      orpcQuery.projectPartnerships.getScope.queryOptions({
        input: { partnershipId },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch((error: unknown) => {
      // This slot mounts hidden behind the shell's recovery screens, so a
      // refusal must degrade to the Projects crumb instead of failing the page.
      if (!isPresentationRefusal(error)) throw error;
      return null;
    });
  return (
    <BreadcrumbTrail
      items={[
        { label: t("nav.projects"), href: "/projects" },
        ...(scope
          ? [
              {
                label: t("crumbs.hostedProject"),
                href: projectPath(scope.projectId),
              },
            ]
          : []),
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
