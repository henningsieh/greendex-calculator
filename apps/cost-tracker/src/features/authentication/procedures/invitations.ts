import "server-only";
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  invitation,
  participantInvitationBridgesTable as bridges,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, eq, gt, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  id,
  invitationResult,
  newNativeParticipantInvitation,
  normalizedEmail,
  partnershipForIssuer,
} from "@/features/authentication/procedures/shared";
import { auth } from "@/lib/auth";
import { sendParticipantInvitation } from "@/lib/email";
import { authorized } from "@/lib/orpc/middleware";

export async function deliverParticipantInvitation(
  email: string,
  invitationId: string,
) {
  try {
    const [live] = await db
      .select({ invitationId: bridges.invitationId })
      .from(bridges)
      .innerJoin(invitation, eq(invitation.id, bridges.invitationId))
      .where(
        and(
          eq(bridges.invitationId, invitationId),
          eq(bridges.status, "pending"),
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, new Date()),
          sql`lower(${invitation.email}) = ${email}`,
        ),
      )
      .limit(1);
    if (!live) {
      console.info("Superseded Participant Invitation delivery skipped.");
      return { invitationId, delivery: "failed" as const };
    }
    // Do not hold a DB lock across SMTP latency. A rotation in the check-to-send
    // window can deliver a dead link, but acceptance rejects it without state change.
    await sendParticipantInvitation({ email, invitationId });
    return { invitationId, delivery: "sent" as const };
  } catch (error) {
    // The invitation is committed; report failure without leaking SMTP details.
    // invitationId identifies the failed send; the error class aids diagnosis.
    console.error("Participant Invitation email delivery failed.", {
      invitationId,
      cause: error instanceof Error ? error.name : typeof error,
    });
    return { invitationId, delivery: "failed" as const };
  }
}

