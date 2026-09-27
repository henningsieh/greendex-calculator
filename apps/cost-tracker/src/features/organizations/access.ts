import "server-only";
import { hasOrganizationRole } from "@greendex/auth";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";

/**
 * Presentation-only owner/admin check for the Organization page and nav entry.
 * Procedures enforce the same rule authoritatively; this helper only decides
 * what to render. Fail-closed: any lookup failure hides management UI.
 */
export async function canManageOrganization(): Promise<boolean> {
  try {
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
      hasOrganizationRole(role, "owner") || hasOrganizationRole(role, "admin")
    );
  } catch {
    return false;
  }
}
