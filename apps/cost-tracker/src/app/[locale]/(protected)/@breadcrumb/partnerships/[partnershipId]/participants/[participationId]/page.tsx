import { getTranslations } from "@greendex/i18n/server";
import { io } from "next/cache";

import { partnershipParticipantsPath, projectPath } from "@/app/paths";
import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
import { getQueryClient } from "@/lib/tanstack-react-query/hydration";

/* Exported for the route test: the default export only wires the Suspense boundary. */
export async function ParticipantDetailsBreadcrumbContent({
  params,
}: {
  params: Promise<{ partnershipId: string; participationId: string }>;
}) {
  const { partnershipId } = await params;
  const t = await getTranslations("shell");
  // This slot renders inside the protected App Shell. Reading the Partnership
  // scope runs TanStack Query and the Better Auth session, both of which read
  // the clock; defer the render so those reads happen at request time (#366).
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
                label: t("crumbs.partnerProject"),
                href: projectPath(scope.projectId),
              },
            ]
          : []),
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
