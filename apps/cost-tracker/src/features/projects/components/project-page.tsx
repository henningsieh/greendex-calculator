import { RouteTransition } from "@/components/view-transition-boundaries";
import { ProjectWorkspaceSection } from "@/features/projects/components/project-workspace-section";
import { hasOrganizationMembership } from "@/lib/session";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  if (!(await hasOrganizationMembership())) return null;

  return (
    <RouteTransition>
      <div>
        <ProjectWorkspaceSection params={params} />
      </div>
    </RouteTransition>
  );
}
