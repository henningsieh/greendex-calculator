import {
  ClaimReviewSkeleton,
  ProjectDataPageSkeleton,
} from "@/features/projects/components/project-loading-states";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <ClaimReviewSkeleton />
    </ProjectDataPageSkeleton>
  );
}
