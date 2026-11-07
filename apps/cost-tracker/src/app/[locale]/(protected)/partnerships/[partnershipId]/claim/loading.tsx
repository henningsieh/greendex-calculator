import { ProjectDataPageSkeleton } from "@/components/loading-skeletons";
import { ClaimWorkspaceSkeleton } from "@/features/claims/components/claim-loading-states";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <ClaimWorkspaceSkeleton />
    </ProjectDataPageSkeleton>
  );
}
