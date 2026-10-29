import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { canViewPartnerNetwork } from "@/features/organizations/access";
import { ProjectPartnershipsSkeleton } from "@/features/partnerships/components/partnership-loading-states";
import { ProjectPartnershipSection } from "@/features/partnerships/components/project-partnership-section";
import { SetupLinkCreator } from "@/features/partnerships/components/setup-link";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Partner Organizations" };

export default async function PartnerOrganizationsPage() {
  if (!(await hasOrganizationMembership())) return null;
  const t = await getTranslations("partnerships.partnerOrganizations.page");

  // Same gate as projectPartnerships.list: without it the section below
  // would only render a denial. Assignment holders see their own rows.
  if (!(await canViewPartnerNetwork())) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p
          className="mt-4 text-lg/8 text-muted-foreground"
          data-testid="hosting-staff-note"
        >
          {t("restricted")}
        </p>
      </div>
    );
  }

  const canAssign = await hasCostTrackerPermissions(await headers(), {
    projectPartnership: ["create"],
  });
  return (
    <div>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg/8 text-muted-foreground">{t("description")}</p>
      </header>

      {canAssign && (
        <section className="mt-10">
          <SetupLinkCreator />
        </section>
      )}

      <Suspense fallback={<ProjectPartnershipsSkeleton />}>
        <ProjectPartnershipSection canAssign={canAssign} />
      </Suspense>
    </div>
  );
}
