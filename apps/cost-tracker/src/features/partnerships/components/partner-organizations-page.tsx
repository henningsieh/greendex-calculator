import "@/lib/orpc/client.server";
import { getTranslations } from "@greendex/i18n/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { PartnerNetworkGuide } from "@/features/partnerships/components/partner-network-guide";
import { PartnershipActionsSection } from "@/features/partnerships/components/partnership-actions-section";
import { ProjectPartnershipsSkeleton } from "@/features/partnerships/components/partnership-loading-states";
import { ProjectOptionsLoading } from "@/features/partnerships/components/project-options-loading";
import { ProjectPartnershipSection } from "@/features/partnerships/components/project-partnership-section";
import { SetupLinkList } from "@/features/partnerships/components/setup-link";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
import { hasOrganizationMembership } from "@/lib/session";

export default async function PartnerOrganizationsPage() {
  if (!(await hasOrganizationMembership())) return null;

  const t = await getTranslations("partnerships.partnerOrganizations.page");

  // No network gate here: viewers without access hit the page error
  // boundary through the same denial projectPartnerships.list enforces.
  // The boundary wraps header and guide too, so a denial replaces the
  // whole page exactly like the Project workspace does.
  const canCreateProjectPartnership = await hasCostTrackerPermissions(
    await headers(),
    {
      projectPartnership: ["create"],
    },
  ).catch((error: unknown) => {
    if (isPresentationRefusal(error)) return false;
    throw error;
  });
  return (
    <div>
      <ProjectDataErrorBoundary resource="Project Partnerships">
        <ProtectedPageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          rightButton={
            canCreateProjectPartnership ? (
              <Suspense fallback={<ProjectOptionsLoading />}>
                <PartnershipActionsSection />
              </Suspense>
            ) : undefined
          }
        />

        <PartnerNetworkGuide />

        <Suspense fallback={<ProjectPartnershipsSkeleton />}>
          <ProjectPartnershipSection canAssign={canCreateProjectPartnership} />
        </Suspense>

        {canCreateProjectPartnership && <SetupLinkList />}
      </ProjectDataErrorBoundary>
    </div>
  );
}
