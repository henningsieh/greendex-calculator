import { getTranslations } from "@greendex/i18n/server";
import { io } from "next/cache";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
import { getQueryClient } from "@/lib/tanstack-react-query/hydration";

async function projectKindLabel(projectId: string) {
  const t = await getTranslations("shell");
  // This slot renders inside the protected App Shell. Reading the Project runs
  // TanStack Query and the Better Auth session, both of which read the clock;
  // defer the render so those reads happen at request time (#366).
  await io();
  const project = await getQueryClient()
    .query(
      orpcQuery.projects.get.queryOptions({
        input: { projectId },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch((error: unknown) => {
      if (!isPresentationRefusal(error)) throw error;
      return null;
    });
  return project?.relationship === "partner"
    ? t("crumbs.partnerProject")
    : t("crumbs.hostedProject");
}

/* Exported for the route test: the default export only wires the Suspense boundary. */
export async function ProjectDetailsBreadcrumbContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("shell");
  return (
    <BreadcrumbTrail
      items={[
        {
          label: t("nav.projects"),
          href: "/projects",
          testId: "back-to-projects",
        },
      ]}
      current={await projectKindLabel(id)}
    />
  );
}

// Request-time chrome: the breadcrumb resolves at request time.
export const instant = false;

export default function ProjectDetailsBreadcrumb({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <ProjectDetailsBreadcrumbContent params={params} />
    </Suspense>
  );
}
