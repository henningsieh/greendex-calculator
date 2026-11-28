import { getTranslations } from "@greendex/i18n/server";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { OrganizationSettings } from "@/features/organizations/components/organization-settings";
import { OrganizationTeam } from "@/features/organizations/components/organization-team";
import type { OrganizationPageKind } from "@/features/organizations/types";
import { orpcQuery } from "@/lib/orpc/orpc";
import { requireActiveOrganization } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function OrganizationPageSection({
  page,
}: {
  page: OrganizationPageKind;
}) {
  const { session } = await requireActiveOrganization();
  const queryClient = getQueryClient();
  const members = queryClient.query(
    orpcQuery.organizations.listMembers.queryOptions({
      input: {},
      meta: { costTrackerORPC: true },
    }),
  );
  const pageData =
    page === "settings"
      ? queryClient.query(
          orpcQuery.organizations.getSettings.queryOptions({
            meta: { costTrackerORPC: true },
          }),
        )
      : queryClient.query(
          orpcQuery.organizations.listPendingInvitations.queryOptions({
            input: {},
            meta: { costTrackerORPC: true },
          }),
        );
  await Promise.all(
    [members, pageData].map((query) => query.catch(swallowPrefetchError)),
  );
  const t = await getTranslations("organizations");

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary
        resource={
          page === "settings" ? "Organization settings" : "Organization staff"
        }
      >
        <div className="space-y-10">
          <ProtectedRouteHeader
            page={page}
            description={t(
              page === "team"
                ? "page.teamDescription"
                : "page.settingsDescription",
            )}
          />
          {page === "settings" ? (
            <OrganizationSettings />
          ) : (
            <OrganizationTeam currentUserEmail={session.user.email} />
          )}
        </div>
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