export function buildInvitations() {
  const reissueInvitation = authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const target = await partnershipForIssuer(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [existingParticipation] = await db
        .select({ id: participants.id })
        .from(participants)
        .leftJoin(user, eq(user.id, participants.userId))
        .where(
          and(
            eq(participants.projectId, target.projectId),
            or(
              sql`lower(${participants.email}) = ${input.email}`,
              sql`lower(${user.email}) = ${input.email}`,
            ),
          ),
        )
        .limit(1);
      if (existingParticipation)
        throw errors.BAD_REQUEST({
          message: "This person already participates in this Project.",
        });
      const { invitationId } = await db.transaction(async (tx) => {
        // Serialize rotations across every Partnership in this Project.
        await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, target.projectId))
          .for("update");
        const [previous] = await tx
          .select({
            invitationId: bridges.invitationId,
            partnershipId: bridges.partnershipId,
          })
          .from(bridges)
          .where(
            and(
              eq(bridges.projectId, target.projectId),
              eq(bridges.email, input.email),
              eq(bridges.status, "pending"),
            ),
          )
          .limit(1);
        if (!previous)
          throw errors.BAD_REQUEST({
            message: "No active Participant Invitation to replace.",
          });
        if (previous.partnershipId !== target.id)
          await partnershipForIssuer(
            previous.partnershipId,
            context.user.id,
            context.session.activeOrganizationId,
            errors,
          );
        await tx
          .update(invitation)
          .set({ status: "canceled" })
          .where(
            and(
              eq(invitation.id, previous.invitationId),
              eq(invitation.status, "pending"),
            ),
          );
        await tx
          .update(bridges)
          .set({ status: "revoked" })
          .where(eq(bridges.invitationId, previous.invitationId));
        const invitationId = randomUUID();
        await tx
          .insert(invitation)
          .values(
            newNativeParticipantInvitation(
              invitationId,
              target.hostId,
              input.email,
              context.user.id,
            ),
          );
        await tx.insert(bridges).values({
          invitationId,
          partnershipId: target.id,
          projectId: target.projectId,
          email: input.email,
          issuedByUserId: context.user.id,
        });
        return { invitationId };
      });
      // Only explicit reissue creates a new identity and triggers another delivery.
      return deliverParticipantInvitation(input.email, invitationId);
    });

  const issueInvitation = authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const partnership = await partnershipForIssuer(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [existingParticipation] = await db
        .select({ id: participants.id })
        .from(participants)
        .leftJoin(user, eq(user.id, participants.userId))
        .where(
          and(
            eq(participants.projectId, partnership.projectId),
            or(
              sql`lower(${participants.email}) = ${input.email}`,
              sql`lower(${user.email}) = ${input.email}`,
            ),
          ),
        )
        .limit(1);
      if (existingParticipation)
        throw errors.BAD_REQUEST({
          message: "This person already participates in this Project.",
        });
      const [existingBridge] = await db
        .select({
          invitationId: bridges.invitationId,
          partnershipId: bridges.partnershipId,
        })
        .from(bridges)
        .where(
          and(
            eq(bridges.projectId, partnership.projectId),
            eq(bridges.email, input.email),
            eq(bridges.status, "pending"),
          ),
        )
        .limit(1);
      if (existingBridge) {
        if (existingBridge.partnershipId !== partnership.id)
          throw errors.BAD_REQUEST({
            message: "This person already has an invitation to this Project.",
          });
        const [native] = await db
          .select({
            status: invitation.status,
            expiresAt: invitation.expiresAt,
          })
          .from(invitation)
          .where(eq(invitation.id, existingBridge.invitationId))
          .limit(1);
        if (
          native &&
          native.status === "pending" &&
          native.expiresAt > new Date()
        )
          // Idempotent issuance never resends: only explicit reissue delivers again.
          return {
            invitationId: existingBridge.invitationId,
            delivery: "already-issued" as const,
          };
        // Stale bridge: the native invitation is missing, expired, or closed.
        // Retire it and fall through to fresh issuance below.
        await db.transaction(async (tx) => {
          await tx
            .update(invitation)
            .set({ status: "canceled" })
            .where(
              and(
                eq(invitation.id, existingBridge.invitationId),
                eq(invitation.status, "pending"),
              ),
            );
          await tx
            .update(bridges)
            .set({ status: "revoked" })
            .where(eq(bridges.invitationId, existingBridge.invitationId));
        });
      }
      let invitationId: string;
      if (partnership.hostCanInvite) {
        const response = await auth.api.createInvitation({
          asResponse: true,
          headers: context.headers,
          body: {
            email: input.email,
            role: "participant",
            organizationId: partnership.hostId,
          },
        });
        if (!response.ok)
          throw errors.BAD_REQUEST({
            message: "Better Auth invitation issuance failed.",
          });
        invitationId = z
          .object({ id: z.string() })
          .parse(await response.json()).id;
        await db.insert(bridges).values({
          invitationId,
          partnershipId: partnership.id,
          projectId: partnership.projectId,
          email: input.email,
          issuedByUserId: context.user.id,
        });
      } else {
        // Partner issuers cannot call BA's host-only invite endpoint. Write the native
        // invitation shape plus bridge atomically, under the verified issuer guard.
        invitationId = randomUUID();
        await db.transaction(async (tx) => {
          await tx
            .insert(invitation)
            .values(
              newNativeParticipantInvitation(
                invitationId,
                partnership.hostId,
                input.email,
                context.user.id,
              ),
            );
          await tx.insert(bridges).values({
            invitationId,
            partnershipId: partnership.id,
            projectId: partnership.projectId,
            email: input.email,
            issuedByUserId: context.user.id,
          });
        });
      }
      console.info("Participant invitation issued", {
        issuer: context.user.id,
        recipient: input.email,
        partnershipId: partnership.id,
        at: new Date().toISOString(),
      });
      return deliverParticipantInvitation(input.email, invitationId);
    });

  const setInvitationOpen = authorized
    .input(z.object({ invitationId: id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [bridge] = await db
        .select({ partnershipId: bridges.partnershipId, status: bridges.status })
        .from(bridges)
        .where(eq(bridges.invitationId, input.invitationId))
        .limit(1);
      if (!bridge) throw errors.NOT_FOUND();
      await partnershipForIssuer(
        bridge.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (bridge.status === "accepted")
        throw errors.BAD_REQUEST({
          message: "Accepted invitations cannot be changed.",
        });
      const [native] = await db
        .select({ status: invitation.status, expiresAt: invitation.expiresAt })
        .from(invitation)
        .where(eq(invitation.id, input.invitationId))
        .limit(1);
      if (
        !native ||
        native.status !== "pending" ||
        native.expiresAt <= new Date()
      )
        throw errors.BAD_REQUEST({ message: "Invitation is unavailable." });
      // Revocation also cancels the native invitation: a revoked bridge blocks
      // app join, but the native row would otherwise stay acceptable through
      // BA's public endpoint. Reopening never resurrects a canceled native row
      // (the pre-check above rejects it) — re-issue after revoke instead.
      await db.transaction(async (tx) => {
        await tx
          .update(bridges)
          .set({ status: input.open ? "pending" : "revoked" })
          .where(eq(bridges.invitationId, input.invitationId));
        if (!input.open) {
          await tx
            .update(invitation)
            .set({ status: "canceled" })
            .where(
              and(
                eq(invitation.id, input.invitationId),
                eq(invitation.status, "pending"),
              ),
            );
        }
      });
      return { open: input.open };
    });
  return { issueInvitation, reissueInvitation, setInvitationOpen };
}
