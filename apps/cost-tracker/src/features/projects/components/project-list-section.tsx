import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { isStaffOrganizationRole } from "@/features/organizations/staff-eligibility";
import { ProjectList } from "@/features/projects/components/project-list";
import {
  getProjectAvailableScopesQueryOptions,
  getProjectListQueryOptions,
  loadProjectListSearchParams,
  normalizeProjectListState,
  resolveProjectListState,
} from "@/features/projects/list-query-options";
import { getSession } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

type ProjectListSectionProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Presentation-only staff check for the scope-less Empty: members with staff
 * standing (owner/admin/coordinator) in the active Organization see the
 * guidance Empty, everyone else keeps the unavailable Empty. Pure
 * participants are not staff (spec #407 story 9), and any lookup failure
 * fails closed. Procedures enforce authoritatively; this only decides what
 * to render.
 */
async function resolveStaffMembership(): Promise<boolean> {
  try {
    // Lazy so light rendering or test environments never load the
    // auth/email/env chain unless this gate runs.
    const { auth } = await import("@/lib/auth");
    const requestHeaders = await headers();
    // Sequential on purpose: `getSession()` suspends the render before Better
    // Auth validates the session against the clock, so `getFullOrganization`
    // must not start reading the clock concurrently in a `Promise.all`.
    const session = await getSession();
    const organization = await auth.api.getFullOrganization({
      headers: requestHeaders,
    });
    const membership = organization?.members.find(
      (entry) => entry.userId === session?.user.id,
    );
    return isStaffOrganizationRole(membership?.role);
  } catch (error) {
    // Prerender interruptions are framework control flow, not access denials.
    unstable_rethrow(error);
    console.error("Staff project access lookup failed", { error });
    return false;
  }
}

/**
 * Suspends below the Projects page shell while the scope and selected list
 * prefetch resolve. The header and list skeleton can stream first; navigating
 * away can still cancel the underlying RSC response.
 */
export async function ProjectListSection({
  searchParams,
}: ProjectListSectionProps) {
  const queryClient = getQueryClient();
  const [urlState, availableScopes, hasStaffMembership] = await Promise.all([
    loadProjectListSearchParams(searchParams),
    queryClient
      .query(getProjectAvailableScopesQueryOptions())
      .catch(swallowPrefetchError),
    // The scopes signal carries no standing info (it reports {false,false}
    // for participants and staff alike), so the scope-less Empty branches on
    // staff standing resolved above. getSession is cached, so this shares
    // the shell's lookup.
    resolveStaffMembership(),
  ]);

  if (availableScopes) {
    const resolution = resolveProjectListState(
      normalizeProjectListState(urlState),
      availableScopes,
    );
    if (resolution.scope) {
      await (
        resolution.scope === "hosted"
          ? queryClient.query(
              getProjectListQueryOptions("hosted", resolution.state),
            )
          : queryClient.query(
              getProjectListQueryOptions("partner", resolution.state),
            )
      ).catch(swallowPrefetchError);
    }
  }

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Projects">
        <ProjectList hasStaffMembership={hasStaffMembership} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
