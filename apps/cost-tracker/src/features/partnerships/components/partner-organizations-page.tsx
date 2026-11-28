import "@/lib/orpc/client.server";
import { getTranslations } from "@greendex/i18n/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { RouteTransition } from "@/components/view-transition-boundaries";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { PartnerGuideDialog } from "@/features/partnerships/components/partner-guide-dialog";
import { PartnerOrganizationsTabs } from "@/features/partnerships/components/partner-organizations-tabs";
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
    <RouteTransition>
      <div>
        <ProjectDataErrorBoundary resource="Project Partnerships">
          {/* The header's right side carries the page's most important
            actions: the Invite menu (primary) stacked over the guide
            (ghost), so both stay visible without scrolling past the tabs. */}
          <ProtectedRouteHeader
            page="partners"
            title={t("title")}
            description={t("description")}
            rightButton={
              <div className="flex flex-col items-stretch gap-2">
                {canCreateProjectPartnership ? (
                  <Suspense fallback={<ProjectOptionsLoading />}>
                    <PartnershipActionsSection />
                  </Suspense>
                ) : null}
                <PartnerGuideDialog />
              </div>
            }
          />

          <PartnerOrganizationsTabs
            showInvitations={canCreateProjectPartnership}
            partnerships={
              <Suspense fallback={<ProjectPartnershipsSkeleton />}>
                <ProjectPartnershipSection
                  canAssign={canCreateProjectPartnership}
                />
              </Suspense>
            }
            invitations={canCreateProjectPartnership && <SetupLinkList />}
          />
        </ProjectDataErrorBoundary>
      </div>
    </RouteTransition>
  );
}
