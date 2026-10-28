import { createHash, randomBytes } from "node:crypto";

import { hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  member,
  partnerOrganizationSetupLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
} from "@greendex/database/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireHostCoordination } from "@/features/projects/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
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
    if (!context.session.activeOrganizationId)
      throw createSituationErrors(errors).selectOrganization();
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
      if (!project) throw createSituationErrors(errors).projectNotFound();
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
        expired: z.boolean(),
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
        expired: sql<boolean>`${links.expiresAt} <= current_timestamp`,
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
    if (!link) throw createSituationErrors(errors).setupLinkNotFound();
    return { disabled: true as const };
  });

const setupLinkInput = z.object({ id: identifier, secret: z.string().min(1) });
const redemptionResult = z.object({
  partnershipId: z.string(),
  organizationId: z.string(),
});
type SetupTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SetupErrors = ReturnType<typeof createSituationErrors>;

async function requireOrganizationOwner(
  tx: SetupTransaction,
  userId: string,
  organizationId: string,
  errors: SetupErrors,
) {
  const [ownership] = await tx
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    )
    .limit(1);
  if (
    !ownership ||
    !hasOrganizationRole(ownership.role, ORGANIZATION_ROLES.OrganizationOwner)
  )
    throw errors.organizationOwnerRequired();
}

async function validateSetupLink(
  tx: SetupTransaction,
  input: z.infer<typeof setupLinkInput>,
  user: { id: string; email: string; emailVerified: boolean },
  errors: SetupErrors,
) {
  const [link] = await tx
    .select()
    .from(links)
    .where(eq(links.id, input.id))
    .for("update")
    .limit(1);
  if (!link || link.secretHash !== hash(input.secret))
    throw errors.setupLinkNotFound();
  if (user.email.toLowerCase() !== link.recipientEmail)
    throw errors.setupLinkWrongEmail();
  if (!user.emailVerified) throw errors.verifyEmail();
  if (!link.enabled) throw errors.setupLinkDisabled();
  if (link.expiresAt <= new Date()) throw errors.setupLinkExpired();

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
  if (!project) throw errors.projectNotFound();

  let redemption: z.infer<typeof redemptionResult> | null = null;
  if (link.partnershipId) {
    const [previous] = await tx
      .select({
        partnershipId: partnerships.id,
        organizationId: partnerships.organizationId,
      })
      .from(partnerships)
      .where(
        and(
          eq(partnerships.id, link.partnershipId),
          eq(partnerships.projectId, project.id),
        ),
      )
      .limit(1);
    if (!previous || link.consumedByUserId !== user.id)
      throw errors.setupLinkUsed();
    await requireOrganizationOwner(tx, user.id, previous.organizationId, errors);
    redemption = previous;
  }
  return { link, project, redemption };
}

export async function readSetupLinkEligibility(
  input: z.infer<typeof setupLinkInput>,
  user: { id: string; email: string; emailVerified: boolean },
  errors: SetupErrors,
) {
  return db.transaction(async (tx) => {
    const { project, redemption } = await validateSetupLink(
      tx,
      input,
      user,
      errors,
    );
    return redemption
      ? { status: "redeemed" as const, projectId: project.id, ...redemption }
      : { status: "eligible" as const, projectId: project.id };
  });
}

/** Advisory only. Redemption rechecks authoritative state after Better Auth creation. */
export const getSetupLinkEligibility = authorized
  .input(setupLinkInput)
  .output(
    z.discriminatedUnion("status", [
      z.object({ status: z.literal("eligible"), projectId: z.string() }),
      redemptionResult.extend({
        status: z.literal("redeemed"),
        projectId: z.string(),
      }),
    ]),
  )
  .handler(async ({ input, context, errors }) =>
    readSetupLinkEligibility(input, context.user, createSituationErrors(errors)),
  );

async function validateSetupBinding(
  tx: SetupTransaction,
  input: z.infer<typeof setupLinkInput> & { organizationId: string },
  user: { id: string; email: string; emailVerified: boolean },
  situations: SetupErrors,
) {
  const { link, project, redemption } = await validateSetupLink(
    tx,
    input,
    user,
    situations,
  );
  await requireOrganizationOwner(tx, user.id, input.organizationId, situations);
  if (redemption) {
    if (redemption.organizationId !== input.organizationId)
      throw situations.setupLinkUsed();
    return { link, project, redemption };
  }

  if (input.organizationId === project.hostId) throw situations.selfPartnership();
  const [existing] = await tx
    .select({ id: partnerships.id })
    .from(partnerships)
    .where(
      and(
        eq(partnerships.projectId, project.id),
        eq(partnerships.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  if (existing) throw situations.partnershipAlreadyAssigned();
  return { link, project, redemption };
}

export async function readSetupBindingEligibility(
  input: z.infer<typeof setupLinkInput> & { organizationId: string },
  user: { id: string; email: string; emailVerified: boolean },
  errors: SetupErrors,
) {
  await db.transaction((tx) => validateSetupBinding(tx, input, user, errors));
}

/** Binds only. Better Auth owns Organization creation and Memberships (ADR-0013). */
export const consumeSetupLink = authorized
  .input(setupLinkInput.extend({ organizationId: identifier }))
  .output(redemptionResult)
  .handler(async ({ input, context, errors }) => {
    return db.transaction(async (tx) => {
      const situations = createSituationErrors(errors);
      const { link, project, redemption } = await validateSetupBinding(
        tx,
        input,
        context.user,
        situations,
      );
      if (redemption) return redemption;
      const organizationId = input.organizationId;
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
