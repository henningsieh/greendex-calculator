import { db } from "@greendex/database";
import {
  organization,
  projectParticipantsTable,
  projectPartnerOrganizationsTable,
  projectsTable,
} from "@greendex/database/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, exists, inArray, notExists } from "drizzle-orm";
import { z } from "zod";

import { assignedPartnershipIds } from "@/features/projects/procedures/assigned-partnerships";
import { resolveRelationship } from "@/features/projects/procedures/projects";
import {
  AssignProjectPartnershipInputSchema,
  ProjectPartnershipSchema,
  RemoveProjectPartnershipInputSchema,
  RemoveProjectPartnershipResultSchema,
} from "@/features/projects/validation-schemas";
import { createSituationErrors } from "@/lib/orpc/errors";
import {
  authorized,
  hasCostTrackerPermissions,
  requireCostTrackerPermissions,
} from "@/lib/orpc/middleware";

function getPostgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return getPostgresErrorCode(error.cause);
  return undefined;
}

/** Identifies typed request errors that can pass through persistence handling. */
function isExpectedORPCError(error: unknown): boolean {
  return error instanceof ORPCError;
}

export const listPartnerships = authorized
  .output(z.array(ProjectPartnershipSchema))
  .handler(async ({ context, errors }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw createSituationErrors(errors).selectOrganization();
    }
    // Same checks as the UI gate: Organization-wide readers see hosted
    // Partnerships; assigned coordinators see exactly their assignments.
    const canRead = await hasCostTrackerPermissions(context.headers, {
      project: ["read"],
      projectPartnership: ["read"],
    });
    const assignedIds = canRead
      ? []
      : await assignedPartnershipIds(context.user.id, activeOrganizationId);
    if (!canRead && assignedIds.length === 0) {
      throw createSituationErrors(errors).accessDenied();
    }
    const scopeFilter = assignedIds.length
      ? and(
          inArray(projectPartnerOrganizationsTable.id, assignedIds),
          eq(projectsTable.archived, false),
        )
      : and(
          eq(projectsTable.organizationId, activeOrganizationId),
          eq(projectsTable.archived, false),
        );
    return db
      .select({
        id: projectPartnerOrganizationsTable.id,
        projectId: projectsTable.id,
        projectName: projectsTable.name,
        organizationId: organization.id,
        organizationName: organization.name,
        assignedAt: projectPartnerOrganizationsTable.createdAt,
        updatedAt: projectPartnerOrganizationsTable.updatedAt,
      })
      .from(projectPartnerOrganizationsTable)
      .innerJoin(
        projectsTable,
        eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
      )
      .innerJoin(
        organization,
        eq(organization.id, projectPartnerOrganizationsTable.organizationId),
      )
      .where(scopeFilter)
      .orderBy(
        asc(organization.name),
        asc(projectsTable.name),
        asc(projectPartnerOrganizationsTable.id),
      );
  });

/**
 * Assigns an existing Organization to a Project hosted by the active Organization.
 *
 * Returns the created Project Partnership and rejects inaccessible Projects,
 * unknown Organizations, self-Partnerships, duplicates, and invariant violations.
 */
export const assignPartnership = authorized
  .use(requireCostTrackerPermissions({ projectPartnership: ["create"] }))
  .input(AssignProjectPartnershipInputSchema)
  .output(ProjectPartnershipSchema)
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId!;
    const relationship = await resolveRelationship({
      activeOrganizationId,
      projectId: input.projectId,
    });
    if (relationship.kind === "inaccessible")
      throw createSituationErrors(errors).projectNotFound();
    if (relationship.kind !== "hosted") {
      throw createSituationErrors(errors).hostingSideRequired();
    }
    if (input.organizationId === activeOrganizationId) {
      throw createSituationErrors(errors).selfPartnership();
    }

    try {
      return await db.transaction(async (transaction) => {
        const [hostedProject] = await transaction
          .select({ id: projectsTable.id, name: projectsTable.name })
          .from(projectsTable)
          .where(
            and(
              eq(projectsTable.id, input.projectId),
              eq(projectsTable.organizationId, activeOrganizationId),
            ),
          )
          .for("update")
          .limit(1);
        if (!hostedProject) {
          throw createSituationErrors(errors).projectNotFound();
        }

        const [candidate] = await transaction
          .select({ id: organization.id, name: organization.name })
          .from(organization)
          .where(eq(organization.id, input.organizationId))
          .limit(1);
        if (!candidate) {
          throw createSituationErrors(errors).partnerOrganizationNotFound();
        }

        const [created] = await transaction
          .insert(projectPartnerOrganizationsTable)
          .values({
            projectId: hostedProject.id,
            organizationId: candidate.id,
          })
          .returning({
            id: projectPartnerOrganizationsTable.id,
            assignedAt: projectPartnerOrganizationsTable.createdAt,
            updatedAt: projectPartnerOrganizationsTable.updatedAt,
          });
        if (!created) {
          throw new Error("Project Partnership insert returned no row");
        }

        return {
          ...created,
          projectId: hostedProject.id,
          projectName: hostedProject.name,
          organizationId: candidate.id,
          organizationName: candidate.name,
        };
      });
    } catch (error) {
      const code = getPostgresErrorCode(error);
      if (code === "23505") {
        throw createSituationErrors(errors).partnershipAlreadyAssigned();
      }
      if (code === "23514") {
        throw createSituationErrors(errors).partnershipInvariant();
      }

      if (isExpectedORPCError(error)) throw error;

      console.error("Failed to assign Project Partnership", error);
      throw createSituationErrors(errors).internalFailure();
    }
  });

