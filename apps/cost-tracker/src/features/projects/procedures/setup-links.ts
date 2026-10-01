import { createHash, randomBytes, randomUUID } from "node:crypto";

import { hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  member,
  organization,
  partnerOrganizationSetupLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
} from "@greendex/database/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireHostCoordination } from "@/features/projects/procedures/coordination";
import { authorized, requireCostTrackerPermissions } from "@/lib/orpc/middleware";

const identifier = z.string().trim().min(1).max(128);
// Setup links stay redeemable for seven days from creation.
const SETUP_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const email = z.email().transform((value) => value.toLowerCase());
const hash = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");

/** The caller delivers the returned secret through a private channel; it is never persisted raw. */
export const createSetupLink = authorized
  .input(z.object({ projectId: identifier, recipientEmail: email }))
  .output(z.object({ id: z.string(), secret: z.string(), expiresAt: z.date() }))
  .handler(async ({ input, context, errors }) => {
    const secret = randomBytes(32).toString("base64url");
    return db.transaction(async (tx) => {
      const [project] = await tx
        .select({
          id: projectsTable.id,
        })
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, input.projectId),
            eq(
              projectsTable.organizationId,
              context.session.activeOrganizationId!,
            ),
            eq(projectsTable.archived, false),
          ),
        )
        .for("update")
        .limit(1);
      if (!project)
        throw errors.FORBIDDEN({
          message:
            "Only assigned Hosting staff can create a setup link for this Project.",
        });
      await requireHostCoordination(
        project.id,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
        tx,
      );
      const expiresAt = new Date(Date.now() + SETUP_LINK_TTL_MS);
      const [link] = await tx
        .insert(links)
        .values({
          projectId: project.id,
          recipientEmail: input.recipientEmail,
          secretHash: hash(secret),
          expiresAt,
          createdByUserId: context.user.id,
        })
        .returning({ id: links.id });
      return { id: link!.id, secret, expiresAt };
    });
  });

/** Hosting-scoped metadata only: raw secrets cannot be recovered from stored hashes. */
export const listSetupLinks = authorized
  .use(requireCostTrackerPermissions({ projectPartnership: ["create"] }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        projectName: z.string(),
        recipientEmail: z.string(),
        enabled: z.boolean(),
        expiresAt: z.date(),
        consumedAt: z.date().nullable(),
      }),
    ),
  )
  .handler(async ({ context }) =>
    db
      .select({
        id: links.id,
        projectName: projectsTable.name,
        recipientEmail: links.recipientEmail,
        enabled: links.enabled,
        expiresAt: links.expiresAt,
        consumedAt: links.consumedAt,
      })
      .from(links)
      .innerJoin(projectsTable, eq(links.projectId, projectsTable.id))
      .where(
        eq(projectsTable.organizationId, context.session.activeOrganizationId!),
      )
      .orderBy(desc(links.createdAt), desc(links.id)),
  );

export const disableSetupLink = authorized
  .use(requireCostTrackerPermissions({ projectPartnership: ["create"] }))
  .input(z.object({ id: identifier }))
  .output(z.object({ disabled: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const [link] = await db
      .update(links)
      .set({ enabled: false })
      .from(projectsTable)
      .where(
        and(
          eq(links.id, input.id),
          eq(links.projectId, projectsTable.id),
          eq(projectsTable.organizationId, context.session.activeOrganizationId!),
        ),
      )
      .returning({ id: links.id });
    if (!link) throw errors.NOT_FOUND({ message: "Setup link not found." });
    return { disabled: true as const };
  });

export const consumeSetupLink = authorized
  .input(
    z.object({
      id: identifier,
      secret: z.string().min(1),
      organization: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("existing"), organizationId: identifier }),
        z.object({
          kind: z.literal("new"),
          name: z.string().trim().min(1).max(255),
        }),
      ]),
    }),
  )
  .output(z.object({ partnershipId: z.string(), organizationId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    return db.transaction(async (tx) => {
      const [link] = await tx
        .select()
        .from(links)
        .where(eq(links.id, input.id))
        .for("update")
        .limit(1);
      if (!link || link.secretHash !== hash(input.secret))
        throw errors.NOT_FOUND({ message: "Setup link not found." });
      if (
        !context.user.emailVerified ||
        context.user.email.toLowerCase() !== link.recipientEmail
      )
        throw errors.FORBIDDEN({
          message: "This setup link belongs to another email address.",
        });
      if (!link.enabled)
        throw errors.BAD_REQUEST({ message: "This setup link is disabled." });
      if (link.expiresAt <= new Date())
        throw errors.BAD_REQUEST({ message: "This setup link has expired." });

      if (input.organization.kind === "existing") {
        const [ownership] = await tx
          .select({ role: member.role })
          .from(member)
          .where(
            and(
              eq(member.userId, context.user.id),
              eq(member.organizationId, input.organization.organizationId),
            ),
          )
          .limit(1);
        if (!ownership || !hasOrganizationRole(ownership.role, "owner"))
          throw errors.FORBIDDEN({
            message: "You must be an Owner of the selected Organization.",
          });
      }
      if (link.partnershipId) {
        const [previous] = await tx
          .select({
            id: partnerships.id,
            organizationId: partnerships.organizationId,
          })
          .from(partnerships)
          .where(eq(partnerships.id, link.partnershipId))
          .limit(1);
        if (
          previous &&
          link.consumedByUserId === context.user.id &&
          (input.organization.kind === "new" ||
            previous.organizationId === input.organization.organizationId)
        ) {
          return {
            partnershipId: previous.id,
            organizationId: previous.organizationId,
          };
        }
        throw errors.BAD_REQUEST({
          message:
            "This setup link has already been used for another Organization.",
        });
      }

      const [project] = await tx
        .select({ id: projectsTable.id, hostId: projectsTable.organizationId })
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, link.projectId),
            eq(projectsTable.archived, false),
          ),
        )
        .for("update")
        .limit(1);
      if (!project)
        throw errors.BAD_REQUEST({
          message: "This Project is no longer available.",
        });

      let organizationId: string;
      if (input.organization.kind === "new") {
        organizationId = randomUUID();
        await tx.insert(organization).values({
          id: organizationId,
          name: input.organization.name,
          slug: organizationId,
          createdAt: new Date(),
        });
        await tx.insert(member).values({
          id: randomUUID(),
          organizationId,
          userId: context.user.id,
          role: "owner",
          createdAt: new Date(),
        });
      } else {
        organizationId = input.organization.organizationId;
      }
      if (organizationId === project.hostId)
        throw errors.BAD_REQUEST({
          message:
            "The Hosting Organization cannot be its own Partner Organization.",
        });
      const [existing] = await tx
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(
          and(
            eq(partnerships.projectId, project.id),
            eq(partnerships.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (existing)
        throw errors.BAD_REQUEST({
          message: "This Organization is already assigned to the Project.",
        });
      const [partnership] = await tx
        .insert(partnerships)
        .values({ projectId: project.id, organizationId })
        .returning({ id: partnerships.id });
      await tx
        .update(links)
        .set({
          partnershipId: partnership!.id,
          consumedAt: new Date(),
          consumedByUserId: context.user.id,
        })
        .where(eq(links.id, link.id));
      return { partnershipId: partnership!.id, organizationId };
    });
  });
