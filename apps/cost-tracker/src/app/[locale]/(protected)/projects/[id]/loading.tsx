import { LoadingTransition } from "@/components/view-transition-boundaries";
import { ProjectWorkspaceLoading } from "@/features/projects/components/project-workspace-loading";

export default function Loading() {
  return (
    <LoadingTransition>
      <ProjectWorkspaceLoading />
    </LoadingTransition>
  );
}
