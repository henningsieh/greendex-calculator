"use client";

import ProtectedPageHeader from "@/components/protected-page-header";
import { OrganizationSettings } from "@/features/organizations/components/organization-settings";
import { OrganizationTeam } from "@/features/organizations/components/organization-team";

/**
 * The Organization page content: header plus staff management. All copy
 * arrives as props so this file reads no message bundle of its own; every
 * value suspends on the same prefetched queries, so denied viewers see the
 * page skeleton first and the boundary denial second — like every page.
 */
export function OrganizationContent({
  email,
  organizationName,
  eyebrow,
  description,
}: {
  email: string;
  organizationName: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <>
      <ProtectedPageHeader
        eyebrow={eyebrow}
        title={organizationName}
        description={description}
      />
      <section className="mt-10">
        <div className="space-y-10">
          <OrganizationSettings />
          <OrganizationTeam currentUserEmail={email} />
        </div>
      </section>
    </>
  );
}
