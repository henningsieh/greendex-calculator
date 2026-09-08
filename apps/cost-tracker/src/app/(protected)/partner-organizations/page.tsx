import type { Metadata } from "next";

import { PartnerOrganizationsList } from "@/features/projects/components/partner-organizations-list";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Partner Organizations" };

export default async function PartnerOrganizationsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    orpcQuery.partnerOrganizations.list.queryOptions(),
  );

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Project network</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Partner Organizations
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Organizations assigned to your active Projects through Project
          Partnerships.
        </p>
      </header>

      <HydrateClient client={queryClient}>
        <PartnerOrganizationsList />
      </HydrateClient>
    </div>
  );
}
