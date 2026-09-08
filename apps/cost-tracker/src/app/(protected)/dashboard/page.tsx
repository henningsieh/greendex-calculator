import { DashboardOverview } from "@/features/projects/components/dashboard-overview";
import { orpcQuery } from "@/lib/orpc/orpc";
import { requireSession } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export default async function DashboardPage() {
  const session = await requireSession();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient
      .query(orpcQuery.projects.list.queryOptions())
      .catch(swallowPrefetchError),
    queryClient
      .query(orpcQuery.partnerOrganizations.list.queryOptions())
      .catch(swallowPrefetchError),
  ]);

  return (
    <HydrateClient client={queryClient}>
      <DashboardOverview userName={session.user.name} />
    </HydrateClient>
  );
}
