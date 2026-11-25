import { LoadingTransition } from "@/components/view-transition-boundaries";
import OrganizationLoading from "@/features/organizations/components/organization-loading";

export default function Loading() {
  return (
    <LoadingTransition>
      <OrganizationLoading />
    </LoadingTransition>
  );
}
