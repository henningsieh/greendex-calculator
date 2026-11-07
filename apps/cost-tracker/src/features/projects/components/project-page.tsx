import { connection } from "next/server";
import { Suspense } from "react";

import { ProjectWorkspaceSkeleton } from "@/features/projects/components/project-loading-states";
import { ProjectWorkspaceSection } from "@/features/projects/components/project-workspace-section";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  await connection();

  return (
    <div>
      <Suspense fallback={<ProjectWorkspaceSkeleton />}>
        <ProjectWorkspaceSection params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
