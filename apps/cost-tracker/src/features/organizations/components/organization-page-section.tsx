import { getTranslations } from "@greendex/i18n/server";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { OrganizationContent } from "@/features/organizations/components/organization-content";
import { orpcQuery } from "@/lib/orpc/orpc";
import { requireActiveOrganization } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

/**
 * Prefetches Organization staff data and owns the page error boundary.
 * The header renders from the same tree, so denied viewers see the page
 * skeleton first and the boundary denial second — exactly like the
 * Project workspace. Procedures enforce owner/admin access; the Denial
 * below is their verdict, not a presentation guess.
 */
export async function OrganizationPageSection() {
  const { session, organization } = await requireActiveOrganization();
  const t = await getTranslations("organizations");
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
        <OrganizationContent
          email={session.user.email}
          organizationName={organization.name}
          eyebrow={t("page.eyebrow")}
          description={t("page.description")}
        />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
