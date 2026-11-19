import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { resolveActiveMembershipRole } from "@/features/organizations/access";
import { isStaffOrganizationRole } from "@/features/organizations/staff-eligibility";
import { ProjectList } from "@/features/projects/components/project-list";
import {
  getProjectAvailableScopesQueryOptions,
  getProjectListQueryOptions,
  getProjectPartnerFilterQueryOptions,
  loadProjectListSearchParams,
  normalizeProjectListState,
  resolveProjectListState,
} from "@/features/projects/list-query-options";
import { requireSession } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";
import { readProjectVisibility } from "@/lib/ui-preferences/server";

type ProjectListSectionProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Presentation-only staff check for the scope-less Empty: members with staff
 * standing (owner/admin/coordinator) in the active Organization see the
 * guidance Empty, everyone else keeps the unavailable Empty. Pure
 * participants are not staff (spec #407 story 9). Shares the single
 * active-role lookup with the other presentation gates.
 */
async function resolveStaffMembership(): Promise<boolean> {
  return isStaffOrganizationRole(await resolveActiveMembershipRole());
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
  const session = await requireSession();
  const preference = await readProjectVisibility(session.user.id);
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
      const selected = (
        resolution.scope === "hosted"
          ? queryClient.query(
              getProjectListQueryOptions("hosted", resolution.state),
            )
          : queryClient.query(
              getProjectListQueryOptions("partner", resolution.state),
            )
      ).catch(swallowPrefetchError);
      await Promise.all([
        selected,
        ...(resolution.scope === "hosted" &&
        (resolution.state.partnerOrganizationIds.length > 0 ||
          resolution.state.cursor)
          ? [
              queryClient
                .query(getProjectPartnerFilterQueryOptions(resolution.state))
                .catch(swallowPrefetchError),
            ]
          : []),
      ]);
    }
  }

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Projects">
        <ProjectList
          hasStaffMembership={hasStaffMembership}
          preference={preference}
        />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
