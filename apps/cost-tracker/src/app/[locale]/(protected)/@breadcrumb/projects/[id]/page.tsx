import { getTranslations } from "@greendex/i18n/server";
import { ORPCError } from "@orpc/client";
import { io } from "next/cache";
import { Suspense } from "react";

import BreadcrumbTrail, {
  BreadcrumbTrailFallback,
} from "@/components/breadcrumb-trail";
import { getProjectListReturnDestination } from "@/features/projects/list-query-options";
import { orpcQuery } from "@/lib/orpc/orpc";
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
      if (
        !(error instanceof ORPCError) ||
        !["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code)
      )
        throw error;
      return null;
    });
  return project?.relationship === "partner"
    ? t("crumbs.partnerProject")
    : t("crumbs.hostedProject");
}

/* Exported for the route test: the default export only wires the Suspense boundary. */
export async function ProjectDetailsBreadcrumbContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, rawSearchParams] = await Promise.all([
    params,
    searchParams ??
      Promise.resolve<Record<string, string | string[] | undefined>>({}),
  ]);
  const t = await getTranslations("shell");
  return (
    <BreadcrumbTrail
      items={[
        {
          label: t("nav.projects"),
          href: getProjectListReturnDestination(rawSearchParams.returnTo),
          testId: "back-to-projects",
        },
      ]}
      current={await projectKindLabel(id)}
    />
  );
}

export default function ProjectDetailsBreadcrumb({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<BreadcrumbTrailFallback />}>
      <ProjectDetailsBreadcrumbContent
        params={params}
        searchParams={searchParams}
      />
    </Suspense>
  );
}
