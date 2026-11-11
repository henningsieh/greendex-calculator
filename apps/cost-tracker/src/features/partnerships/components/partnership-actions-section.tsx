import "@/lib/orpc/client.server";
import { getTranslations } from "@greendex/i18n/server";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { PartnershipActions } from "@/features/partnerships/components/partnership-actions";
import { orpcQuery } from "@/lib/orpc/orpc";
import { requireSession } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function PartnershipActionsSection() {
  const t = await getTranslations("partnerships.partnerOrganizations.page");
  const session = await requireSession();
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient
      .query(
        orpcQuery.projects.listHostedOptions.queryOptions({
          meta: { costTrackerORPC: true },
        }),
      )
      .catch(swallowPrefetchError),
    queryClient
      .query(
        orpcQuery.organizations.listOptions.queryOptions({
          meta: { costTrackerORPC: true },
        }),
      )
      .catch(swallowPrefetchError),
  ]);

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary
        key={session.session.activeOrganizationId}
        resource={t("title")}
      >
        <PartnershipActions />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
