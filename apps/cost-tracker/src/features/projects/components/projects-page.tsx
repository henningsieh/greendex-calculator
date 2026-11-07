import { getTranslations } from "@greendex/i18n/server";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import { ProjectListSection } from "@/features/projects/components/project-list-section";
import { ProjectListSkeleton } from "@/features/projects/components/project-loading-states";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";

type ProjectsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectsPage(
  { searchParams }: ProjectsPageProps = {
    searchParams: Promise.resolve({}),
  },
) {
  await connection();
  const t = await getTranslations("projects.page");
  const canCreate = await hasCostTrackerPermissions(await headers(), {
    project: ["create"],
  });

  return (
    <div>
      <ProtectedPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        rightButton={canCreate ? <CreateProjectDialog /> : undefined}
      />

      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectListSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
