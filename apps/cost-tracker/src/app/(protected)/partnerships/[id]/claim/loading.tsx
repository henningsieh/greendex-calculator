import {
  ClaimWorkspaceSkeleton,
  ProjectDataPageSkeleton,
} from "@/features/projects/components/project-loading-states";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <ClaimWorkspaceSkeleton />
    </ProjectDataPageSkeleton>
  );
}
