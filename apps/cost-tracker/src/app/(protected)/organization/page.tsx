import type { Metadata } from "next";
import { Suspense } from "react";

import { PrefetchedSectionSkeleton } from "@/components/prefetched-page-skeleton";
import { canManageOrganization } from "@/features/organizations/access";
import { OrganizationSettings } from "@/features/organizations/components/organization-settings";
import { OrganizationTeam } from "@/features/organizations/components/organization-team";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { orpcQuery } from "@/lib/orpc/orpc";
import { requireSession } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Organization" };

async function OrganizationTeamSection({ email }: { email: string }) {
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
        <div className="space-y-10">
          <OrganizationSettings />
          <OrganizationTeam currentUserEmail={email} />
        </div>
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}

export default async function OrganizationPage() {
  const session = await requireSession();

  // Presentation-only gating; every procedure re-enforces owner/admin access.
  if (!(await canManageOrganization())) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Organization</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Organization
        </h1>
        <p className="mt-4 text-lg/8 text-muted-foreground">
          Organization staff management is available to owners and admins.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Organization</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Organization
        </h1>
        <p className="mt-4 text-lg/8 text-muted-foreground">
          Manage staff members and pending invitations for the active
          Organization.
        </p>
      </header>

      <section className="mt-10">
        <Suspense
          fallback={
            <PrefetchedSectionSkeleton label="Loading Organization staff" />
          }
        >
          <OrganizationTeamSection email={session.user.email} />
        </Suspense>
      </section>
    </div>
  );
}
