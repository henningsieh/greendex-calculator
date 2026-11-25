import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { LoadingTransition } from "@/components/view-transition-boundaries";
import { ClaimWorkspaceLoading } from "@/features/claims/components/claim-workspace-loading";

export default function Loading() {
  return (
    <LoadingTransition>
      <ProjectDataPageLoading>
        <ClaimWorkspaceLoading />
      </ProjectDataPageLoading>
    </LoadingTransition>
  );
}
