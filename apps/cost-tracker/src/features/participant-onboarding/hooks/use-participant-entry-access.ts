"use client";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import {
  PROJECT_PARTICIPATION_CREATE,
  evaluateProjectScopeAccess,
  type ProjectScopeDecision,
} from "@greendex/auth/project-authorization";

import { useReadyOrganizationContext } from "@/features/organizations/organization-switch";
import { authClient } from "@/lib/auth-client";

/** The Project Partnership scope a procedure reports to the browser. */
export type ParticipantEntryScopeContext = {
  userId: string;
  partnerOrganizationId: string;
  hostOrganizationId: string;
  assignedCoordinator: boolean;
};

/**
 * Client presentation of the shared Project-scope policy (ADR-0014). The
 * browser supplies its own session facts and resolves the role permission
 * through `authClient.organization.checkRolePermission`; the relational rules
 * are never restated here. Pending or unavailable context fails closed, and the
 * active Organization signal refreshes the decision when it changes.
 */
export function useParticipantEntryAccess(
  scope: ParticipantEntryScopeContext | undefined,
): ProjectScopeDecision {
  const context = useReadyOrganizationContext();
  const role = context?.role ?? null;
  return evaluateProjectScopeAccess({
    role,
    activeOrganizationId:
      context && scope?.userId === context.userId ? context.organizationId : null,
    // An absent scope report is missing context, so the policy refuses.
    partnerOrganizationId: scope?.partnerOrganizationId ?? null,
    hostOrganizationId: scope?.hostOrganizationId ?? null,
    assignedCoordinator: scope?.assignedCoordinator ?? false,
    // No loaded Membership means no evaluated role: the check stays closed.
    mayCreateParticipation: authClient.organization.checkRolePermission({
      role: role ?? ORGANIZATION_ROLES.Participant,
      permissions: PROJECT_PARTICIPATION_CREATE,
    }),
  });
}

const ENTRY_DENIAL_COPY = {
  MISSING_ACTIVE_ORGANIZATION:
    "Select the Partner as your active Organization before issuing participant entry points.",
  MISSING_MEMBERSHIP:
    "You need Membership with this Partner to issue participant entry points.",
  HOSTING_SIDE:
    "Only the Partner in this Project Partnership may issue participant entry points.",
  UNRELATED_ORGANIZATION:
    "Only the Partner in this Project Partnership may issue participant entry points.",
  PERMISSION_MISSING:
    "Your Organization role cannot bring participants into this Project.",
  ASSIGNMENT_MISSING:
    "Ask an Organization Owner or Admin to assign you as Group Organizer for this Project Partnership.",
} as const;

/** Presentation copy for a denial; the decision itself stays shared. */
export function participantEntryDenialMessage(
  decision: ProjectScopeDecision,
): string | undefined {
  return decision.permitted ? undefined : ENTRY_DENIAL_COPY[decision.reason];
}
