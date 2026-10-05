import { ORGANIZATION_ROLES } from "./permissions";
import {
  hasOrganizationRole,
  type ProjectParticipationPermission,
} from "./permissions";

/**
 * The one permission behind Partner-side participant entry: "may bring a
 * participant into this Project" (ADR-0015). Role statements stay single-sourced
 * in `permissions.ts`; each side resolves this record through a supported Better
 * Auth check — `auth.api.hasPermission` on the server,
 * `authClient.organization.checkRolePermission` in the browser.
 */
export const PROJECT_PARTICIPATION_CREATE: {
  projectParticipation: ProjectParticipationPermission[];
} = { projectParticipation: ["create"] };

/**
 * Non-secret authorization context for one Project Partnership. The server loads
 * it from authoritative state; a procedure output may carry the same shape for
 * presentation. Nothing here is trusted to authorize a request (ADR-0014).
 */
export type ProjectScopeFacts = {
  /** Membership role of the actor in the active Organization, when there is one. */
  role: string | null | undefined;
  /** The Organization the actor is acting as. Absent means fail closed. */
  activeOrganizationId: string | null | undefined;
  /** Partner Organization of the Project Partnership. */
  partnerOrganizationId: string | null | undefined;
  /** Hosting Organization that owns the Project. */
  hostOrganizationId: string | null | undefined;
  /** Explicit Group Organizer assignment to this Project Partnership. */
  assignedCoordinator: boolean;
  /** Result of the Better Auth role-permission check for PROJECT_PARTICIPATION_CREATE. */
  mayCreateParticipation: boolean;
};

export type ProjectScopeDenial =
  | "MISSING_ACTIVE_ORGANIZATION"
  | "MISSING_MEMBERSHIP"
  | "HOSTING_SIDE"
  | "UNRELATED_ORGANIZATION"
  | "PERMISSION_MISSING"
  | "ASSIGNMENT_MISSING";

export type ProjectScopeDecision =
  | { permitted: true }
  | { permitted: false; reason: ProjectScopeDenial };

/**
 * The single definition of Partner-side authority over one Project Partnership
 * (ADR-0014). Both sides evaluate it: the client to decide what to render, the
 * server to authorize every protected operation. Delegating the role-permission
 * check to the caller's Better Auth interface keeps roles single-sourced, and
 * evaluating the relational rules here keeps them from being restated.
 */
export function evaluateProjectScopeAccess(
  facts: ProjectScopeFacts,
): ProjectScopeDecision {
  const {
    role,
    activeOrganizationId,
    partnerOrganizationId,
    hostOrganizationId,
    assignedCoordinator,
    mayCreateParticipation,
  } = facts;
  if (!activeOrganizationId)
    return { permitted: false, reason: "MISSING_ACTIVE_ORGANIZATION" };
  if (activeOrganizationId !== partnerOrganizationId)
    return {
      permitted: false,
      reason:
        activeOrganizationId === hostOrganizationId
          ? "HOSTING_SIDE"
          : "UNRELATED_ORGANIZATION",
    };
  if (!role) return { permitted: false, reason: "MISSING_MEMBERSHIP" };
  if (!mayCreateParticipation)
    return { permitted: false, reason: "PERMISSION_MISSING" };
  if (hasOrganizationRole(role, ORGANIZATION_ROLES.OrganizationOwner) || hasOrganizationRole(role, ORGANIZATION_ROLES.OrganizationAdmin))
    return { permitted: true };
  return assignedCoordinator
    ? { permitted: true }
    : { permitted: false, reason: "ASSIGNMENT_MISSING" };
}
