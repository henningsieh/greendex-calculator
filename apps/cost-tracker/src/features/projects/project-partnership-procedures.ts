import { db } from "@greendex/database";
import {
  organization,
  projectParticipantsTable,
  projectPartnerOrganizationsTable,
  projectsTable,
} from "@greendex/database/schema";
import { and, asc, eq, exists, notExists } from "drizzle-orm";
import { z } from "zod";

import { resolveProjectRelationship } from "@/features/projects/project-relationship-procedure";
import {
  AssignProjectPartnershipInputSchema,
  ProjectPartnershipSchema,
  RemoveProjectPartnershipInputSchema,
  RemoveProjectPartnershipResultSchema,
} from "@/features/projects/validation-schemas";
import { authorized, requireCostTrackerPermissions } from "@/lib/orpc/middleware";

function getPostgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return getPostgresErrorCode(error.cause);
  return undefined;
}

function isExpectedORPCError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (
    error.code === "BAD_REQUEST" ||
    error.code === "FORBIDDEN" ||
    error.code === "NOT_FOUND"
  );
}

export const listProjectPartnerships = authorized
  .use(
    requireCostTrackerPermissions({
      project: ["read"],
      projectPartnership: ["read"],
    }),
  )
  .output(z.array(ProjectPartnershipSchema))
  .handler(async ({ context }) =>
    db
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
      .where(
        and(
          eq(projectsTable.organizationId, context.session.activeOrganizationId!),
          eq(projectsTable.archived, false),
        ),
      )
      .orderBy(
        asc(organization.name),
        asc(projectsTable.name),
        asc(projectPartnerOrganizationsTable.id),
      ),
  );

export const assignProjectPartnership = authorized
  .use(requireCostTrackerPermissions({ projectPartnership: ["create"] }))
  .input(AssignProjectPartnershipInputSchema)
  .output(ProjectPartnershipSchema)
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId!;
    const relationship = await resolveProjectRelationship({
      activeOrganizationId,
      projectId: input.projectId,
    });
    if (relationship.kind !== "hosted") {
      throw errors.FORBIDDEN({
        message: "Only the Hosting Organization can assign this Project.",
      });
    }
    if (input.organizationId === activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "A Hosting Organization cannot be its own Partner Organization.",
      });
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
          throw errors.FORBIDDEN({
            message: "Only the Hosting Organization can assign this Project.",
          });
        }

        const [candidate] = await transaction
          .select({ id: organization.id, name: organization.name })
          .from(organization)
          .where(eq(organization.id, input.organizationId))
          .limit(1);
        if (!candidate) {
          throw errors.NOT_FOUND({ message: "Partner Organization not found." });
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
        throw errors.BAD_REQUEST({
          message: "This Organization is already assigned to the Project.",
        });
      }
      if (code === "23514") {
        throw errors.BAD_REQUEST({
          message: "This Project Partnership violates an Organization invariant.",
        });
      }
      if (code === "23503") {
        throw errors.NOT_FOUND({ message: "Partner Organization not found." });
      }
      if (isExpectedORPCError(error)) throw error;

      console.error("Failed to assign Project Partnership", error);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });

export const removeProjectPartnership = authorized
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
          .where(eq(projectPartnerOrganizationsTable.id, input.partnershipId))
          .for("update")
          .limit(1);
        if (!partnership) {
          throw errors.FORBIDDEN({
            message:
              "The active Organization cannot remove this Project Partnership.",
          });
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
          throw errors.BAD_REQUEST({
            message:
              "Remove or reassign represented Project Participations before removing this Project Partnership.",
          });
        }

        const [removed] = await transaction
          .delete(projectPartnerOrganizationsTable)
          .where(
            and(
              eq(projectPartnerOrganizationsTable.id, input.partnershipId),
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
          throw errors.BAD_REQUEST({
            message:
              "Remove or reassign represented Project Participations before removing this Project Partnership.",
          });
        }

        return { id: removed.id, removed: true as const };
      });
    } catch (error) {
      if (getPostgresErrorCode(error) === "23514") {
        throw errors.BAD_REQUEST({
          message:
            "Remove or reassign represented Project Participations before removing this Project Partnership.",
        });
      }
      if (isExpectedORPCError(error)) throw error;

      console.error("Failed to remove Project Partnership", error);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
