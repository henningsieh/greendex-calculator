import { DashboardOverview } from "@/features/projects/components/dashboard-overview";
import { orpcQuery } from "@/lib/orpc/orpc";
import { requireSession } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
} from "@/lib/tanstack-react-query/hydration";

export default async function DashboardPage() {
  const session = await requireSession();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(orpcQuery.projects.list.queryOptions()),
    queryClient.prefetchQuery(orpcQuery.partnerOrganizations.list.queryOptions()),
  ]);

  return (
    <HydrateClient client={queryClient}>
      <DashboardOverview userName={session.user.name} />
    </HydrateClient>
  );
}
