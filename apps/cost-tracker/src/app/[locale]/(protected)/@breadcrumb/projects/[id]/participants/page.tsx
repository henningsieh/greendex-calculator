import { getTranslations } from "@greendex/i18n/server";
import { io } from "next/cache";

import { projectPath } from "@/app/paths";
import { BreadcrumbSlot } from "@/features/breadcrumbs/components/breadcrumb-slot";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
import { getQueryClient } from "@/lib/tanstack-react-query/hydration";

async function HostedParticipantsBreadcrumbContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("shell");
  // Slot content renders inside the protected App Shell; defer the clock reads
  // in TanStack Query and the Better Auth session to request time (#366).
  await io();
  const project = await getQueryClient()
    .query(
      orpcQuery.projects.get.queryOptions({
        input: { projectId: id },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch((error: unknown) => {
      // This slot mounts hidden behind the shell's recovery screens, so a
      // refusal must degrade to the Projects crumb instead of failing the page.
      if (!isPresentationRefusal(error)) throw error;
      return null;
    });
  const kindLabel =
    project?.relationship === "partner"
      ? t("crumbs.partnerProject")
      : t("crumbs.hostedProject");
  return (
    <BreadcrumbTrail
      items={[
        { label: t("nav.projects"), href: "/projects" },
        {
          label: kindLabel,
          href: projectPath(id),
        },
      ]}
      current={t("crumbs.participants")}
    />
  );
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function HostedParticipantsBreadcrumb({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <BreadcrumbSlot>
      <HostedParticipantsBreadcrumbContent params={params} />
    </BreadcrumbSlot>
  );
}
