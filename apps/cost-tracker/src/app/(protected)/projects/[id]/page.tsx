import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { ProjectWorkspaceSkeleton } from "@/features/projects/components/project-loading-states";
import { ProjectWorkspaceSection } from "@/features/projects/components/project-workspace-section";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Project workspace" };

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  await connection();
  if (!(await hasOrganizationMembership())) return null;
  const t = await getTranslations("projects.detail");

  return (
    <div>
      <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
      <Suspense fallback={<ProjectWorkspaceSkeleton />}>
        <ProjectWorkspaceSection params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
