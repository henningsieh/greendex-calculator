import { ProjectDataPageLoading } from "@/components/loading-skeletons";
import { ClaimWorkspaceLoading } from "@/features/claims/components/claim-workspace-loading";

export default function Loading() {
  return (
    <ProjectDataPageLoading>
      <ClaimWorkspaceLoading />
    </ProjectDataPageLoading>
  );
}
