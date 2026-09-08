/**
 * @file Participants page
 *
 * Organization participants page with list of participants
 */

import { DEFAULT_PAGE_SIZE } from "@greendex/config/pagination";
import { getTranslations } from "@greendex/i18n/server";
import { headers as nextHeaders } from "next/headers";
import { Suspense } from "react";

import { ContentContainer } from "@/components/content-container";
import { PageHeader } from "@/components/page-header";
import { TeamTableSkeleton } from "@/features/organizations/components/users-table";
import { MEMBER_ROLES } from "@/features/organizations/types";
import { ParticipantsTable } from "@/features/participants/components/participants-table";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
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

  // Prefetch participants data (members with "member" role)
  // Using await ensures data is in cache BEFORE dehydration
  const queryClient = getQueryClient();
  await queryClient
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
    .catch(swallowPrefetchError);

  const t = await getTranslations("organization.participants");

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<PROJECT_ICONS.participants />}
        title={t("title")}
        description={t("description")}
      />
      <ContentContainer width="lg">
        <Suspense fallback={<TeamTableSkeleton />}>
          <ParticipantsTable organizationId={activeOrganizationId} />
        </Suspense>
      </ContentContainer>
    </div>
  );
};