/**
 * Removes a Project Partnership owned by the active Hosting Organization.
 *
 * Returns the removed Partnership ID and rejects removals that would leave a
 * Project Participation representing an unassigned Organization.
 */
export const removePartnership = authorized
  .use(requireCostTrackerPermissions({ projectPartnership: ["delete"] }))
  .input(RemoveProjectPartnershipInputSchema)
  .output(RemoveProjectPartnershipResultSchema)
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId!;

    try {
      return await db.transaction(async (transaction) => {
        const [partnership] = await transaction
          .select({
            projectId: projectPartnerOrganizationsTable.projectId,
            organizationId: projectPartnerOrganizationsTable.organizationId,
          })
          .from(projectPartnerOrganizationsTable)
          .innerJoin(
            projectsTable,
            and(
              eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
              eq(projectsTable.organizationId, activeOrganizationId),
            ),
          )
          .where(eq(projectPartnerOrganizationsTable.id, input.id))
          .for("update")
          .limit(1);
        if (!partnership) {
          throw createSituationErrors(errors).partnershipNotFound();
        }

        const [representedParticipation] = await transaction
          .select({ id: projectParticipantsTable.id })
          .from(projectParticipantsTable)
          .where(
            and(
              eq(projectParticipantsTable.projectId, partnership.projectId),
              eq(
                projectParticipantsTable.representedOrganizationId,
                partnership.organizationId,
              ),
            ),
          )
          .limit(1);
        if (representedParticipation) {
          throw createSituationErrors(errors).partnershipReferenced();
        }

        const [removed] = await transaction
          .delete(projectPartnerOrganizationsTable)
          .where(
            and(
              eq(projectPartnerOrganizationsTable.id, input.id),
              exists(
                transaction
                  .select({ id: projectsTable.id })
                  .from(projectsTable)
                  .where(
                    and(
                      eq(
                        projectsTable.id,
                        projectPartnerOrganizationsTable.projectId,
                      ),
                      eq(projectsTable.organizationId, activeOrganizationId),
                    ),
                  ),
              ),
              notExists(
                transaction
                  .select({ id: projectParticipantsTable.id })
                  .from(projectParticipantsTable)
                  .where(
                    and(
                      eq(
                        projectParticipantsTable.projectId,
                        projectPartnerOrganizationsTable.projectId,
                      ),
                      eq(
                        projectParticipantsTable.representedOrganizationId,
                        projectPartnerOrganizationsTable.organizationId,
                      ),
                    ),
                  ),
              ),
            ),
          )
          .returning({ id: projectPartnerOrganizationsTable.id });
        if (!removed) {
          const [remaining] = await transaction
            .select({ id: projectPartnerOrganizationsTable.id })
            .from(projectPartnerOrganizationsTable)
            .innerJoin(
              projectsTable,
              and(
                eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
                eq(projectsTable.organizationId, activeOrganizationId),
              ),
            )
            .where(eq(projectPartnerOrganizationsTable.id, input.id))
            .limit(1);
          if (!remaining)
            throw createSituationErrors(errors).partnershipNotFound();
          const [reference] = await transaction
            .select({ id: projectParticipantsTable.id })
            .from(projectParticipantsTable)
            .where(
              and(
                eq(projectParticipantsTable.projectId, partnership.projectId),
                eq(
                  projectParticipantsTable.representedOrganizationId,
                  partnership.organizationId,
                ),
              ),
            )
            .limit(1);
          if (reference)
            throw createSituationErrors(errors).partnershipReferenced();
          console.error(
            "Project Partnership removal returned no row without a scoped reference",
            { partnershipId: input.id },
          );
          throw createSituationErrors(errors).internalFailure();
        }

        return { id: removed.id, removed: true as const };
      });
    } catch (error) {
      if (getPostgresErrorCode(error) === "23514") {
        throw createSituationErrors(errors).partnershipReferenced();
      }
      if (isExpectedORPCError(error)) throw error;

      console.error("Failed to remove Project Partnership", error);
      throw createSituationErrors(errors).internalFailure();
    }
  });
