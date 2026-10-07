import { DEFAULT_PAGE_SIZE } from "@greendex/config/pagination";
import { getTranslations } from "@greendex/i18n/server";
import { headers } from "next/headers";

import { ContentContainer } from "@/components/content-container";
import { PageHeader } from "@/components/page-header";
import { NuqsProvider } from "@/components/providers/nuqs-adapter";
import { OrganizationDashboard } from "@/features/organizations/components/organization-dashboard";
import { ORGANIZATION_ICONS } from "@/features/organizations/organization-icons";
import { MEMBER_ROLES } from "@/features/organizations/types";
import { DEFAULT_PROJECT_SORT } from "@/features/projects/types";
import { auth } from "@/lib/better-auth";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";
/**
 * Render the organization dashboard page while prefetching and hydrating required server-side data for client components.
 *
 * Prefetches current session, organizations, projects (with default project sort), members (filtered to Participant role with default pagination), and organization statistics. Chooses the active organization from the session's activeOrganizationId, or the first available organization, or an empty string if none exist.
 *
 * @returns The React element that renders the organization dashboard for the resolved active organization.
 */
export default async function DashboardPage() {
  const t = await getTranslations("organization.dashboard");
  const queryClient = getQueryClient();

  // Get session and organizations for server-side data
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  });

  const activeOrganizationId =
    session?.session?.activeOrganizationId || organizations[0]?.id || "";

  // Prefetch all data using oRPC procedures for client components
  await Promise.all([
    queryClient
      .query(
        orpcQuery.projects.list.queryOptions({
          input: {
            sort_by: DEFAULT_PROJECT_SORT.column,
          },
        }),
      )
      .catch(swallowPrefetchError),
    queryClient
      .query(orpcQuery.betterauth.getSession.queryOptions())
      .catch(swallowPrefetchError),
    queryClient
      .query(orpcQuery.organizations.list.queryOptions())
      .catch(swallowPrefetchError),
    queryClient
      .query(
        orpcQuery.members.search.queryOptions({
          input: {
            organizationId: activeOrganizationId,
            filters: {
              roles: [MEMBER_ROLES.Participant],
              search: undefined,
              sortBy: undefined,
              sortDirection: "asc",
              limit: DEFAULT_PAGE_SIZE,
              offset: 0,
            },
          },
        }),
      )
      .catch(swallowPrefetchError),
    queryClient
      .query(
        orpcQuery.organizations.getStats.queryOptions({
          input: {
            organizationId: activeOrganizationId,
          },
        }),
      )
      .catch(swallowPrefetchError),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<ORGANIZATION_ICONS.dashboard />}
        title={t("title")}
        description={t("description")}
      />
      <ContentContainer width="lg">
        <NuqsProvider>
          <OrganizationDashboard organizationId={activeOrganizationId} />
        </NuqsProvider>
      </ContentContainer>
    </div>
  );
}
