import { getTranslations } from "@greendex/i18n/server";
import { ORPCError } from "@orpc/client";
import { io } from "next/cache";
import { Suspense } from "react";

import type { AppHref } from "@/app/routes";
import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";
import { orpcQuery } from "@/lib/orpc/orpc";
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
      if (
        !(error instanceof ORPCError) ||
        !["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code)
      )
        throw error;
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
          href: `/projects/${encodeURIComponent(id)}` as AppHref,
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
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <HostedParticipantsBreadcrumbContent params={params} />
    </Suspense>
  );
}
