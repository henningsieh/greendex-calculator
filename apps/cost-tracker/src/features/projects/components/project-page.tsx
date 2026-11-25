import { connection } from "next/server";
import { Suspense } from "react";

import { RouteTransition } from "@/components/view-transition-boundaries";
import { ProjectWorkspaceLoading } from "@/features/projects/components/project-workspace-loading";
import { ProjectWorkspaceSection } from "@/features/projects/components/project-workspace-section";
import { hasOrganizationMembership } from "@/lib/session";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  await connection();
  if (!(await hasOrganizationMembership())) return null;

  return (
    <RouteTransition>
      <div>
        <Suspense fallback={<ProjectWorkspaceLoading />}>
          <ProjectWorkspaceSection params={params} />
        </Suspense>
      </div>
    </RouteTransition>
  );
}
