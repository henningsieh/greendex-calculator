import { ProjectDataPageSkeleton } from "@/components/loading-skeletons";
import { ProjectPartnershipsSkeleton } from "@/features/partnerships/components/partnership-loading-states";

export default function Loading() {
  return (
    <ProjectDataPageSkeleton>
      <ProjectPartnershipsSkeleton />
    </ProjectDataPageSkeleton>
  );
}
