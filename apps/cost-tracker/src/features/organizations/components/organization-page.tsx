import { RouteTransition } from "@/components/view-transition-boundaries";
import { OrganizationPageSection } from "@/features/organizations/components/organization-page-section";
import type { OrganizationPageKind } from "@/features/organizations/types";
import { hasOrganizationMembership } from "@/lib/session";

export async function OrganizationTeamPage() {
  return OrganizationPageView({ page: "team" });
}

export default async function OrganizationPage() {
  return OrganizationPageView({ page: "settings" });
}

async function OrganizationPageView({ page }: { page: OrganizationPageKind }) {
  // The shell can show recovery while this page still runs. Do not redirect
  // away from its creation form before an active Membership exists.
  if (!(await hasOrganizationMembership())) return null;

  return (
    <RouteTransition>
      <div>
        <OrganizationPageSection page={page} />
      </div>
    </RouteTransition>
  );
}
