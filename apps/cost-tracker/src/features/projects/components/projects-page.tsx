import { getTranslations } from "@greendex/i18n/server";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";

import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import { ProjectListSection } from "@/features/projects/components/project-list-section";
import { ProjectListSkeleton } from "@/features/projects/components/project-loading-states";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
import { hasOrganizationMembership } from "@/lib/session";

interface ProjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectsPage(
  { searchParams }: ProjectsPageProps = {
    searchParams: Promise.resolve({}),
  },
) {
  await connection();
  // Recovery has no Organization context yet; do not prefetch scoped data.
  if (!(await hasOrganizationMembership())) return null;
  const t = await getTranslations("projects.page");
  // A refusal is the shell's recovery screens talking, not a broken page.
  const canCreate = await hasCostTrackerPermissions(await headers(), {
    project: ["create"],
  }).catch((error: unknown) => {
    if (isPresentationRefusal(error)) return false;
    throw error;
  });

  return (
    <div className="min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        {canCreate && <CreateProjectDialog />}
      </header>

      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectListSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
