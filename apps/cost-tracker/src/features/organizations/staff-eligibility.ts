import { ORGANIZATION_ROLES, parseOrganizationRoles } from "@greendex/auth";

/**
 * Membership roles that confer staff authority in Cost Tracker. Derived from
 * the shared Better Auth role constants (ADR-0012/0015): owners and admins
 * act for their Organization, project coordinators act within an assigned
 * Project Partnership, and participant-only Memberships never authorize
 * staff flows. No role strings of its own.
 */
const STAFF_ORGANIZATION_ROLES = [
  ORGANIZATION_ROLES.OrganizationAdministrator,
  ORGANIZATION_ROLES.OrganizationAdmin,
  ORGANIZATION_ROLES.ProjectCoordinator,
] as const;

/** A caller's Membership in one Organization, as the shell needs it. */
export type OrganizationMembershipSummary = {
  id: string;
  name: string;
  role: string;
};

export type StaffOrganizationContextInput = {
  memberships: OrganizationMembershipSummary[];
  activeOrganizationId: string | null;
};

export type StaffOrganizationContext =
  | { status: "no-membership" }
  | {
      status: "select";
      memberships: OrganizationMembershipSummary[];
    }
  | {
      status: "ready";
      memberships: OrganizationMembershipSummary[];
      activeOrganizationId: string;
      /** False for pure Participants: they get no staff switcher. */
      showSwitcher: boolean;
    };

/** Whether one Membership role carries staff authority (ADR-0015). */
export function isStaffOrganizationRole(
  role: string | null | undefined,
): boolean {
  return parseOrganizationRoles(role ?? "").some((value) =>
    (STAFF_ORGANIZATION_ROLES as readonly string[]).includes(value),
  );
}

/**
 * Resolves the staff shell context from the caller's Memberships and the
 * session's active Organization (ADR-0015). Pure: the shell gate and the
 * switcher consume this, procedures keep enforcing authoritatively.
 *
 * - No Memberships: creation recovery (the existing empty state).
 * - Missing, stale, or revoked active context: selection recovery. Rendered
 *   inline so the shell never shows unusable staff actions or redirects.
 * - Valid active Membership: the staff shell. Pure Participants (no staff
 *   role in any Membership) render without the staff switcher; their
 *   Project Participations stay scoped by User-to-Project, never by the
 *   active Organization.
 */
export function resolveStaffOrganizationContext(
  input: StaffOrganizationContextInput,
): StaffOrganizationContext {
  if (input.memberships.length === 0) return { status: "no-membership" };

  const active = input.activeOrganizationId
    ? input.memberships.find(
        (membership) => membership.id === input.activeOrganizationId,
      )
    : undefined;

  if (!active) return { status: "select", memberships: input.memberships };

  return {
    status: "ready",
    memberships: input.memberships,
    activeOrganizationId: active.id,
    showSwitcher: input.memberships.some((membership) =>
      isStaffOrganizationRole(membership.role),
    ),
  };
}
