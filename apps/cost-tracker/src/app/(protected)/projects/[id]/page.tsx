import type { Metadata } from "next";
import { Suspense } from "react";

import { PrefetchedSectionSkeleton } from "@/components/prefetched-page-skeleton";
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
  if (!(await hasOrganizationMembership())) return null;

  return (
    <div>
      <p className="text-sm font-medium text-primary">Project workspace</p>
      <Suspense
        fallback={<PrefetchedSectionSkeleton label="Loading Project workspace" />}
      >
        <ProjectWorkspaceSection params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
