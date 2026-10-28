import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { ProjectListSection } from "@/features/projects/components/project-list-section";
import { ProjectListSkeleton } from "@/features/projects/components/project-loading-states";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Projects" };

type ProjectsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectsPage(
  { searchParams }: ProjectsPageProps = {
    searchParams: Promise.resolve({}),
  },
) {
  await connection();
  if (!(await hasOrganizationMembership())) return null;
  const t = await getTranslations("projects.page");

  return (
    <div>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg/8 text-muted-foreground">{t("description")}</p>
      </header>

      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectListSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
