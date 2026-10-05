import { hasOrganizationRole } from "@greendex/auth";
import "server-only";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { headers } from "next/headers";

import { assignedPartnershipIds } from "@/features/projects/procedures/assigned-partnerships";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";
import { getSession } from "@/lib/session";

/**
 * Presentation-only owner/admin check for the Organization page and nav entry.
 * Procedures enforce the same rule authoritatively; this helper only decides
 * what to render. Fail-closed: any lookup failure hides management UI.
 */
export async function canManageOrganization(): Promise<boolean> {
  try {
    // Lazy so pages that only need the assignment gate below never load the
    // auth/email/env chain in light rendering or test environments.
    const { auth } = await import("@/lib/auth");
    const requestHeaders = await headers();
    const [session, organization] = await Promise.all([
      getSession(),
      auth.api.getFullOrganization({ headers: requestHeaders }),
    ]);
    const membership = organization?.members.find(
      (entry) => entry.userId === session?.user.id,
    );
    const role = membership?.role ?? "";
    return (
      hasOrganizationRole(role, ORGANIZATION_ROLES.OrganizationOwner) ||
      hasOrganizationRole(role, ORGANIZATION_ROLES.OrganizationAdmin)
    );
  } catch {
    return false;
  }
}

/**
 * Presentation-only gate for the Partner Organizations page and nav entry.
 * Composes the exact checks securing projectPartnerships.list: the same
 * Organization-wide read permission, else an explicit coordinator assignment
 * in the active Organization. No role strings of its own. Fail-closed.
 */
export async function canViewPartnerNetwork(): Promise<boolean> {
  try {
    const requestHeaders = await headers();
    const session = await getSession();
    const activeOrganizationId = session?.session.activeOrganizationId;
    const userId = session?.user.id;
    if (!activeOrganizationId || !userId) return false;
    if (
      await hasCostTrackerPermissions(requestHeaders, {
        project: ["read"],
        projectPartnership: ["read"],
      })
    )
      return true;
    const assigned = await assignedPartnershipIds(userId, activeOrganizationId);
    return assigned.length > 0;
  } catch {
    return false;
  }
}
