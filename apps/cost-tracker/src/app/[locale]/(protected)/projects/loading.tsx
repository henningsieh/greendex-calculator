import { LoadingTransition } from "@/components/view-transition-boundaries";
import { ProjectsPageLoading } from "@/features/projects/components/projects-page-loading";

export default function Loading() {
  return (
    <LoadingTransition>
      <ProjectsPageLoading />
    </LoadingTransition>
  );
}
