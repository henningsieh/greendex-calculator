import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ClaimWorkspace } from "@/features/projects/components/claim-workspace";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { orpcQuery } from "@/lib/orpc/orpc";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Claim workspace" };

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;
  const { id } = await params;
  const client = getQueryClient();
  const input = { partnershipId: id };
  const options = { input, meta: { costTrackerORPC: true } } as const;
  await Promise.all(
    [
      client.query(orpcQuery.claims.getDraft.queryOptions(options)),
      client.query(orpcQuery.claims.getHistory.queryOptions(options)),
      client.query(orpcQuery.claims.previewSubmission.queryOptions(options)),
      client.query(orpcQuery.claims.listPayoutAccounts.queryOptions(options)),
      client.query(
        orpcQuery.participations.listPartnership.queryOptions(options),
      ),
      client.query(orpcQuery.journeys.list.queryOptions(options)),
      client.query(orpcQuery.costs.list.queryOptions(options)),
      client.query(orpcQuery.documents.list.queryOptions(options)),
    ].map((promise) => promise.catch(swallowPrefetchError)),
  );
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link className={buttonVariants({ variant: "ghost" })} href="/projects">
          Back to Projects
        </Link>
        <h1 className="font-heading text-4xl font-semibold">Claim workspace</h1>
      </header>
      <HydrateClient client={client}>
        <ProjectDataErrorBoundary resource="Claim workspace">
          <ClaimWorkspace partnershipId={id} />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </div>
  );
}
