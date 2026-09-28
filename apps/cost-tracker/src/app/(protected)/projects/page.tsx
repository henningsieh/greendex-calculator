import type { Metadata } from "next";
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
  if (!(await hasOrganizationMembership())) return null;

  return (
    <div>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Project workspace</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Projects
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Review Projects hosted by or assigned to your active Organization.
        </p>
      </header>

      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectListSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
