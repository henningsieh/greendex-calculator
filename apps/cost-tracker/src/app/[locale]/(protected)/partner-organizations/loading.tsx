import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { LoadingTransition } from "@/components/view-transition-boundaries";
import { ProjectPartnershipsSkeleton } from "@/features/partnerships/components/partnership-loading-states";

export default function Loading() {
  return (
    <LoadingTransition>
      <ProjectDataPageLoading>
        <ProjectPartnershipsSkeleton />
      </ProjectDataPageLoading>
    </LoadingTransition>
  );
}
