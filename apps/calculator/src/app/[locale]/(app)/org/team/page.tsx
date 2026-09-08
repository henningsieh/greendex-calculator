/**
 * @file Team page
 *
 * Organization team page with list of members
 */

import { DEFAULT_PAGE_SIZE } from "@greendex/config/pagination";
import { getTranslations } from "@greendex/i18n/server";
import { UsersIcon } from "lucide-react";
import { headers as nextHeaders } from "next/headers";
import { Suspense } from "react";

import { ContentContainer } from "@/components/content-container";
import { PageHeader } from "@/components/page-header";
import {
  TeamTableSkeleton,
  UsersTable,
} from "@/features/organizations/components/users-table";
import { MEMBER_ROLES } from "@/features/organizations/types";
import { auth } from "@/lib/better-auth";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export default async () => {
  const headers = await nextHeaders();

  // Get session and organizations for server-side data
  const session = await auth.api.getSession({
    headers,
  });
  const organizations = await auth.api.listOrganizations({
    headers,
  });

  const activeOrganizationId =
    session?.session?.activeOrganizationId || organizations[0]?.id || "";

  // Prefetch team members data
  // Using await ensures data is in cache BEFORE dehydration
  const queryClient = getQueryClient();
  await queryClient
    .query(
      orpcQuery.members.search.queryOptions({
        input: {
          organizationId: activeOrganizationId,
          filters: {
            roles: [
              MEMBER_ROLES.OrganizationAdministrator,
              MEMBER_ROLES.ProjectCoordinator,
            ],
            search: undefined,
            sortBy: undefined,
            sortDirection: "asc",
            limit: DEFAULT_PAGE_SIZE,
            offset: 0,
          },
        },
      }),
    )
    .catch(swallowPrefetchError);

  const t = await getTranslations("organization.team");

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<UsersIcon />}
        title={t("title")}
        description={t("description")}
      />
      <ContentContainer width="lg">
        <Suspense fallback={<TeamTableSkeleton />}>
          <UsersTable
            emptyDescription={t("emptyState.description")}
            emptyTitle={t("emptyState.title")}
            organizationId={activeOrganizationId}
            roles={[
              MEMBER_ROLES.OrganizationAdministrator,
              MEMBER_ROLES.ProjectCoordinator,
            ]}
            showInviteButton={true}
          />
        </Suspense>
      </ContentContainer>
    </div>
  );
};
