import { connection } from "next/server";
import { Suspense } from "react";

import { OrganizationPageSkeleton } from "@/features/organizations/components/organization-loading-states";
import { OrganizationPageSection } from "@/features/organizations/components/organization-page-section";
import { hasOrganizationMembership } from "@/lib/session";

export default async function OrganizationPage() {
  await connection();
  // The shell can show recovery while this page still runs. Do not redirect
  // away from its creation form before an active Membership exists.
  if (!(await hasOrganizationMembership())) return null;

  return (
    <div>
      <Suspense fallback={<OrganizationPageSkeleton />}>
        <OrganizationPageSection />
      </Suspense>
    </div>
  );
}
