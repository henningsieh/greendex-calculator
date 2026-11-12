import "@/lib/orpc/client.server";
import { getTranslations } from "@greendex/i18n/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { canViewPartnerNetwork } from "@/features/organizations/access";
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
  ).catch((error: unknown) => {
    if (isPresentationRefusal(error)) return false;
    throw error;
  });
  return (
    <div>
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

      {canCreateProjectPartnership && (
        <section className="mt-10">
          <SetupLinkList />
        </section>
      )}

      <Suspense fallback={<ProjectPartnershipsSkeleton />}>
        <ProjectPartnershipSection canAssign={canCreateProjectPartnership} />
      </Suspense>
    </div>
  );
}
