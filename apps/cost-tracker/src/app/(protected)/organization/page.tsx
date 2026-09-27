import type { Metadata } from "next";

import { canManageOrganization } from "@/features/organizations/access";
import { OrganizationTeam } from "@/features/organizations/components/organization-team";
import { orpcQuery } from "@/lib/orpc/orpc";
import { requireSession } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Organization" };

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
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Organization staff management is available to owners and admins.
        </p>
      </div>
    );
  }

  const queryClient = getQueryClient();
  await Promise.all([
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
    <div>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Organization</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Organization
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Manage staff members and pending invitations for the active
          Organization.
        </p>
      </header>

      <section className="mt-10">
        <HydrateClient client={queryClient}>
          <OrganizationTeam currentUserEmail={session.user.email} />
        </HydrateClient>
      </section>
    </div>
  );
}
