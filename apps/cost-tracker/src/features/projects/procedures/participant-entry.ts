import "server-only";
import {
  PROJECT_PARTICIPATION_CREATE,
  evaluateProjectScopeAccess,
  type ProjectScopeDenial,
  type ProjectScopeFacts,
} from "@greendex/auth/project-authorization";
import { db } from "@greendex/database";
import {
  member,
  partnerCoordinatorAssignmentsTable as assignments,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import type { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import {
  createSituationErrors,
  type ScopeErrorConstructors,
  type SituationErrors,
} from "@/lib/orpc/errors";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";

export type ParticipantEntryScope = {
  id: string;
  projectId: string;
  partnerOrganizationId: string;
  hostOrganizationId: string;
};

export type ParticipantEntryContext = {
  scope: ParticipantEntryScope;
  facts: ProjectScopeFacts;
};

/** Explicit Group Organizer assignment to one Project Partnership. */
export async function isPartnerCoordinatorAssigned(
  userId: string,
  partnershipId: string,
): Promise<boolean> {
  const [assignment] = await db
    .select({ userId: assignments.userId })
    .from(assignments)
    .where(
      and(
        eq(assignments.partnershipId, partnershipId),
        eq(assignments.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(assignment);
}

/**
 * Loads the authoritative context the shared Project-scope policy needs. Returns
 * null when the actor acts for an Organization that is neither side of the
 * Partnership, so an unrelated Organization learns nothing about it.
 */
export async function loadParticipantEntryContext(
  partnershipId: string,
  actorId: string,
  activeOrganizationId: string,
): Promise<ParticipantEntryContext | null> {
  const [scope] = await db
    .select({
      id: partnerships.id,
      projectId: partnerships.projectId,
      partnerOrganizationId: partnerships.organizationId,
      hostOrganizationId: projects.organizationId,
    })
    .from(partnerships)
    .innerJoin(projects, eq(projects.id, partnerships.projectId))
    .where(and(eq(partnerships.id, partnershipId), eq(projects.archived, false)))
    .limit(1);
  if (
    !scope ||
    (activeOrganizationId !== scope.partnerOrganizationId &&
      activeOrganizationId !== scope.hostOrganizationId)
  )
    return null;
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, actorId),
        eq(member.organizationId, activeOrganizationId),
      ),
    )
    .limit(1);
  return {
    scope,
    facts: {
      role: membership?.role ?? null,
      activeOrganizationId,
      partnerOrganizationId: scope.partnerOrganizationId,
      hostOrganizationId: scope.hostOrganizationId,
      assignedCoordinator:
        activeOrganizationId === scope.partnerOrganizationId
          ? await isPartnerCoordinatorAssigned(actorId, partnershipId)
          : false,
      mayCreateParticipation: false,
    },
  };
}

export type PartnerScopeRefusals = {
  /**
   * The calling procedure's own refusal for the Hosting Organization, whose staff
   * read a Project Partnership's Partner-side records but never change them.
   */
  hostingSide: () => ORPCError<string, unknown>;
};

function refuse(
  situation: SituationErrors,
  reason: ProjectScopeDenial,
  refusals?: PartnerScopeRefusals,
): never {
  switch (reason) {
    case "MISSING_ACTIVE_ORGANIZATION":
      throw situation.selectOrganization();
    case "MISSING_MEMBERSHIP":
      throw situation.notMember();
    case "HOSTING_SIDE":
      throw (refusals?.hostingSide ?? situation.partnerEntryRequired)();
    case "UNRELATED_ORGANIZATION":
      throw situation.partnerEntryRequired();
    default:
      throw situation.partnerCoordinationRequired();
  }
}

/**
 * Enforces the complete Partner-side policy for one Project Partnership (ADR-0014).
 * The role permission comes from Better Auth's supported server check; the
 * relational rules are the shared policy, evaluated against state loaded here.
 *
 * This is the single server-side Partner-side gate: participant entry issuance and
 * the Partner-only correction of a Participation's `country` are both decided here,
 * so no procedure keeps its own role or scope matrix.
 */
export async function requirePartnerScopeAuthority(
  headers: Headers,
  partnershipId: string,
  actorId: string,
  activeOrganizationId: string | null | undefined,
  errors: ScopeErrorConstructors,
  refusals?: PartnerScopeRefusals,
): Promise<ParticipantEntryScope> {
  const situation = createSituationErrors(errors);
  if (!activeOrganizationId) throw situation.selectOrganization();
  const loaded = await loadParticipantEntryContext(
    partnershipId,
    actorId,
    activeOrganizationId,
  );
  if (!loaded) throw situation.partnershipNotFound();
  const decision = evaluateProjectScopeAccess({
    ...loaded.facts,
    // Unavailable permission context fails closed rather than skipping the check.
    mayCreateParticipation: await hasCostTrackerPermissions(
      headers,
      PROJECT_PARTICIPATION_CREATE,
    ).catch(() => false),
  });
  if (!decision.permitted) refuse(situation, decision.reason, refusals);
  return loaded.scope;
}
