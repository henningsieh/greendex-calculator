import { getTranslations } from "@greendex/i18n/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { canViewPartnerNetwork } from "@/features/organizations/access";
import { ProjectPartnershipsSkeleton } from "@/features/partnerships/components/partnership-loading-states";
import { ProjectPartnershipSection } from "@/features/partnerships/components/project-partnership-section";
import { SetupLinkCreator } from "@/features/partnerships/components/setup-link";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";

export default async function PartnerOrganizationsPage() {
  const t = await getTranslations("partnerships.partnerOrganizations.page");

  // Same gate as projectPartnerships.list: without it the section below
  // would only render a denial. Assignment holders see their own rows.
  if (!(await canViewPartnerNetwork())) {
    return (
      <div>
        <ProtectedPageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("restricted")}
        />
      </div>
    );
  }

  const canCreateProjectPartnership = await hasCostTrackerPermissions(
    await headers(),
    {
      projectPartnership: ["create"],
    },
  );
  return (
    <div>
      <ProtectedPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      {canCreateProjectPartnership && (
        <section className="mt-10">
          <SetupLinkCreator />
        </section>
      )}

      <Suspense fallback={<ProjectPartnershipsSkeleton />}>
        <ProjectPartnershipSection canAssign={canCreateProjectPartnership} />
      </Suspense>
    </div>
  );
}
