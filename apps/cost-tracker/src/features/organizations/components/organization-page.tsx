import { getTranslations } from "@greendex/i18n/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { PrefetchedSectionSkeleton } from "@/components/prefetched-page-skeleton";
import ProtectedPageHeader from "@/components/protected-page-header";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { canManageOrganization } from "@/features/organizations/access";
import { OrganizationSettings } from "@/features/organizations/components/organization-settings";
import { OrganizationTeam } from "@/features/organizations/components/organization-team";
import { orpcQuery } from "@/lib/orpc/orpc";
import { requireActiveOrganization } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

async function OrganizationTeamSection({ email }: { email: string }) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient
      .query(
        orpcQuery.organizations.getSettings.queryOptions({
          meta: { costTrackerORPC: true },
        }),
      )
      .catch(swallowPrefetchError),
    queryClient
      .query(
        orpcQuery.organizations.listMembers.queryOptions({
          input: {},
          meta: { costTrackerORPC: true },
        }),
      )
      .catch(swallowPrefetchError),
    queryClient
      .query(
        orpcQuery.organizations.listPendingInvitations.queryOptions({
          input: {},
          meta: { costTrackerORPC: true },
        }),
      )
      .catch(swallowPrefetchError),
  ]);

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Organization staff">
        <div className="space-y-10">
          <OrganizationSettings />
          <OrganizationTeam currentUserEmail={email} />
        </div>
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}

export default async function OrganizationPage() {
  await connection();
  // Guaranteed by ProtectedShell ("continue" = verified + org ready):
  // session and active Organization are known here, typed non-null.
  const { session, organization } = await requireActiveOrganization();
  const t = await getTranslations("organizations");

  // Presentation-only gating; every procedure re-enforces owner/admin access.
  if (!(await canManageOrganization())) {
    return (
      <ProtectedPageHeader
        eyebrow={t("page.eyebrow")}
        title={organization.name}
        description={t("page.restricted")}
      />
    );
  }

  return (
    <div>
      <ProtectedPageHeader
        eyebrow={t("page.eyebrow")}
        title={organization.name}
        description={t("page.description")}
      />

      <section className="mt-10">
        <Suspense
          fallback={<PrefetchedSectionSkeleton label={t("loading.staff")} />}
        >
          <OrganizationTeamSection email={session.user.email} />
        </Suspense>
      </section>
    </div>
  );
}
